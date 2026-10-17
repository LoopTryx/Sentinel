$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$nonce=[Guid]::NewGuid().ToString('N')
$probe='SOFTWARE\Sentinel\DuckyProfileProbe\'+$nonce
$source=[IO.File]::ReadAllText((Join-Path $root 'apps/desktop/DuckyPolicyEnrollment.cs')).Replace('SOFTWARE\Sentinel\DuckyProfile',$probe)
$entry=@'
using System;
using System.IO;
using Microsoft.Win32;
class EnrollmentTest {
 static int Main(string[] args){
  string path=@"__PATH__",target=@"USB\VID_0001&PID_0001\TEST",nonce="0123456789abcdef0123456789abcdef";
  try {
   string t,n;
   if(args.Length==0){
    DuckyPolicyEnrollment.Publish(target,nonce);
    if(!DuckyPolicyEnrollment.Read(out t,out n)||t!=target||n!=nonce)throw new Exception("Roundtrip failed");
    DuckyPolicyEnrollment.Publish(target,nonce);
    bool rejected=false;try{DuckyPolicyEnrollment.Publish(@"USB\VID_0002&PID_0002\OTHER",nonce);}catch{rejected=true;}
    if(!rejected)throw new Exception("Profile rebound");
    using(var key=Registry.LocalMachine.OpenSubKey(path,true)){key.DeleteValue("Nonce");key.Flush();}
   }
   if(DuckyPolicyEnrollment.Read(out t,out n))throw new Exception("Partial profile accepted");
   bool refused=false;try{DuckyPolicyEnrollment.Publish(target,nonce);}catch{refused=true;}
   if(!refused)throw new Exception("Partial profile silently repaired");
   using(var key=Registry.LocalMachine.OpenSubKey(path)){if(key.ValueCount!=1)throw new Exception("Partial profile changed");}
   File.WriteAllText(@"__OUT__",args.Length==0?"private_metadata_and_partial_refusal_pass":"restart_partial_refusal_pass");return 0;
  }catch(Exception e){File.WriteAllText(@"__OUT__","FAIL: "+e.GetType().Name+": "+e.Message);return 18;}
 }
}
'@
$out=Join-Path $root 'artifacts/ducky-enrollment-test.txt'
$entry=$entry.Replace('__PATH__',$probe).Replace('__OUT__',$out.Replace('"','""'))
$fixture=Join-Path $root 'artifacts/DuckyEnrollmentFixture.cs';[IO.File]::WriteAllText($fixture,$source+"`n"+$entry)
# C# using directives must precede types; keep the generated fixture in two files.
$sourceFile=Join-Path $root 'artifacts/DuckyEnrollmentProbe.cs';[IO.File]::WriteAllText($sourceFile,$source)
[IO.File]::WriteAllText($fixture,$entry)
$exe=Join-Path $root 'artifacts/DuckyEnrollmentTest.exe'
& (Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe') /nologo /target:exe /platform:x64 ('/out:'+$exe) $sourceFile $fixture
if($LASTEXITCODE -ne 0){throw 'Enrollment probe compile failed'}
foreach($stage in @('initial','restart')){
 $params=@{FilePath=$exe;Verb='RunAs';WindowStyle='Hidden';PassThru=$true};if($stage -eq 'restart'){$params.ArgumentList='restart'}
 $p=Start-Process @params
 if(-not $p.WaitForExit(30000) -or $p.ExitCode -ne 0){throw 'Private enrollment test failed; inspect local artifact'}
}
Get-Content $out
