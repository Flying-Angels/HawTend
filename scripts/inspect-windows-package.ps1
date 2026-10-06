param([string]$Executable = 'releases/windows/HawTend.exe')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $projectDir $Executable
Add-Type -AssemblyName System.IO.Compression
$assembly = [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($exePath)
$sha = [System.Security.Cryptography.SHA256]::Create()

function Get-StreamHash([System.IO.Stream]$Stream) {
    return [BitConverter]::ToString($sha.ComputeHash($Stream)).Replace('-', '')
}

$assetStream = $assembly.GetManifestResourceStream('HawTend.Assets')
$iconStream = $assembly.GetManifestResourceStream('HawTend.Icon')
$trayStream = $assembly.GetManifestResourceStream('HawTend.TrayIcon')
if (-not $assetStream -or -not $iconStream -or -not $trayStream) { throw 'Embedded app resources are missing.' }
$archive = [System.IO.Compression.ZipArchive]::new($assetStream, [System.IO.Compression.ZipArchiveMode]::Read)
try {
    $distPath = Join-Path $projectDir 'dist'
    $expectedFiles = @(Get-ChildItem -LiteralPath $distPath -File -Recurse)
    $matched = 0
    foreach ($entry in $archive.Entries) {
        if ($entry.Name.Length -eq 0) { continue }
        $entryPath = [System.IO.Path]::GetFullPath((Join-Path $distPath $entry.FullName))
        if (-not $entryPath.StartsWith($distPath + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected archive path.' }
        if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw "Unexpected embedded file: $($entry.FullName)" }
        $embedded = $entry.Open()
        $local = [System.IO.File]::OpenRead($entryPath)
        try {
            if ((Get-StreamHash $embedded) -ne (Get-StreamHash $local)) { throw "Embedded file differs: $($entry.FullName)" }
        } finally { $embedded.Dispose(); $local.Dispose() }
        $matched++
    }
    if ($matched -ne $expectedFiles.Count) { throw 'Embedded file count differs from dist.' }
    $expectedIcon = [System.IO.File]::OpenRead((Join-Path $projectDir 'output/windows-build/hawtend.ico'))
    try {
        if ((Get-StreamHash $iconStream) -ne (Get-StreamHash $expectedIcon)) { throw 'Embedded icon differs from the approved build.' }
    } finally { $expectedIcon.Dispose() }
    $expectedTray = [System.IO.File]::OpenRead((Join-Path $projectDir 'output/windows-build/hawtend-tray.ico'))
    try {
        if ((Get-StreamHash $trayStream) -ne (Get-StreamHash $expectedTray)) { throw 'Embedded tray icon differs.' }
    } finally { $expectedTray.Dispose() }
    [PSCustomObject]@{
        ReflectionOnly = $assembly.ReflectionOnly
        AssemblyVersion = $assembly.GetName().Version.ToString()
        EmbeddedFilesMatched = $matched
        IconMatched = $true
        TrayIconMatched = $true
        ExeBytes = (Get-Item -LiteralPath $exePath).Length
        SHA256 = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
    } | ConvertTo-Json
} finally { $archive.Dispose(); $assetStream.Dispose(); $iconStream.Dispose(); $trayStream.Dispose(); $sha.Dispose() }
