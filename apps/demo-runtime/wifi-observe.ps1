$ErrorActionPreference='Stop'
$result=@{connection='unknown';profile='unknown';security='unknown';gateway='unknown';dns='unknown';vpn='unknown';proxy='unknown'}
try {
 $profiles=@(Get-NetConnectionProfile -ErrorAction Stop)
 if($profiles.Count -eq 0){$result.connection='disconnected'}
 elseif($profiles.Count -eq 1){
  $profile=$profiles[0]
  switch([string]$profile.NetworkCategory){'Public'{$result.profile='public'} 'Private'{$result.profile='private'} 'DomainAuthenticated'{$result.profile='domain'}}
  $adapter=Get-NetAdapter -InterfaceIndex $profile.InterfaceIndex -ErrorAction Stop
  if([int]$adapter.NdisPhysicalMedium -eq 9 -or [int]$adapter.NdisPhysicalMedium -eq 1){$result.connection='wifi'} elseif([int]$adapter.NdisPhysicalMedium -eq 14){$result.connection='ethernet'}
  $routes=@(Get-NetRoute -InterfaceIndex $profile.InterfaceIndex -ErrorAction Stop | Where-Object {$_.DestinationPrefix -in @('0.0.0.0/0','::/0')})
  $result.gateway=if($routes.Count){'configured'}else{'missing'}
  $dns=@(Get-DnsClientServerAddress -InterfaceIndex $profile.InterfaceIndex -ErrorAction Stop | Where-Object {$_.ServerAddresses.Count -gt 0})
  $result.dns=if($dns.Count){'configured'}else{'missing'}
 }
} catch {}
if($result.connection -eq 'wifi'){
 try {
  $wireless=& (Join-Path $env:SystemRoot 'System32\netsh.exe') wlan show interfaces 2>$null
  # Only recognized security fields leave this process. Names, BSSIDs and addresses do not.
  $auth=@($wireless | Where-Object {$_ -match '^\s*Authentication\s*:'})
  if($auth.Count -eq 1){$value=($auth[0] -split ':',2)[1].Trim();if($value -eq 'Open'){$result.security='open'}elseif($value -match '^WPA3'){$result.security='wpa3'}elseif($value -match '^WPA2'){$result.security='wpa2'}elseif($value -eq 'WEP'){$result.security='wep'}}
 } catch {}
}
try {if(@(Get-NetAdapter -ErrorAction Stop | Where-Object {$_.Status -eq 'Up' -and $_.InterfaceDescription -match 'VPN|WireGuard|TAP|TUN'}).Count){$result.vpn='observed'}} catch {}
try {$proxy=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -ErrorAction Stop;$result.proxy=if($proxy.ProxyEnable -eq 1){'configured'}else{'not_configured'}} catch {}
$result | ConvertTo-Json -Compress
