# Windows-only authoring helper. Generated PNG assets are committed; npm build does not need this script.
param([string]$Source = 'public/brand/hawtend-mascot-v1.png')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectDirectory = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectDirectory $Source
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
  Write-BrandIcon 512 .76 $true 'public/hawtend-maskable-512.png'
} finally { $image.Dispose() }
Write-Output 'HawTend transparent mark and opaque app icon sizes generated.'
