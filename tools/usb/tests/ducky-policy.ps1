$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../ducky-policy-core.ps1')
$root='USB\VID_0001&PID_0001\TEST';$nonce='0123456789abcdef0123456789abcdef'
$plan=New-SentinelDuckyPolicyPlan $root $nonce 'Probe'
if($plan.subkey -notlike 'SOFTWARE\Sentinel\DuckyPolicyProbe\*'){throw 'Probe targets live policy'}
$live=New-SentinelDuckyPolicyPlan $root $nonce 'Live'
if($live.subkey -ne 'SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'){throw 'Live path incorrect'}
$payload=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($plan.rollback))
$tokens=$null;$errors=$null
[void][Management.Automation.Language.Parser]::ParseInput($payload,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Rollback payload does not parse'}
try{& ([scriptblock]::Create($payload));throw 'Unqualified rollback executed'}catch{if($_.Exception.Message -notlike 'unqualified_rollback:*'){throw}}
if($plan.activationAvailable -ne $false -or $live.activationAvailable -ne $false){throw 'Unqualified live activation enabled'}
if($payload -notmatch 'Registry64' -or $payload -notmatch 'Ownership mismatch' -or $payload -notmatch 'Target mismatch'){throw 'Rollback identity checks missing'}
if($payload -match 'DenyDeviceClasses|DenyUnspecified|Remove-Item'){throw 'Broad rollback operation'}
foreach($id in @('USB\*','HID\VID_0001&PID_0001\TEST','USB\VID_0001&PID_0001&MI_01\TEST')){
 try{New-SentinelDuckyPolicyPlan $id $nonce 'Live';throw 'Invalid target accepted'}catch{if($_.Exception.Message -eq 'Invalid target accepted'){throw}}
}
foreach($nonceValue in @('', 'abc',(('a'*31)+"'"),(('a'*32)+"`n"))){
 try{New-SentinelDuckyPolicyPlan $root $nonceValue 'Probe';throw 'Invalid nonce accepted'}catch{if($_.Exception.Message -eq 'Invalid nonce accepted'){throw}}
}
Write-Output 'Exact Ducky policy scope/rollback tests PASS; no registry changes'
