$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\usb-private-journal-test.cs'
$exe=Join-Path $root 'artifacts\usb-private-journal-test.exe'
@'
using System;using System.IO;using System.Security.AccessControl;using System.Security.Principal;
public static class Test {
 public static int Main(string[] args){string root=Path.Combine(args[0],"usb-journal-test-"+Guid.NewGuid().ToString("N"));string file=Path.Combine(root,"usb-policy.journal");try{
  using(var journal=ProtectedUsbJournal.CreateScratch(root)){journal.Stream.WriteByte(42);journal.Stream.Flush(true);bool refused=false;try{using(var other=ProtectedUsbJournal.OpenScratch(root)){} }catch(IOException){refused=true;}if(!refused)return 1;refused=false;try{Directory.Move(root,root+"-moved");}catch(IOException){refused=true;}if(!refused){Directory.Move(root+"-moved",root);return 2;}}
  using(var journal=ProtectedUsbJournal.OpenScratch(root)){if(journal.Stream.ReadByte()!=42)return 3;}
  var security=Directory.GetAccessControl(root);security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.WorldSid,null),FileSystemRights.ReadAndExecute,InheritanceFlags.None,PropagationFlags.None,AccessControlType.Allow));Directory.SetAccessControl(root,security);
  bool rejected=false;try{using(var journal=ProtectedUsbJournal.OpenScratch(root)){} }catch(IOException){rejected=true;}if(!rejected)return 4;
  File.Delete(file);Directory.Delete(root);
  root=Path.Combine(args[0],"usb-journal-test-"+Guid.NewGuid().ToString("N"));file=Path.Combine(root,"usb-policy.journal");using(var journal=ProtectedUsbJournal.CreateScratch(root)){journal.Stream.SetLength(4141);}
  rejected=false;try{using(var journal=ProtectedUsbJournal.OpenScratch(root)){} }catch(IOException){rejected=true;}if(!rejected)return 5;
  Console.WriteLine("Actual Windows private ACL, exclusive file access, retained-directory rename refusal, broad-ACL refusal and journal bounds PASS. Machine factory not called.");return 0;
 }finally{if(File.Exists(file))File.Delete(file);if(Directory.Exists(root))Directory.Delete(root);}}
}
'@ | Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$exe) $source (Join-Path $root 'apps\desktop\ProtectedUsbJournal.cs')
if($LASTEXITCODE -ne 0){throw 'Private journal test build failed'}
& $exe (Join-Path $root 'artifacts')
if($LASTEXITCODE -ne 0){throw 'Private journal regressions failed'}
