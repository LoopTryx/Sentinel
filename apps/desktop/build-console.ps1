param([Parameter(Mandatory = $true)][string]$WebView2SdkPath)
$ErrorActionPreference = 'Stop'
$sdk = (Resolve-Path -LiteralPath $WebView2SdkPath).Path
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$output = Join-Path $PSScriptRoot 'console-build'
$core = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$wpf = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Wpf.dll'
$loader = Join-Path $sdk 'runtimes\win-x64\native\WebView2Loader.dll'
foreach ($file in @($core, $wpf, $loader)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Required official WebView2 SDK file is missing' }
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
$references = @($core, $wpf, (Join-Path $framework 'WPF\PresentationFramework.dll'), (Join-Path $framework 'WPF\PresentationCore.dll'), (Join-Path $framework 'WPF\WindowsBase.dll'), (Join-Path $framework 'System.Xaml.dll'), (Join-Path $framework 'System.Drawing.dll'))
$arguments = @('/nologo', '/target:winexe', '/platform:x64', ('/out:' + (Join-Path $output 'Sentinel.Glass.exe')))
$references += @((Join-Path $framework 'System.Net.Http.dll'), (Join-Path $framework 'System.Web.Extensions.dll'), (Join-Path $framework 'System.Windows.Forms.dll'))
$arguments += $references | ForEach-Object { "/reference:$_" }
$arguments += Join-Path $PSScriptRoot 'GlassConsole.cs'
& (Join-Path $framework 'csc.exe') $arguments
if ($LASTEXITCODE -ne 0) { throw 'GLM glass console build failed' }
foreach ($file in @($core, $wpf, $loader)) { Copy-Item -LiteralPath $file -Destination $output -Force }
Write-Output ('Built ' + (Join-Path $output 'Sentinel.Glass.exe'))
