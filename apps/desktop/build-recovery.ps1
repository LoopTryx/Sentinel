param([Parameter(Mandatory = $true)][string]$WebView2SdkPath, [string]$SignatureManifestPath)
$ErrorActionPreference = 'Stop'
$sdk = (Resolve-Path -LiteralPath $WebView2SdkPath).Path
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$output = Join-Path $PSScriptRoot 'console-build'
$core = Join-Path $sdk 'Microsoft.Web.WebView2.Core.dll'
$wpf = Join-Path $sdk 'Microsoft.Web.WebView2.Wpf.dll'
$loader = Join-Path $sdk 'WebView2Loader.dll'
foreach ($file in @($core, $wpf, $loader)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Required official WebView2 SDK file is missing' }
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$cargo = Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe'
$scanPin=Join-Path $output 'sentinel-sweep.sha256'
$signatureManifest=if($SignatureManifestPath){(Resolve-Path -LiteralPath $SignatureManifestPath).Path}else{Join-Path $output 'signature-runtime.manifest'}
$references = @($core, $wpf, (Join-Path $framework 'WPF\PresentationFramework.dll'), (Join-Path $framework 'WPF\PresentationCore.dll'), (Join-Path $framework 'WPF\WindowsBase.dll'), (Join-Path $framework 'System.Xaml.dll'), (Join-Path $framework 'System.Drawing.dll'))
$brandIcon=Join-Path $PSScriptRoot 'assets/sentinel.ico'
$arguments = @('/nologo', '/target:winexe', '/platform:x64', ('/out:' + (Join-Path $output 'Sentinel.Glass.exe')))
$arguments += @(('/win32icon:'+$brandIcon), ('/resource:'+$brandIcon+',Sentinel.Brand.ico'))
$references += @((Join-Path $framework 'System.Net.Http.dll'), (Join-Path $framework 'System.Web.Extensions.dll'), (Join-Path $framework 'System.Windows.Forms.dll'))
$arguments += $references | ForEach-Object { "/reference:$_" }
$arguments += '/reference:System.Management.dll'
$releaseMetadata=Join-Path $output 'ReleaseMetadata.cs'
& (Join-Path $repo 'tools/write-release-metadata.ps1') -OutputPath $releaseMetadata
$arguments += $releaseMetadata
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
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 ('/win32icon:'+$brandIcon) /define:SENTINEL_DUCKY_POLICY_LAB ('/out:'+(Join-Path $output 'Sentinel.DuckyPolicy.exe')) ('/win32manifest:'+(Join-Path $PSScriptRoot 'password-approval.manifest')) ('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')) ('/resource:'+(Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyEntry.cs')+',Sentinel.Ducky.Entry') ('/resource:'+(Join-Path $PSScriptRoot '../../tools/usb/DuckyLocalGpo.cs')+',Sentinel.Ducky.Gpo') (Join-Path $PSScriptRoot 'DuckyPolicyHost.cs') (Join-Path $PSScriptRoot 'DuckyInputHealth.cs') (Join-Path $PSScriptRoot 'DuckyPolicyEnrollment.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyEntry.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyPolicyJournal.cs') (Join-Path $PSScriptRoot '../../tools/usb/DuckyLocalGpo.cs') $releaseMetadata
if($LASTEXITCODE -ne 0){throw 'Profiled USB policy helper build failed'}
