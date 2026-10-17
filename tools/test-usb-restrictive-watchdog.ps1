param([switch]$Hang)
$ErrorActionPreference='Stop'
$output=@(& (Join-Path $PSScriptRoot 'test-usb-recovery-process.ps1') -Restrictive -Hang:$Hang)
$output|Write-Output
if(-not ($output -match 'independent watchdog preserved restrictive baseline')){
 throw 'Restrictive crash recovery was not demonstrated; empty-policy recovery is insufficient.'
}
if($Hang -and -not ($output -match 'simulated hang')){throw 'Hung-broker recovery was not demonstrated.'}
