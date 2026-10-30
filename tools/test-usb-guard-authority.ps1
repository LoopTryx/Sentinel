$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts/usb-guard-authority-test.cs'
$exe=Join-Path $root 'artifacts/usb-guard-authority-test.exe'
@'
using System;using System.Security.Cryptography;using System.Text;
class Test {
 static void Check(bool condition,string message){if(!condition)throw new Exception(message);}
 static int Main(){
  using(var key=new RSACryptoServiceProvider(2048)){key.PersistKeyInCsp=false;long now=100;
   using(var guard=new UsbGuardAuthority(key.ExportCspBlob(false),()=>now)){
    var caller=guard.BindNativeCaller("S-1-5-21-synthetic",new byte[32],123,1);
    var other=guard.BindNativeCaller("S-1-5-21-synthetic",new byte[32],124,1);
    var conn=guard.Attach("PRIVATE-HARDWARE-ID","keyboard");
    Func<UsbGuardAuthority.Challenge,byte[]> sign=c=>key.SignData(c.Payload,"SHA256");
    var proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);
    Check(!Encoding.UTF8.GetString(proof.Payload).Contains("PRIVATE"),"raw subject leaked");
    var copy=proof.Payload;copy[0]^=1;
    Check(guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"valid signature refused");
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"replay accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,other),"wrong caller accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.Enroll,caller),"wrong action accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);var stale=conn;guard.Detach(conn);conn=guard.Attach("PRIVATE-HARDWARE-ID","keyboard");
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"reconnect accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);now+=60000;
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"expired accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);var signature=sign(proof);signature[0]^=1;
    Check(!guard.VerifyAndConsume(proof,signature,conn,UsbGuardAuthority.Operation.AllowOnce,caller),"tampered signature accepted");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);var replaced=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"replaced proof accepted");
    Check(guard.VerifyAndConsume(replaced,sign(replaced),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"replacement signature refused");
    proof=guard.Issue(conn,UsbGuardAuthority.Operation.AllowOnce,caller);now--;
    Check(!guard.VerifyAndConsume(proof,sign(proof),conn,UsbGuardAuthority.Operation.AllowOnce,caller),"clock rollback accepted");
    Check(guard.Attach("new","keyboard")==null,"failed authority revived");
   }
   using(var guard=new UsbGuardAuthority(key.ExportCspBlob(false),()=>100)){
    for(int i=0;i<64;i++)Check(guard.Attach("device"+i,"keyboard")!=null,"capacity prematurely reached");
    Check(guard.Attach("overflow","keyboard")==null,"unbounded devices");
   }
  }
  Console.WriteLine("Signed challenge binding/replay/expiry/reconnect/corruption/capacity/redaction PASS; synthetic RSA keys, not live Hello.");return 0;
 }
}
'@|Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe') /nologo /target:exe /platform:x64 ('/out:'+$exe) $source (Join-Path $root 'apps/desktop/UsbGuardAuthority.cs')
if($LASTEXITCODE -ne 0){throw 'USB signed authority build failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'USB signed authority regressions failed'}
