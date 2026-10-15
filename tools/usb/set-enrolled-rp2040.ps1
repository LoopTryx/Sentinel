# Exact enrolled physical device only. No class-wide or wildcard operations.
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
if(!$PSCmdlet.ShouldProcess('The exact enrolled RP2040 physical device',"$Action device")){return}
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Open PowerShell as Administrator and rerun this script.'}
$device=Get-PnpDevice -InstanceId $target -ErrorAction Stop
if(@($device).Count -ne 1 -or $device.InstanceId -ine $target){throw 'Exact device identity unavailable. No device changed.'}
$verb=if($Action -eq 'Disable'){'/disable-device'}else{'/enable-device'}
& "$env:SystemRoot\System32\pnputil.exe" $verb $target
$result=$LASTEXITCODE
if($result -eq 3010){Write-Warning 'Windows requires a restart to finish the device change.';return}
if($result -ne 0){throw "Windows device action failed (exit $result)."}
$problem=Get-PnpDeviceProperty -InstanceId $target -KeyName 'DEVPKEY_Device_ProblemCode' -ErrorAction Stop
if($Action -eq 'Disable' -and $problem.Data -eq 22){Write-Output 'Windows reports the enrolled device disabled.'}
elseif($Action -eq 'Enable' -and $problem.Data -eq 0){Write-Output 'Windows reports the enrolled device enabled. Reconnect to retry its startup script.'}
else {throw "Device change not confirmed; Windows problem code $($problem.Data). Existing installation policy may still apply."}

