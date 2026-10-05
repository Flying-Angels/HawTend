param(
    [ValidateRange(1024, 65535)][int]$Port = 4173,
    [switch]$NoBrowser,
    [switch]$Headless
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $PSScriptRoot
$address = "http://127.0.0.1:$Port/"
$previewProcess = $null
$logDir = Join-Path $projectDir 'output\preview'

function Get-PreviewStatus {
    try {
        $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -eq 200 -and $response.Content -match '<title>HawTend') {
            return 'Ready'
        }
        return 'Other'
    } catch {
        return 'Unavailable'
    }
}

function Open-Preview {
    if (-not $NoBrowser) { Start-Process $address }
    Write-Output "HawTend ready: $address"
}

try {
    $status = Get-PreviewStatus
    if ($status -eq 'Ready') {
        Open-Preview
        exit 0
    }
    if ($status -eq 'Other') {
        throw "端口 $Port 被其他页面占用，请联系我处理；不会自动更换地址，以免出现另一份本地手账。"
    }

    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
        Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    if (-not (Test-Path -LiteralPath $nodePath)) {
        throw '没有找到 Node.js。请联系我补齐本机预览环境。'
    }
    $nodeVersion = & $nodePath --version
    if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) {
        throw '预览需要 Node.js 22 或以上。请联系我更新本机预览环境。'
    }
    $vitePath = Join-Path $projectDir 'node_modules\vite\bin\vite.js'
    $tscPath = Join-Path $projectDir 'node_modules\typescript\bin\tsc'
    if (-not (Test-Path -LiteralPath $vitePath) -or -not (Test-Path -LiteralPath $tscPath)) {
        throw '开发依赖尚未安装。请联系我补齐依赖，不需要你部署服务器。'
    }
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    # Rebuild only when the app source is newer than its generated offline shell.
    $offlineShell = Join-Path $projectDir 'dist\sw.js'
    $needsBuild = -not (Test-Path -LiteralPath $offlineShell)
    if (-not $needsBuild) {
        $builtAt = (Get-Item -LiteralPath $offlineShell).LastWriteTimeUtc
        $inputPaths = @('src', 'public', 'index.html', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'package.json', 'package-lock.json', 'scripts\build-sw.mjs')
        foreach ($inputPath in $inputPaths) {
            $fullPath = Join-Path $projectDir $inputPath
            if (Test-Path -LiteralPath $fullPath) {
                $item = Get-Item -LiteralPath $fullPath
                $inputs = if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $fullPath -File -Recurse } else { @($item) }
                if ($inputs | Where-Object { $_.LastWriteTimeUtc -gt $builtAt } | Select-Object -First 1) {
                    $needsBuild = $true
                    break
                }
            }
        }
    }
    if ($needsBuild) {
        $buildLog = Join-Path $logDir 'build.log'
        Push-Location $projectDir
        try {
            & $nodePath $tscPath -b 2>&1 | Out-File -LiteralPath $buildLog -Encoding utf8
            if ($LASTEXITCODE -ne 0) { throw "类型检查失败，详情：$buildLog" }
            & $nodePath $vitePath build 2>&1 | Out-File -LiteralPath $buildLog -Encoding utf8 -Append
            if ($LASTEXITCODE -ne 0) { throw "页面构建失败，详情：$buildLog" }
            & $nodePath (Join-Path $projectDir 'scripts\build-sw.mjs') 2>&1 | Out-File -LiteralPath $buildLog -Encoding utf8 -Append
            if ($LASTEXITCODE -ne 0) { throw "离线资源构建失败，详情：$buildLog" }
        } finally {
            Pop-Location
        }
    }

    $stdoutLog = Join-Path $logDir "preview-$Port.log"
    $stderrLog = Join-Path $logDir "preview-$Port-error.log"
    $previewProcess = Start-Process -FilePath $nodePath -WorkingDirectory $projectDir -WindowStyle Hidden -ArgumentList @(
        ('"' + $vitePath + '"'), 'preview', '--host', '127.0.0.1', '--port', "$Port", '--strictPort'
    ) -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
    Set-Content -LiteralPath (Join-Path $logDir "preview-$Port.pid") -Value $previewProcess.Id -Encoding ascii

    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt 30) {
        if ($previewProcess.HasExited) { throw "预览进程未能启动，详情：$stderrLog" }
        if ((Get-PreviewStatus) -eq 'Ready') {
            Open-Preview
            exit 0
        }
        Start-Sleep -Milliseconds 200
    }
    throw "预览启动超时，详情：$stderrLog"
} catch {
    if ($previewProcess -and -not $previewProcess.HasExited) {
        Stop-Process -Id $previewProcess.Id -ErrorAction SilentlyContinue
    }
    $message = "HawTend 暂时无法打开。`n`n$($_.Exception.Message)"
    if ($Headless) {
        [Console]::Error.WriteLine($message)
    } else {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($message, 'HawTend') | Out-Null
    }
    exit 1
}
