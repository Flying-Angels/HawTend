# Windows-only authoring helper. Generated PNG assets are committed; npm build does not need this script.
param([string]$Source = 'src/assets/hawtend-mark.svg')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectDirectory = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectDirectory $Source
if ([System.IO.Path]::GetExtension($sourcePath) -eq '.svg') {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $browserCli = (Get-Command playwright-cli.cmd -ErrorAction Stop).Source
  & $node (Join-Path $PSScriptRoot 'rasterize-brand-svg.mjs') $sourcePath
  if ($LASTEXITCODE -ne 0) { throw 'SVG authoring helper failed.' }
  $rasterStarted = [DateTime]::UtcNow
  $sourcePath = Join-Path $projectDirectory 'public/brand/hawtend-logo-source-1024.png'
  try {
    & $browserCli -s=hawtend-brand-icons open about:blank
    if ($LASTEXITCODE -ne 0) { throw 'Icon browser failed to start.' }
    $renderResult = & $browserCli -s=hawtend-brand-icons run-code --filename (Join-Path $projectDirectory 'output/brand-build/rasterize.js') 2>&1
    if ($LASTEXITCODE -ne 0 -or ($renderResult -join "`n") -match '### Error') { throw "SVG rasterization failed: $renderResult" }
    if (-not (Test-Path -LiteralPath $sourcePath) -or (Get-Item -LiteralPath $sourcePath).LastWriteTimeUtc -lt $rasterStarted) { throw 'SVG raster output was not updated.' }
    Write-Output 'Approved G SVG rasterized at 1024px with transparency.'
  } finally { & $browserCli -s=hawtend-brand-icons close | Out-Null }
}
$image = [System.Drawing.Bitmap]::new($sourcePath)

function Write-BrandIcon([int]$Size, [double]$Scale, [bool]$Opaque, [string]$RelativePath) {
  $targetPath = Join-Path $projectDirectory $RelativePath
  New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
  $canvas = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear($(if ($Opaque) { [System.Drawing.Color]::FromArgb(255, 245, 242, 235) } else { [System.Drawing.Color]::Transparent }))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $extent = [single]($Size * $Scale)
    $ratio = [Math]::Min($extent / $image.Width, $extent / $image.Height)
    $width = [single]($image.Width * $ratio)
    $height = [single]($image.Height * $ratio)
    $rectangle = [System.Drawing.RectangleF]::new(($Size - $width) / 2, ($Size - $height) / 2, $width, $height)
    $graphics.DrawImage($image, $rectangle)
    $canvas.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $canvas.Dispose() }
}

try {
  Write-BrandIcon 128 1 $false 'src/assets/hawtend-mark-128.png'
  Write-BrandIcon 256 1 $false 'public/brand/hawtend-logo-256.png'
  Write-BrandIcon 32 .94 $true 'public/hawtend-favicon-32.png'
  Write-BrandIcon 180 .94 $true 'public/hawtend-apple-touch-180.png'
  Write-BrandIcon 192 .94 $true 'public/hawtend-icon-192.png'
  Write-BrandIcon 512 .94 $true 'public/hawtend-icon-512.png'
  Write-BrandIcon 512 .68 $true 'public/hawtend-maskable-512.png'
  # Desktop icons retain alpha; the paper backgrounds above are only for PWA/Apple icons.
  Write-BrandIcon 16 .94 $false 'public/brand/windows-icon-16.png'
  Write-BrandIcon 32 .94 $false 'public/brand/windows-icon-32.png'
  Write-BrandIcon 48 .94 $false 'public/brand/windows-icon-48.png'
  Write-BrandIcon 256 .94 $false 'public/brand/windows-icon-256.png'
} finally { $image.Dispose() }
Write-Output 'HawTend transparent mark and opaque app icon sizes generated.'
