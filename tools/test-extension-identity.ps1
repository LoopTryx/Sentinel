$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'extension-identity.ps1')
$root=Split-Path $PSScriptRoot -Parent
$identity=Get-Content (Join-Path $PSScriptRoot 'release-extension-key.json') -Raw|ConvertFrom-Json
$actual=Get-SentinelExtensionIdentity (Join-Path $root 'apps/extension/manifest.json')
if($actual -ne $identity.extensionId){throw 'Computed extension identity does not match pinned release key'}
$temp=Join-Path $root 'artifacts/extension-identity-negative.json'
try{
 @{name='Sentinel Browser Companion';manifest_version=3;key='invalid'}|ConvertTo-Json|Set-Content $temp
 $refused=$false;try{Get-SentinelExtensionIdentity $temp|Out-Null}catch{$refused=$true}
 if(-not $refused){throw 'Invalid key accepted'}
}finally{if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp}}
Write-Output 'PASS: packaged public key derives the pinned identity; malformed keys refused. No Chrome profile access or machine settings changed.'
