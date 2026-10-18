$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts/usb-hello-signature-test.cs'
$exe=Join-Path $root 'artifacts/usb-hello-signature-test.exe'
@'
using System;class Test{[STAThread]static int Main(){if(UsbHelloSignature.PublicKeyBlobTypeName!="Windows.Security.Cryptography.Core.CryptographicPublicKeyBlobType")return 5;if(UsbHelloSignature.ValidPayload(null)||UsbHelloSignature.ValidPayload(new byte[1025])||!UsbHelloSignature.ValidPayload(new byte[512]))return 1;var result=UsbHelloSignature.SignExisting(IntPtr.Zero,new byte[32]).GetAwaiter().GetResult();if(result.State!="unavailable"||result.Signature!=null)return 2;var cancelled=UsbHelloSignature.Finish("cancelled",new byte[276],new byte[256]);if(cancelled.Signature!=null||cancelled.PublicKey!=null)return 3;var malformed=UsbHelloSignature.Finish("signed",new byte[10],new byte[1]);if(malformed.State!="unavailable"||malformed.Signature!=null)return 4;Console.WriteLine("Hello reflection projection available: "+UsbHelloSignature.ProjectionAvailable());Console.WriteLine("Hello adapter payload/window/failure redaction PASS; no enrollment or live signing.");return 0;}}
'@|Set-Content $source
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 ('/out:'+$exe) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $source (Join-Path $root 'apps/desktop/UsbHelloSignature.cs')
if($LASTEXITCODE -ne 0){throw 'Hello signature adapter build failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Hello signature adapter regressions failed'}
