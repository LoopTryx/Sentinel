param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
function Assert-SentinelPlatform([int]$Build,[string]$Architecture,[int]$FrameworkRelease){
 if($Build -lt 19041){throw 'Sentinel requires Windows 10 version 2004 or newer, or Windows 11.'}
 if($Architecture -ne 'AMD64'){throw 'This Sentinel installer contains x64 engines. ARM64 and 32-bit Windows require a separate build.'}
 if($FrameworkRelease -lt 528040){throw 'Install Microsoft .NET Framework 4.8 through Windows Update, restart if requested, then run Sentinel Setup again.'}
}
function Test-SentinelWebView {
 $id='{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
 foreach($key in @("HKCU:\Software\Microsoft\EdgeUpdate\Clients\$id","HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$id","HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$id")){
  $value=(Get-ItemProperty -LiteralPath $key -Name pv -ErrorAction SilentlyContinue).pv
  $version=$null;if([version]::TryParse([string]$value,[ref]$version) -and $version -gt [version]'0.0.0.0'){return $true}
 }
 return $false
}
$arch=if($env:PROCESSOR_ARCHITEW6432){$env:PROCESSOR_ARCHITEW6432}else{$env:PROCESSOR_ARCHITECTURE}
$build=[int](Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name CurrentBuildNumber).CurrentBuildNumber
$framework=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue).Release
Assert-SentinelPlatform $build $arch $framework
$webview=Test-SentinelWebView
if(!$webview -and !$CheckOnly){
 $bootstrap=Join-Path $PSScriptRoot 'runtime\MicrosoftEdgeWebview2Setup.exe'
 if(!(Test-Path -LiteralPath $bootstrap)){throw 'WebView2 is missing. Restore the complete Sentinel package, or install WebView2 from https://developer.microsoft.com/microsoft-edge/webview2/ then retry.'}
 $signature=Get-AuthenticodeSignature -LiteralPath $bootstrap
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(?:^|,\s*)O=Microsoft Corporation(?:,|$)'){throw 'Microsoft WebView2 installer signature could not be verified. No installer was run.'}
 $process=Start-Process -FilePath $bootstrap -ArgumentList '/silent','/install' -WindowStyle Hidden -PassThru
 if(!$process.WaitForExit(300000)){throw 'WebView2 setup is still running. Let it finish, then retry Sentinel Setup.'}
 if($process.ExitCode -notin @(0,3010) -or !(Test-SentinelWebView)){throw 'WebView2 setup could not finish. Check your connection and Windows policies, then retry.'}
 $webview=$true
}
[pscustomobject]@{windowsBuild=$build;architecture=$arch;framework48=$true;webview2=$webview;requiresInternet=(!$webview)}
