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
$empty=New-Object byte[] 35
if([UsbConnectorEvidence]::ParseConnection($empty,2,35) -ne 'empty'){throw 'Successful zeroed empty port must be recognized'}
$empty[0]=2;$empty[31]=1
if([UsbConnectorEvidence]::ParseConnection($empty,2,35) -ne 'connected'){throw 'Connected exact port must be recognized'}
$empty[0]=3
if([UsbConnectorEvidence]::ParseConnection($empty,2,35) -ne 'unresolved'){throw 'Wrong connected port accepted'}
$empty[0]=2;$empty[31]=9
if([UsbConnectorEvidence]::ParseConnection($empty,2,35) -ne 'unresolved'){throw 'Enumerating port accepted'}
$empty[31]=0;$empty[4]=1
if([UsbConnectorEvidence]::ParseConnection($empty,2,35) -ne 'unresolved'){throw 'Nonempty disconnected metadata accepted'}
if([UsbConnectorEvidence]::ParseConnection($empty,2,34) -ne 'unresolved'){throw 'Short response accepted'}
$trailing=New-Object byte[] 36;$trailing[35]=1
if([UsbConnectorEvidence]::ParseConnection($trailing,2,36) -ne 'unresolved'){throw 'Trailing disconnected data accepted'}
Write-Output 'Connector identity/length/flags/companion refusal regressions PASS.'
