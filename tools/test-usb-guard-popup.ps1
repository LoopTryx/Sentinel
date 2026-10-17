$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$source=Join-Path $root 'artifacts/usb-popup-test.cs'
$exe=Join-Path $root 'artifacts/usb-popup-test.exe'
@'
using System;using System.Threading.Tasks;
class Test{[STAThread]static int Main(){var notice=UsbGuardNotice.Unavailable("connection-1","Keyboard\nspoof","Keyboard","service_unavailable");if(notice.CanApprove||notice.Status=="Input blocked"||notice.Name.Contains("\n"))return 1;if(notice.ToString().Contains("connection-1"))return 2;if(UsbGuardPopup.ShouldExpire(TimeSpan.FromMilliseconds(4999),false))return 4;if(!UsbGuardPopup.ShouldExpire(TimeSpan.FromSeconds(5),false))return 5;if(UsbGuardPopup.ShouldExpire(TimeSpan.FromMinutes(2),true))return 6;if(!UsbGuardPopup.ShouldExpire(TimeSpan.FromMinutes(2),false))return 7;var window=new UsbGuardPopup(notice,null);if(window.AllowEnabled)return 3;window.Close();Console.WriteLine("Native USB popup five-second expiry/action deferral/status/redaction PASS; no invented blocking.");return 0;}}
'@|Set-Content $source
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 ('/out:'+$exe) ('/reference:'+(Join-Path $framework 'WPF/PresentationFramework.dll')) ('/reference:'+(Join-Path $framework 'WPF/PresentationCore.dll')) ('/reference:'+(Join-Path $framework 'WPF/WindowsBase.dll')) ('/reference:'+(Join-Path $framework 'System.Xaml.dll')) $source (Join-Path $root 'apps/desktop/UsbGuardPopup.cs')
if($LASTEXITCODE -ne 0){throw 'Native USB popup build failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Native USB popup regression failed'}
