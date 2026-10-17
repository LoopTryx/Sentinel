$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\usb-journal-transport-test.cs'
$exe=Join-Path $root 'artifacts\usb-journal-transport-test.exe'
@'
using System;using System.IO;using System.Threading;using System.Runtime.InteropServices;
public static class Test {
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetEvent(IntPtr handle);
 public static int Main(string[] args){
  if(args.Length>0&&args[0]=="child"){
   using(var journal=UsbJournalTransport.ImportScratch(args[1],args[2])){
    journal.Stream.WriteByte(43);journal.Stream.Flush(true);
    // A child can reuse the excluded numeric handle for its own object. The
    // authoritative assertion is that the parent's actual event stays unsignalled.
    SetEvent(new IntPtr(long.Parse(args[4])));
    if(!SetEvent(new IntPtr(long.Parse(args[3]))))return 13;
    Thread.Sleep(1800);
   }return 0;
  }
  string root=Path.Combine(args[0],"usb-journal-test-"+Guid.NewGuid().ToString("N"));string file=Path.Combine(root,"usb-policy.journal");
  try{
   using(var journal=ProtectedUsbJournal.CreateScratch(root)){
    bool refused=false;try{using(var machine=UsbJournalTransport.StartMachine(journal)){} }catch(IOException){refused=true;}if(!refused)return 6;
    refused=false;try{using(var failed=UsbJournalTransport.StartScratch(journal,typeof(Test).Assembly.Location,root+"-wrong",IntPtr.Zero)){} }catch(IOException){refused=true;}
    if(!refused||journal.Stream==null)return 7;
   }
   File.Delete(file);Directory.Delete(root);
   root=Path.Combine(args[0],"usb-journal-test-"+Guid.NewGuid().ToString("N"));file=Path.Combine(root,"usb-policy.journal");
   using(var unrelated=new EventWaitHandle(false,EventResetMode.ManualReset)){
    UsbJournalTransport.MarkInheritableForTest(unrelated.SafeWaitHandle.DangerousGetHandle());
    using(var journal=ProtectedUsbJournal.CreateScratch(root))
    using(var child=UsbJournalTransport.StartScratch(journal,typeof(Test).Assembly.Location,root,unrelated.SafeWaitHandle.DangerousGetHandle())){
     journal.Dispose();bool refused=false;try{Directory.Move(root,root+"-moved");}catch(IOException){refused=true;}
     if(!refused){Directory.Move(root+"-moved",root);return 2;}
     if(unrelated.WaitOne(0))return 3;
     if(!child.WaitForExit(5000)||child.ExitCode!=0)return 4;
    }
   }
   using(var journal=ProtectedUsbJournal.OpenScratch(root)){if(journal.Stream.ReadByte()!=43)return 5;}
   Console.WriteLine("Explicit handle inheritance, child ACL/path validation, retained ancestry after parent disposal, durable byte handoff, unrelated-handle exclusion, wrong-path child failure cleanup and non-bootstrap machine refusal PASS. Machine broker not launched.");return 0;
  }finally{if(File.Exists(file))File.Delete(file);if(Directory.Exists(root))Directory.Delete(root);}
 }
}
'@ | Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$exe) $source (Join-Path $root 'apps\desktop\ProtectedUsbJournal.cs') (Join-Path $root 'apps\desktop\UsbJournalTransport.cs')
if($LASTEXITCODE -ne 0){throw 'Journal transport test build failed'}
& $exe (Join-Path $root 'artifacts')
if($LASTEXITCODE -ne 0){throw 'Journal transport regressions failed'}
