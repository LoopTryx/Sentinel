function Convert-SentinelAuth([string]$Value){
 if($Value -match 'WPA3'){return 'wpa3'}if($Value -match 'WPA2'){return 'wpa2'}if($Value -match 'WEP'){return 'wep'}if($Value -match '^(Open|None)$'){return 'open'}return 'unknown'
}
function Read-SentinelNearby([string[]]$Lines){
 $result=[Collections.Generic.List[object]]::new();$ssid='';$security='unknown';$row=$null
 foreach($line in $Lines){
  if($line -match '^\s*SSID\s+\d+\s*:\s*(.*)$'){if($null -ne $row){$result.Add($row);$row=$null};$ssid=$Matches[1].Trim();$security='unknown'}
  elseif($line -match '^\s*Authentication\s*:\s*(.*)$'){$security=Convert-SentinelAuth $Matches[1].Trim()}
  elseif($line -match '^\s*BSSID\s+\d+\s*:\s*([a-fA-F0-9:]{17})\s*$'){if($null -ne $row){$result.Add($row)};$row=@{ssid=$ssid;bssid=$Matches[1].ToLowerInvariant();security=$security;channel=0;signal=0}}
  elseif($null -ne $row -and $line -match '^\s*Signal\s*:\s*(\d+)%'){$row.signal=[int]$Matches[1]}
  elseif($null -ne $row -and $line -match '^\s*Channel\s*:\s*(\d+)'){$row.channel=[int]$Matches[1]}
  if($result.Count -ge 32){break}
 }
 if($null -ne $row -and $result.Count -lt 32){$result.Add($row)}
 return $result.ToArray()
}
function Get-SentinelTopology {
 $result=@{version=1;wifiStatus='unavailable';connectedSsid='';networks=@();gatewayIp='';gatewayMac='';interfaceIndex=0;neighbors=@();dns=@();hostsHash='';proxyHash='';internet='unknown'}
 try{
  $netsh=Join-Path $env:SystemRoot 'System32/netsh.exe'
  $lines=& $netsh wlan show interfaces 2>$null
  foreach($line in $lines){if($line -match '^\s*SSID\s*:\s*(.+)$'){$result.connectedSsid=$Matches[1].Trim()}}
  $result.networks=@(Read-SentinelNearby -Lines @(& $netsh wlan show networks mode=bssid 2>$null))
  if($result.connectedSsid -or $result.networks.Count){$result.wifiStatus='available'}
 }catch{}
 try{
  $route=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | Sort-Object RouteMetric | Select-Object -First 1
  if($route){$result.gatewayIp=[string]$route.NextHop;$result.interfaceIndex=[int]$route.InterfaceIndex
   $neighbors=@(Get-NetNeighbor -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop | Where-Object {$_.State -notin @('Unreachable','Incomplete')} | Select-Object -First 64)
   $result.neighbors=@($neighbors | ForEach-Object {@{ip=[string]$_.IPAddress;mac=([string]$_.LinkLayerAddress).Replace('-',':').ToLowerInvariant()}})
   $gateway=$neighbors | Where-Object {$_.IPAddress -eq $route.NextHop} | Select-Object -First 1
   if($gateway){$result.gatewayMac=([string]$gateway.LinkLayerAddress).Replace('-',':').ToLowerInvariant()}
   $profile=Get-NetConnectionProfile -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop | Select-Object -First 1
   $result.internet=if([string]$profile.IPv4Connectivity -eq 'Internet'){'internet'}else{'limited'}
  }
 }catch{}
 try{$result.dns=@(Get-DnsClientServerAddress -ErrorAction Stop | ForEach-Object {$_.ServerAddresses} | Sort-Object -Unique | Select-Object -First 16)}catch{}
 try{$result.hostsHash=(Get-FileHash -LiteralPath (Join-Path $env:SystemRoot 'System32/drivers/etc/hosts') -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()}catch{}
 try{$proxy=Get-ItemProperty -LiteralPath 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings' -ErrorAction Stop;$hash=[Security.Cryptography.SHA256]::Create();try{$result.proxyHash=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes(([string]$proxy.ProxyEnable)+'|'+([string]$proxy.ProxyServer)+'|'+([string]$proxy.ProxyOverride)))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}}catch{}
 return $result
}
