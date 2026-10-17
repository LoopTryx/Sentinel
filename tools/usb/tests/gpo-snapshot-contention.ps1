$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source=Join-Path $root 'artifacts/GpoSnapshotContentionTest.cs'
@'
using System;using System.IO;using System.Reflection;using System.Threading;using System.Security.Cryptography;
class GpoSnapshotContentionTest {
 static int Main(){string path=Path.Combine(Path.GetTempPath(),"SentinelSnapshot-"+Guid.NewGuid().ToString("N")+".bin");byte[] bytes={1,2,3,4};try{
  File.WriteAllBytes(path,bytes);Exception failure=null;string observed=null;var method=typeof(SentinelDuckyLocalGpo).GetMethod("Fingerprint",BindingFlags.NonPublic|BindingFlags.Static);
  var thread=new Thread(()=>{try{observed=(string)method.Invoke(null,new object[]{path});}catch(Exception error){failure=error;}});
  using(var held=new FileStream(path,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){thread.Start();Thread.Sleep(150);if(!thread.IsAlive)throw new Exception("Snapshot did not wait for sharing contention");}
  if(!thread.Join(3000)||failure!=null)throw new Exception("Snapshot sharing recovery failed");using(var hash=SHA256.Create())if(observed!=Convert.ToBase64String(hash.ComputeHash(bytes)))throw new Exception("Snapshot digest changed");
  Console.WriteLine("PASS bounded policy snapshot contention; exact digest preserved; no machine policy touched");return 0;
 }finally{File.Delete(path);}}
}
'@ | Set-Content -LiteralPath $source
$exe=Join-Path $root 'artifacts/GpoSnapshotContentionTest.exe'
& (Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe') /nologo /target:exe /main:GpoSnapshotContentionTest ('/out:'+$exe) $source (Join-Path $root 'tools/usb/DuckyLocalGpo.cs')
if($LASTEXITCODE -ne 0){throw 'Snapshot contention test compilation failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Snapshot contention regression failed'}
