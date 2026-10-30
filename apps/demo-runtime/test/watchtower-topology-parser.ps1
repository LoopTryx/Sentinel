$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../watchtower-topology.ps1')
$rows=@(Read-SentinelNearby -Lines @('SSID 1 : Invented Home',' Authentication : WPA2-Personal',' BSSID 1 : 02:00:00:00:00:01',' Signal : 75%',' Channel : 6','SSID 2 : Invented Cafe',' Authentication : Open',' BSSID 1 : 02:00:00:00:00:02',' Signal : 20%',' Channel : 11'))
if($rows.Count -ne 2 -or $rows[0].security -ne 'wpa2' -or $rows[0].signal -ne 75 -or $rows[1].security -ne 'open' -or $rows[1].channel -ne 11){throw 'Recorded netsh parser regression'}
Write-Output 'PASS invented netsh BSSID/security/channel/signal fixtures; no network command executed'
