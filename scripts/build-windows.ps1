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

    $exePath = Join-Path $releaseDir 'HawTend.exe'
    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 "/win32icon:$iconPath" "/resource:$iconPath,HawTend.Icon" "/resource:$zipPath,HawTend.Assets" "/out:$exePath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll (Join-Path $projectDir 'windows\HawTend.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
    # A separate ICO lets shortcuts use the new artwork without reusing cached EXE icons.
    Copy-Item -LiteralPath $iconPath -Destination (Join-Path $releaseDir 'HawTend-transparent.ico') -Force
    Get-Item -LiteralPath $exePath | Select-Object FullName,Length
    Get-FileHash -LiteralPath $exePath -Algorithm SHA256
} finally { Pop-Location }
