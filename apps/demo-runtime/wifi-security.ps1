function Get-SentinelWifiSecurity {
 param([string[]]$Lines)
 $auth=@($Lines|Where-Object {$_ -match '^\s*Authentication\s*:'})
 $cipher=@($Lines|Where-Object {$_ -match '^\s*Cipher\s*:'})
 if($auth.Count -ne 1 -or $cipher.Count -ne 1){return 'unknown'}
 $a=($auth[0]-split ':',2)[1].Trim();$c=($cipher[0]-split ':',2)[1].Trim()
 if($c -match '^WEP'){return 'wep'}
 if($a -eq 'Open' -and $c -eq 'None'){return 'open'}
 if($a -match '^WPA3' -and $c -in @('CCMP','GCMP','GCMP-256','CCMP-256')){return 'wpa3'}
 if($a -match '^WPA2' -and $c -in @('CCMP','GCMP','GCMP-256','CCMP-256','TKIP')){return 'wpa2'}
 return 'unknown'
}
