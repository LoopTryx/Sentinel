. (Join-Path $PSScriptRoot 'watchtower-topology.ps1')
$ErrorActionPreference='Stop'
$domains=@();$connections=@();$dnsStatus='unavailable';$connectionStatus='unavailable'
# Read this device's existing metadata only. No DNS requests, reverse lookup,
# socket connection, packet capture, process command lines or page content.
try {
 $domains=@(Get-DnsClientCache -ErrorAction Stop | Where-Object {$_.Type -in @(1,5,28)} | Select-Object -ExpandProperty Entry -Unique | Select-Object -First 32)
 $dnsStatus='available'
} catch {}
try {
 $connections=@(Get-NetTCPConnection -State Established -ErrorAction Stop | Select-Object -First 32 | ForEach-Object {
  $name='unavailable';try{$name=(Get-Process -Id $_.OwningProcess -ErrorAction Stop).ProcessName}catch{}
  @{address=[string]$_.RemoteAddress;port=[int]$_.RemotePort;process=$name}
 })
 $connectionStatus='available'
} catch {}
@{version=1;dnsStatus=$dnsStatus;connectionStatus=$connectionStatus;domains=$domains;connections=$connections;topology=(Get-SentinelTopology)} | ConvertTo-Json -Depth 6 -Compress
