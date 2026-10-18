. (Join-Path $PSScriptRoot 'watchtower-topology.ps1')
$ErrorActionPreference='Stop'
$domains=@();$dnsAnswers=@();$connections=@();$dnsStatus='unavailable';$connectionStatus='unavailable'
# Read this device's existing metadata only. No DNS requests, reverse lookup,
# socket connection, packet capture, process command lines or page content.
try {
 $cache=@(Get-DnsClientCache -ErrorAction Stop | Select-Object -First 128)
 $domains=@($cache | Where-Object {$_.Type -in @(1,5,28)} | Select-Object -ExpandProperty Entry -Unique | Select-Object -First 32)
 $dnsAnswers=@($cache | Where-Object {$_.Type -eq 1} | Select-Object -ExpandProperty Data -Unique | Select-Object -First 64)
 $dnsStatus='available'
} catch {}
try {
 $connections=@(Get-NetTCPConnection -State Established -ErrorAction Stop | Select-Object -First 32 | ForEach-Object {
  $connection=$_;$name='unavailable';$started='';$created='';try{$process=Get-Process -Id $connection.OwningProcess -ErrorAction Stop;$name=$process.ProcessName;$started=$process.StartTime.ToUniversalTime().ToString('o')}catch{};try{$created=$connection.CreationTime.ToUniversalTime().ToString('o')}catch{}
  @{address=[string]$connection.RemoteAddress;port=[int]$connection.RemotePort;process=$name;pid=[int]$connection.OwningProcess;localPort=[int]$connection.LocalPort;createdAt=$created;processStartedAt=$started}
 })
 $connectionStatus='available'
} catch {}
@{version=1;dnsStatus=$dnsStatus;connectionStatus=$connectionStatus;domains=$domains;dnsAnswers=$dnsAnswers;connections=$connections;topology=(Get-SentinelTopology)} | ConvertTo-Json -Depth 6 -Compress
