$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot '../targeted-hold.ps1';$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if($errors){throw 'Native helper parse failed'}
$source=@($ast.FindAll({param($a) $a -is [Management.Automation.Language.StringConstantExpressionAst] -and $a.Value.StartsWith('using System;')},$true))
if($source.Count -ne 1){throw 'Expected one native directory helper'}
Add-Type -TypeDefinition $source[0].Value
$dir=Join-Path ([IO.Path]::GetTempPath()) ('sentinel-directory-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dir|Out-Null
$handle=$null
try{
 $handle=[SentinelTargetDirectory]::new($dir)
 try{[IO.Directory]::Move($dir,$dir+'-moved');throw 'Directory moved while anchored'}catch{if($_.Exception.Message -eq 'Directory moved while anchored'){throw}}
 $handle.Dispose();$handle=$null
 [IO.Directory]::Move($dir,$dir+'-moved');$dir=$dir+'-moved'
 Write-Output 'Native directory compile and retained rename refusal PASS; no device mutation'
}finally{if($handle){$handle.Dispose()};if([IO.Directory]::Exists($dir)){[IO.Directory]::Delete($dir)};if([IO.Directory]::Exists($dir+'-moved')){[IO.Directory]::Delete($dir+'-moved')}}

