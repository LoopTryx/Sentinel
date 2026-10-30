function Get-SentinelExtensionIdentity {
 param([Parameter(Mandatory=$true)][string]$ManifestPath)
 $manifest=Get-Content -LiteralPath $ManifestPath -Raw|ConvertFrom-Json
 if($manifest.manifest_version -ne 3 -or $manifest.name -ne 'Sentinel Browser Companion' -or $manifest.key -isnot [string] -or $manifest.key.Length -gt 32768){throw 'The packaged Sentinel extension identity is missing or invalid.'}
 try{$bytes=[Convert]::FromBase64String($manifest.key)}catch{throw 'The packaged extension public key is invalid.'}
 if($bytes.Length -lt 32){throw 'The packaged extension public key is invalid.'}
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=$sha.ComputeHash($bytes)}finally{$sha.Dispose()}
 $result=New-Object Text.StringBuilder
 foreach($value in $hash[0..15]){[void]$result.Append([char](97+($value -shr 4)));[void]$result.Append([char](97+($value -band 15)))}
 return $result.ToString()
}
