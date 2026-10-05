param([switch]$SkipWebBuild)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$frameworkDir = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $frameworkDir 'csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler not found.' }

Push-Location $projectDir
try {
    if (-not $SkipWebBuild) {
        $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
        & $nodePath 'node_modules/typescript/bin/tsc' -b
        if ($LASTEXITCODE -ne 0) { throw 'Type check failed.' }
        & $nodePath 'node_modules/vite/bin/vite.js' build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
        & $nodePath 'scripts/build-sw.mjs'
        if ($LASTEXITCODE -ne 0) { throw 'Offline shell build failed.' }
    }
    if (-not (Test-Path -LiteralPath 'dist/sw.js')) { throw 'Build the web app first.' }
    $buildDir = Join-Path $projectDir 'output/windows-build'
    $releaseDir = Join-Path $projectDir 'releases/windows'
    New-Item -ItemType Directory -Path $buildDir, $releaseDir -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipPath = Join-Path $buildDir 'app.zip'
    # The only replaceable files here are this script's explicit output artifacts.
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
    [System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $projectDir 'dist'), $zipPath)

    # Wrap existing PNG artwork in an ICO container; no new artwork is generated.
    $png = [System.IO.File]::ReadAllBytes((Join-Path $projectDir 'public/brand/hawtend-logo-256.png'))
    $iconPath = Join-Path $buildDir 'hawtend.ico'
    $iconStream = [System.IO.File]::Create($iconPath)
    $writer = [System.IO.BinaryWriter]::new($iconStream)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
        $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
    } finally { $writer.Dispose() }

    $exePath = Join-Path $releaseDir 'HawTend.exe'
    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 "/win32icon:$iconPath" "/resource:$iconPath,HawTend.Icon" "/resource:$zipPath,HawTend.Assets" "/out:$exePath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll (Join-Path $projectDir 'windows\HawTend.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
    Get-Item -LiteralPath $exePath | Select-Object FullName,Length
    Get-FileHash -LiteralPath $exePath -Algorithm SHA256
} finally { Pop-Location }
