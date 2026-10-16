. (Join-Path $PSScriptRoot '../../apps/demo-runtime/wifi-security.ps1')
function Assert-Security($lines,$expected){if((Get-SentinelWifiSecurity -Lines $lines) -ne $expected){throw 'Incorrect Wi-Fi security classification'}}
Assert-Security @('Authentication : Open','Cipher : WEP') 'wep'
Assert-Security @('Authentication : Open','Cipher : None') 'open'
Assert-Security @('Authentication : WPA2-Personal','Cipher : CCMP') 'wpa2'
Assert-Security @('Authentication : Open') 'unknown'
Assert-Security @('Authentication : Open','Authentication : WPA2-Personal','Cipher : None') 'unknown'
Assert-Security @('Authentification : Ouvert','Chiffrement : Aucun') 'unknown'
'Wi-Fi security classification: six checks passed.'
