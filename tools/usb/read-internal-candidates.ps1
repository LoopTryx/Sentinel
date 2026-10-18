param([string]$OutputPath)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if(-not ('UsbInternalDetection' -as [type])){Add-Type -Path (Join-Path $repo 'apps\desktop\UsbInternalDetection.cs')}
$clock=[Diagnostics.Stopwatch]::StartNew()
$rows=@();$partial=$false
try{
 $devices=@(Get-PnpDevice -PresentOnly -Class Keyboard,Mouse,HIDClass -ErrorAction Stop | Select-Object -First 129)
 if($devices.Count -gt 128){$partial=$true;$devices=$devices[0..127]}
 foreach($device in $devices){
  if($clock.ElapsedMilliseconds -ge 15000){$partial=$true;break}
  $result=[UsbInternalDetection]::ReadForInstance($device.InstanceId,[string]$device.Class)
  $rows+=[pscustomobject]@{reference=('candidate-'+($rows.Count+1));deviceClass=$device.Class;state=$result.State;role=$result.Role;evidence=$result.Evidence;exemptionVerified=$false}
 }
 $result=[ordered]@{capturedAtUtc=[DateTime]::UtcNow.ToString('o');mode='automatic_metadata_candidates';state=if($partial){'partial'}else{'observed'};policyChanged=$false;exemptionVerified=$false;inputEntries=$rows.Count;devices=$rows}
}catch{$result=[ordered]@{mode='automatic_metadata_candidates';state='unavailable';policyChanged=$false;exemptionVerified=$false;devices=@()}}
$json=$result|ConvertTo-Json -Depth 5
if($OutputPath){$json|Set-Content -LiteralPath $OutputPath}else{$json}
