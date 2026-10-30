# Exact enrolled keyboard interface only. No class-wide or wildcard operations.
[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]
param([Parameter(Mandatory=$true)][ValidateSet('Disable','Enable')][string]$Action)
$ErrorActionPreference='Stop'
$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine','Registry64')
try {
 $key=$base.OpenSubKey('SOFTWARE\Sentinel\DuckyProfile')
 if(!$key){throw 'No enrolled Ducky profile. Refusing to select a device by name.'}
 try {$target=$key.GetValue('Target') -as [string];$nonce=$key.GetValue('Nonce') -as [string]} finally {$key.Dispose()}
} finally {$base.Dispose()}
if($target -notmatch '\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z' -or $nonce -notmatch '\A[0-9a-f]{32}\z'){throw 'Invalid enrollment. No device changed.'}
# No /deviceid, /class, /bus, /force, /reboot or wildcard arguments.

$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Open PowerShell as Administrator and rerun this script.'}
. "$PSScriptRoot/rp2040-target.ps1"
$root=$target
$readParent={param($id) (Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_Parent' -ErrorAction Stop).Data}
$target=Resolve-Rp2040Keyboard $root @(Get-PnpDevice -Class Keyboard -ErrorAction Stop) $readParent
# Revalidate ancestry immediately before the requested action.
$device=Get-PnpDevice -InstanceId $target -ErrorAction Stop
$checked=Resolve-Rp2040Keyboard $root @($device) $readParent
if($checked -ine $target){throw 'Device ancestry changed. No device changed.'}
if(!$PSCmdlet.ShouldProcess('The exact enrolled RP2040 keyboard interface',"$Action device")){return}
$verb=if($Action -eq 'Disable'){'/disable-device'}else{'/enable-device'}
& "$env:SystemRoot\System32\pnputil.exe" $verb $target
$result=$LASTEXITCODE
if($result -eq 3010){Write-Warning 'Windows requires a restart to finish the device change.';return}
if($result -eq -536870351){throw 'Windows considers this interface critical and refused. No force override was attempted.'}
if($result -ne 0){throw "Windows device action failed (exit $result)."}
$problem=Get-PnpDeviceProperty -InstanceId $target -KeyName 'DEVPKEY_Device_ProblemCode' -ErrorAction Stop
if($Action -eq 'Disable' -and $problem.Data -eq 22){Write-Output 'Windows reports the enrolled device disabled.'}
elseif($Action -eq 'Enable' -and $problem.Data -eq 0){Write-Output 'Windows reports the enrolled device enabled. Reconnect to retry its startup script.'}
else {throw "Device change not confirmed; Windows problem code $($problem.Data). Existing installation policy may still apply."}
