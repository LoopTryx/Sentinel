param([Parameter(Mandatory = $true)][string]$WebView2SdkPath, [string]$ClamAvDirectory, [string]$DefinitionsDirectory)
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
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$cargo = Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe'
Push-Location $repo
try { & $cargo build -p sentinel-av --bin sentinel-sweep --bin sentinel-protection --bin sentinel-inspect --release --locked --offline; if($LASTEXITCODE -ne 0){throw 'Sentinel scan worker build failed'} } finally { Pop-Location }
$scanWorker=Join-Path $repo 'target/release/sentinel-sweep.exe'
Copy-Item -LiteralPath $scanWorker -Destination $output -Force
$scanPin=Join-Path $output 'sentinel-sweep.sha256'
[IO.File]::WriteAllText($scanPin,(Get-FileHash -LiteralPath $scanWorker -Algorithm SHA256).Hash)
$engineSource=if($ClamAvDirectory){(Resolve-Path -LiteralPath $ClamAvDirectory).Path}else{Join-Path $repo '../clamav-1.5.4/portable/clamav-1.5.4.win.x64'}
$engineOutput=Join-Path $output 'scan-engine'
New-Item -ItemType Directory -Path $engineOutput -Force | Out-Null
foreach($file in Get-ChildItem -LiteralPath $engineSource -File | Where-Object {$_.Extension -eq '.dll' -or $_.Name -in @('freshclam.exe','COPYING.txt')}){Copy-Item -LiteralPath $file.FullName -Destination $engineOutput -Force}
Copy-Item -LiteralPath (Join-Path $engineSource 'certs') -Destination $engineOutput -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repo 'target/release/sentinel-protection.exe') -Destination $engineOutput -Force
Copy-Item -LiteralPath (Join-Path $repo 'target/release/sentinel-inspect.exe') -Destination $output -Force
$definitions=Join-Path $engineOutput 'definitions'
New-Item -ItemType Directory -Path $definitions -Force | Out-Null
$definitionSource=if($DefinitionsDirectory){(Resolve-Path -LiteralPath $DefinitionsDirectory).Path}else{Join-Path $repo 'artifacts/scanner-signatures'}
if(!(Test-Path -LiteralPath $definitionSource)){ $definitionSource=Join-Path $repo '../clamav-1.5.4/databases' }
foreach($file in Get-ChildItem -LiteralPath $definitionSource -File | Where-Object {$_.Extension -in @('.cvd','.sign')}){Copy-Item -LiteralPath $file.FullName -Destination $definitions -Force}
$signatureManifest=Join-Path $output 'signature-runtime.manifest'
$manifest=@(Get-ChildItem -LiteralPath $engineOutput -File -Recurse | Where-Object {$_.Extension -in @('.dll','.exe','.crt')} | ForEach-Object { $_.FullName.Substring($engineOutput.Length+1)+'|'+(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash })
[IO.File]::WriteAllLines($signatureManifest,$manifest)
$references = @($core, $wpf, (Join-Path $framework 'WPF\PresentationFramework.dll'), (Join-Path $framework 'WPF\PresentationCore.dll'), (Join-Path $framework 'WPF\WindowsBase.dll'), (Join-Path $framework 'System.Xaml.dll'), (Join-Path $framework 'System.Drawing.dll'))
$brandIcon=Join-Path $PSScriptRoot 'assets/sentinel.ico'
$arguments = @('/nologo', '/target:winexe', '/platform:x64', ('/out:' + (Join-Path $output 'Sentinel.Glass.exe')))
$arguments += @(('/win32icon:'+$brandIcon), ('/resource:'+$brandIcon+',Sentinel.Brand.ico'))
$references += @((Join-Path $framework 'System.Net.Http.dll'), (Join-Path $framework 'System.Web.Extensions.dll'), (Join-Path $framework 'System.Windows.Forms.dll'))
$arguments += $references | ForEach-Object { "/reference:$_" }
$arguments += '/reference:System.Management.dll'
$arguments += ('/resource:'+$scanPin+',Sentinel.Scan.sha256')
$arguments += ('/resource:'+$signatureManifest+',Sentinel.Signatures.Manifest')
$arguments += Join-Path $PSScriptRoot 'DeviceHealth.cs'
$arguments += Join-Path $PSScriptRoot 'NativeScanPolicy.cs'
$arguments += Join-Path $PSScriptRoot 'NativeScanLease.cs'
$arguments += Join-Path $PSScriptRoot 'WindowsEngineTrust.cs'
$arguments += Join-Path $PSScriptRoot 'NativeProtectionRuntime.cs'
$arguments += Join-Path $PSScriptRoot 'NativeProtectionCoordinator.cs'
$arguments += Join-Path $PSScriptRoot 'GlassConsole.cs'
$arguments += Join-Path $PSScriptRoot 'SentinelNim.cs'
$arguments += Join-Path $PSScriptRoot 'SentinelAiNative.cs'
$arguments += Join-Path $PSScriptRoot 'SentinelAiHistory.cs'
$arguments += Join-Path $PSScriptRoot 'SentinelAiNotification.cs'
$arguments += Join-Path $PSScriptRoot 'AlertSound.cs'
$arguments += Join-Path $PSScriptRoot 'RuntimeReadiness.cs'
$arguments += '/resource:'+(Join-Path $PSScriptRoot '../ui/src/assets/sounds/notification.wav')+',Sentinel.Alert.wav'
$arguments += Join-Path $PSScriptRoot 'HelloStartup.cs'
$arguments += Join-Path $PSScriptRoot 'WindowsVault.cs'
$arguments += '/reference:System.Security.dll'
$arguments += Join-Path $PSScriptRoot 'StoredQuarantine.cs'
$arguments += Join-Path $PSScriptRoot 'DuckyPolicyControl.cs'
$arguments += Join-Path $PSScriptRoot 'DuckyInputHealth.cs'
$arguments += Join-Path $PSScriptRoot 'DuckyPolicyEnrollment.cs'
$arguments += Join-Path $PSScriptRoot 'DuckyPolicyWindow.cs'
$arguments += Join-Path $PSScriptRoot 'NativeSelectionBinding.cs'
$arguments += Join-Path $PSScriptRoot 'VaultApproval.cs'
$arguments += Join-Path $PSScriptRoot 'UsbInputMonitor.cs'
$arguments += Join-Path $PSScriptRoot 'UsbGuardArrival.cs'
$arguments += Join-Path $PSScriptRoot 'UsbGuardPopup.cs'
$arguments += Join-Path $PSScriptRoot 'UsbConnectorEvidence.cs'
$arguments += Join-Path $PSScriptRoot 'UsbInputIdentity.cs'
$arguments += Join-Path $PSScriptRoot 'UsbDeviceInventory.cs'
$arguments += Join-Path $PSScriptRoot 'UsbAdmissionControl.cs'
$arguments += Join-Path $PSScriptRoot 'UsbAdmissionTabPipe.cs'
$arguments += Join-Path $PSScriptRoot 'UsbAdmissionTabModel.cs'
$arguments += Join-Path $PSScriptRoot 'UsbExactBlockCapability.cs'
$arguments += Join-Path $PSScriptRoot 'UsbAdmissionInventory.cs'
$arguments += Join-Path $PSScriptRoot 'UsbInternalDetection.cs'
$arguments += Join-Path $PSScriptRoot '../../tools/usb/UsbAdmissionPreflight.cs'
$arguments += Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyJournal.cs'
$arguments += Join-Path $PSScriptRoot 'UsbApprovalBinding.cs'
$arguments += Join-Path $PSScriptRoot 'UsbOwnerVerification.cs'
$arguments += Join-Path $PSScriptRoot 'ProtectedUsbJournal.cs'
$arguments += '/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')
& (Join-Path $framework 'csc.exe') $arguments
if ($LASTEXITCODE -ne 0) { throw 'GLM glass console build failed' }
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 ('/win32icon:'+$brandIcon) /define:SENTINEL_DUCKY_POLICY_LAB ('/out:'+(Join-Path $output 'Sentinel.DuckyPolicy.exe')) ('/win32manifest:'+(Join-Path $PSScriptRoot 'password-approval.manifest')) ('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')) ('/resource:'+(Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyEntry.cs')+',Sentinel.Ducky.Entry') ('/resource:'+(Join-Path $PSScriptRoot '../../tools/usb/DuckyLocalGpo.cs')+',Sentinel.Ducky.Gpo') (Join-Path $PSScriptRoot 'DuckyPolicyHost.cs') (Join-Path $PSScriptRoot 'DuckyInputHealth.cs') (Join-Path $PSScriptRoot 'DuckyPolicyEnrollment.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyEntry.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyJournal.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyLocalGpo.cs')
if($LASTEXITCODE -ne 0){throw 'Profiled USB policy helper build failed'}
foreach ($file in @($core, $wpf, $loader)) { Copy-Item -LiteralPath $file -Destination $output -Force }
Write-Output ('Built ' + (Join-Path $output 'Sentinel.Glass.exe'))
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 ('/win32icon:'+$brandIcon) ('/out:'+(Join-Path $output 'Sentinel.NativeConnect.exe')) ('/reference:'+(Join-Path $framework 'System.Net.Http.dll')) ('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')) ('/reference:'+(Join-Path $framework 'System.Windows.Forms.dll')) (Join-Path $PSScriptRoot 'NativeConnect.cs') (Join-Path $PSScriptRoot 'BrowserOverview.cs') '/reference:System.Management.dll' (Join-Path $PSScriptRoot 'VaultApproval.cs') (Join-Path $PSScriptRoot 'WindowsVault.cs') (Join-Path $PSScriptRoot 'UsbOwnerVerification.cs') ('/reference:'+(Join-Path $framework 'System.Security.dll')) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) ('/reference:'+(Join-Path $framework 'System.Xaml.dll')) ('/reference:'+(Join-Path $framework 'WPF\WindowsBase.dll')) ('/reference:'+(Join-Path $framework 'WPF\PresentationCore.dll')) ('/reference:'+(Join-Path $framework 'WPF\PresentationFramework.dll'))
if($LASTEXITCODE -ne 0){throw 'Native connection bridge build failed'}
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 ('/win32icon:'+$brandIcon) ('/out:'+(Join-Path $output 'Sentinel.PasswordApproval.exe')) ('/win32manifest:'+(Join-Path $PSScriptRoot 'password-approval.manifest')) (Join-Path $PSScriptRoot 'PasswordApproval.cs')
if($LASTEXITCODE -ne 0){throw 'Password approval helper build failed'}
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 ('/win32icon:'+$brandIcon) ('/out:'+(Join-Path $output 'Sentinel.exe')) ('/reference:'+(Join-Path $framework 'System.Windows.Forms.dll')) (Join-Path $PSScriptRoot 'AppLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Desktop launcher build failed'}
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 ('/win32icon:'+$brandIcon) ('/out:'+(Join-Path $output 'Setup.exe')) ('/reference:'+(Join-Path $framework 'System.Windows.Forms.dll')) (Join-Path $PSScriptRoot 'SetupLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Setup launcher build failed'}
foreach($hostName in @('UsbBootstrap','UsbRecoveryHost')){
 $binary=if($hostName -eq 'UsbBootstrap'){'Sentinel.UsbBootstrap.exe'}else{'Sentinel.UsbBroker.exe'}
 & (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 ('/win32icon:'+$brandIcon) ('/out:'+(Join-Path $output $binary)) ('/win32manifest:'+(Join-Path $PSScriptRoot 'password-approval.manifest')) (Join-Path $PSScriptRoot ($hostName+'.cs')) (Join-Path $PSScriptRoot 'ProtectedUsbJournal.cs') (Join-Path $PSScriptRoot 'UsbJournalTransport.cs')
 if($LASTEXITCODE -ne 0){throw 'USB recovery host build failed'}
}
& (Join-Path $PSScriptRoot '..\..\tools\build-usb-broker.ps1')
