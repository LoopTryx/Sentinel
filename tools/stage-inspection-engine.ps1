param(
 [Parameter(Mandatory=$true)][string]$EnginePath,
 [string]$StripToolPath
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$source=(Resolve-Path -LiteralPath $EnginePath).Path
if($source -match '^(?i:E:|\\\\)' -or -not(Test-Path -LiteralPath $source -PathType Leaf)){throw 'Select an owned locally built inspection executable.'}
$output=Join-Path $repo 'apps\desktop\console-build'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$destination=Join-Path $output 'sentinel-inspect.exe'
if($source -eq $destination){throw 'Stage from a separate build output.'}
# Never alter the compiler output. Stripping applies only to this staging copy.
Copy-Item -LiteralPath $source -Destination $destination -Force
if($StripToolPath){
 $strip=(Resolve-Path -LiteralPath $StripToolPath).Path
 & $strip '--strip-debug' $destination
 if($LASTEXITCODE -ne 0){throw 'Inspection staging strip failed.'}
}
$receipt=[pscustomobject]@{
 executable='sentinel-inspect.exe'
 sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
 bytes=(Get-Item -LiteralPath $destination).Length
 sourceSha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'inspection-engine.json') -Encoding utf8
Write-Output $receipt
