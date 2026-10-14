$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Add-Type -Path (Join-Path $root 'apps/desktop/UsbConnectorEvidence.cs')
function Check($expected,$bytes,$port,$returned){if([UsbConnectorEvidence]::Parse($bytes,$port,$returned) -ne $expected){throw "Connector parser expected $expected"}}
$b=New-Object byte[] 18
[BitConverter]::GetBytes([uint32]2).CopyTo($b,0)
[BitConverter]::GetBytes([uint32]18).CopyTo($b,4)
Check 'internal_port_candidate' $b 2 18
$b[8]=1; Check 'user_connectable' $b 2 18
Check 'unresolved' $b 3 18
Check 'unresolved' $b 2 17
$b[8]=16; Check 'unresolved' $b 2 18
$b[8]=4; Check 'unresolved' $b 2 18
$b[8]=0;$b[14]=1; Check 'unresolved' $b 2 18
$b[14]=0;$b[4]=19; Check 'unresolved' $b 2 18
Check 'unresolved' $null 2 18
Write-Output 'Connector identity/length/flags/companion refusal regressions PASS.'
