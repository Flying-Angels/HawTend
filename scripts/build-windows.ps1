param([switch]$SkipWebBuild, [string]$ExecutableName = 'HawTend.exe')
$ErrorActionPreference = 'Stop'
if ($ExecutableName -notmatch '^HawTend(?:-[0-9.]+)?\.exe$') { throw 'Use a HawTend executable filename without a directory.' }
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
        & $nodePath 'scripts/build-notices.mjs'
        if ($LASTEXITCODE -ne 0) { throw 'Dependency notices generation failed.' }
        & $nodePath 'node_modules/vite/bin/vite.js' build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
        & $nodePath 'scripts/build-sw.mjs'
        if ($LASTEXITCODE -ne 0) { throw 'Offline shell build failed.' }
    }
    if (-not (Test-Path -LiteralPath 'dist/sw.js')) { throw 'Build the web app first.' }
    $buildDir = Join-Path $projectDir 'output/windows-build'
    $releaseDir = Join-Path $projectDir 'releases/windows'
    New-Item -ItemType Directory -Path $buildDir, $releaseDir -Force | Out-Null
    # Pin the free Microsoft SDK independently of the automatically updated runtime.
    $sdkVersion = '1.0.4129.50'
    $sdkDir = Join-Path $projectDir "output/windows-sdk/$sdkVersion"
    $sdkArchive = Join-Path $sdkDir 'sdk.zip'
    $sdkHash = 'D3934F482D484B89FB4825DF720C710664E1143A1E90F7B3A60794EF33F473D2'
    New-Item -ItemType Directory -Path $sdkDir -Force | Out-Null
    if (-not (Test-Path -LiteralPath $sdkArchive)) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg" -OutFile $sdkArchive
    }
    if ((Get-FileHash -LiteralPath $sdkArchive -Algorithm SHA256).Hash -ne $sdkHash) { throw 'WebView2 SDK checksum mismatch.' }
    $sdkPackage = Join-Path $sdkDir 'package'
    if (-not (Test-Path -LiteralPath $sdkPackage)) { Expand-Archive -LiteralPath $sdkArchive -DestinationPath $sdkPackage }
    $sdkCore = Join-Path $sdkPackage 'lib/net462/Microsoft.Web.WebView2.Core.dll'
    $sdkForms = Join-Path $sdkPackage 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
    $sdkLoader = Join-Path $sdkPackage 'runtimes/win-x64/native/WebView2Loader.dll'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipPath = Join-Path $buildDir 'app.zip'
    # The only replaceable files here are this script's explicit output artifacts.
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
    [System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $projectDir 'dist'), $zipPath)

    # Windows uses the approved mark on transparency, including all small-size frames.
    $frames = @(
        @{ Size = 16; Path = 'public/brand/windows-icon-16.png' },
        @{ Size = 32; Path = 'public/brand/windows-icon-32.png' },
        @{ Size = 48; Path = 'public/brand/windows-icon-48.png' },
        @{ Size = 256; Path = 'public/brand/windows-icon-256.png' }
    )
    foreach ($frame in $frames) { $frame.Bytes = [System.IO.File]::ReadAllBytes((Join-Path $projectDir $frame.Path)) }
    $iconPath = Join-Path $buildDir 'hawtend.ico'
    $iconStream = [System.IO.File]::Create($iconPath)
    $writer = [System.IO.BinaryWriter]::new($iconStream)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
        $offset = 6 + 16 * $frames.Count
        foreach ($frame in $frames) {
            $edge = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
            $writer.Write([byte]$edge); $writer.Write([byte]$edge); $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
            $offset += $frame.Bytes.Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
    } finally { $writer.Dispose() }

    # A separate, stronger silhouette stays readable in the notification area.
    $trayFrames = @(16,20,24,32,40,48) | ForEach-Object { @{ Size = $_; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $projectDir "public/brand/tray-icon-$_.png")) } }
    $trayIconPath = Join-Path $buildDir 'hawtend-tray.ico'
    $trayWriter = [System.IO.BinaryWriter]::new([System.IO.File]::Create($trayIconPath))
    try {
        $trayWriter.Write([uint16]0); $trayWriter.Write([uint16]1); $trayWriter.Write([uint16]$trayFrames.Count)
        $offset = 6 + 16 * $trayFrames.Count
        foreach ($frame in $trayFrames) {
            $trayWriter.Write([byte]$frame.Size); $trayWriter.Write([byte]$frame.Size); $trayWriter.Write([byte]0); $trayWriter.Write([byte]0)
            $trayWriter.Write([uint16]1); $trayWriter.Write([uint16]32)
            $trayWriter.Write([uint32]$frame.Bytes.Length); $trayWriter.Write([uint32]$offset)
            $offset += $frame.Bytes.Length
        }
        foreach ($frame in $trayFrames) { $trayWriter.Write([byte[]]$frame.Bytes) }
    } finally { $trayWriter.Dispose() }

    $exePath = Join-Path $releaseDir $ExecutableName
    & $compiler /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 "/win32icon:$iconPath" "/resource:$iconPath,HawTend.Icon" "/resource:$trayIconPath,HawTend.TrayIcon" "/resource:$projectDir/public/brand/windows-icon-32.png,HawTend.CaptionMark" "/resource:$zipPath,HawTend.Assets" "/out:$exePath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.Web.Extensions.dll "/reference:$sdkCore" "/reference:$sdkForms" "/reference:$frameworkDir/WPF/UIAutomationClient.dll" "/reference:$frameworkDir/WPF/UIAutomationTypes.dll" (Join-Path $projectDir 'windows\HawTend.cs') (Join-Path $projectDir 'windows\DesktopWindows.cs') (Join-Path $projectDir 'windows\DesktopShell.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
    # A separate ICO lets shortcuts use the new artwork without reusing cached EXE icons.
    Copy-Item -LiteralPath $iconPath -Destination (Join-Path $releaseDir 'HawTend-transparent.ico') -Force
    foreach ($dll in @($sdkCore, $sdkForms, $sdkLoader)) {
        $destination = Join-Path $releaseDir ([IO.Path]::GetFileName($dll))
        # A running app locks its SDK. Identical files need no replacement.
        if ((Test-Path -LiteralPath $destination) -and
            (Get-FileHash -LiteralPath $destination).Hash -eq (Get-FileHash -LiteralPath $dll).Hash) { continue }
        Copy-Item -LiteralPath $dll -Destination $destination -Force
    }
    Copy-Item -LiteralPath (Join-Path $projectDir 'public/licenses/WebView2-SDK-LICENSE.txt') -Destination $releaseDir -Force
    Get-Item -LiteralPath $exePath | Select-Object FullName,Length
    Get-FileHash -LiteralPath $exePath -Algorithm SHA256
} finally { Pop-Location }
