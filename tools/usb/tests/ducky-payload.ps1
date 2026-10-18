$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../targeted-hold-core.ps1')
$source='original reviewed source'
$encoded=New-SentinelNativeRestorePayload $source 'HID\VID_0000&PID_0000\test' 'USB\VID_0000&PID_0000\test'
$source='changed source'
$decoded=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encoded))
$original=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('original reviewed source'))
$changed=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
if(-not $decoded.Contains($original) -or $decoded.Contains($changed)){throw 'Recovery action source changed after capture'}
if($decoded -notmatch 'SentinelDuckyNative.*Enable' -or $decoded -match 'Disable\('){throw 'Recovery exposes disable'}
Write-Output 'Immutable recovery payload PASS; no task or device mutation'
