param()
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing
$source=Join-Path $repo 'assets/brand/sentinel-shield.png'
$image=[Drawing.Image]::FromFile($source)
try {
 $frames=@()
 foreach($size in @(16,24,32,48,64,128,256)) {
  $bitmap=[Drawing.Bitmap]::new($size,$size,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[Drawing.Graphics]::FromImage($bitmap)
  try {
   $graphics.Clear([Drawing.Color]::Transparent)
   $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $graphics.DrawImage($image,0,0,$size,$size)
   $stream=[IO.MemoryStream]::new()
   try {$bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png);$bytes=$stream.ToArray()}finally{$stream.Dispose()}
   $frames+=,@{size=$size;bytes=$bytes}
   $path=Join-Path $repo ('apps/extension/src/assets/brand/sentinel-'+$size+'.png')
   New-Item -ItemType Directory -Path (Split-Path -Parent $path) -Force | Out-Null
   [IO.File]::WriteAllBytes($path,$bytes)
  }finally{$graphics.Dispose();$bitmap.Dispose()}
 }
 $icon=Join-Path $repo 'apps/desktop/assets/sentinel.ico'
 New-Item -ItemType Directory -Path (Split-Path -Parent $icon) -Force | Out-Null
 $writer=[IO.BinaryWriter]::new([IO.File]::Create($icon))
 try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
  $offset=6+16*$frames.Count
  foreach($frame in $frames){$dimension=if($frame.size -eq 256){0}else{$frame.size};$writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.bytes.Length);$writer.Write([uint32]$offset);$offset+=$frame.bytes.Length}
  foreach($frame in $frames){$writer.Write([byte[]]$frame.bytes)}
 }finally{$writer.Dispose()}
 foreach($path in @('apps/ui/src/assets/brand/sentinel.png','apps/ui/public/sentinel.png')){ $target=Join-Path $repo $path;New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null;Copy-Item -LiteralPath $source -Destination $target -Force }
 Write-Output 'Built Sentinel transparent PNG and multi-resolution Windows icon assets.'
}finally{$image.Dispose()}
