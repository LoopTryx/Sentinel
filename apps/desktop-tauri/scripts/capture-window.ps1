# Capture the primary screen (Sentinel console window evidence).
# Usage: powershell -NoProfile -File capture-window.ps1 <out.png>
# Read-only screen capture; no secrets should be visible when demoing.
param([Parameter(Mandatory = $true)][string]$OutPath)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "saved $OutPath"
