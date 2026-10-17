using System;using System.IO;using System.Text;using System.Security.AccessControl;using System.Security.Principal;using System.Security.Cryptography;

// Durable cleanup transition evidence. Not authorization; caller must separately
// authenticate the active operation and independent worker before any OS edit.
internal static class UsbAdmissionCleanupStage {
 internal enum Phase {Missing=-1,Active=0,ReleasePending=1,MarkerDeletionPending=2,FinalCleanupPending=3,VerifiedComplete=4}
 static readonly byte[] Magic=Encoding.ASCII.GetBytes("SNTCLN01");
 const int Payload=8+32+32+64+1,Length=Payload+32;
 static Exception Invalid(){return new InvalidDataException("Cleanup stage refused");}
 static FileSecurity Security(){var security=new FileSecurity();security.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));security.SetAccessRuleProtection(true,false);foreach(var kind in new[]{WellKnownSidType.BuiltinAdministratorsSid,WellKnownSidType.LocalSystemSid})security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(kind,null),FileSystemRights.FullControl,AccessControlType.Allow));return security;}
 static void Protected(FileSystemSecurity security){var admin=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);var system=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);var owner=(SecurityIdentifier)security.GetOwner(typeof(SecurityIdentifier));if(!security.AreAccessRulesProtected||(!owner.Equals(admin)&&!owner.Equals(system)))throw Invalid();bool allowed=false;foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow)continue;if(!rule.IdentityReference.Equals(admin)&&!rule.IdentityReference.Equals(system))throw Invalid();if((rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)allowed=true;}if(!allowed)throw Invalid();}
 static byte[] Encode(UsbAdmissionJournal.Record operation,Phase phase){if(operation==null||phase<Phase.Active||phase>Phase.VerifiedComplete)throw Invalid();using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){writer.Write(Magic);writer.Write(Encoding.ASCII.GetBytes(operation.Nonce));using(var hash=SHA256.Create())writer.Write(hash.ComputeHash(operation.Policy));writer.Write(Encoding.ASCII.GetBytes(operation.TopologyHash));writer.Write((byte)phase);writer.Flush();using(var hash=SHA256.Create())writer.Write(hash.ComputeHash(memory.ToArray()));writer.Flush();return memory.ToArray();}}
 internal static Phase Decode(byte[] bytes,UsbAdmissionJournal.Record operation){if(bytes==null||bytes.Length!=Length||operation==null)throw Invalid();int different=0;using(var hash=SHA256.Create()){var digest=hash.ComputeHash(bytes,0,Payload);for(int i=0;i<32;i++)different|=digest[i]^bytes[Payload+i];}if(different!=0)throw Invalid();var phase=(Phase)bytes[Payload-1];if(phase<Phase.Active||phase>Phase.VerifiedComplete)throw Invalid();byte[] expected=Encode(operation,phase);for(int i=0;i<Length;i++)different|=expected[i]^bytes[i];if(different!=0)throw Invalid();return phase;}
 static FileStream Lock(string directory){string path=Path.Combine(directory,"admission-stage.lock");if(File.Exists(path)&&(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw Invalid();FileStream file;var wait=System.Diagnostics.Stopwatch.StartNew();while(true){try{file=new FileStream(path,FileMode.OpenOrCreate,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,Security());break;}catch(IOException error){int code=error.HResult&65535;if((code!=32&&code!=33)||wait.ElapsedMilliseconds>=2000)throw;System.Threading.Thread.Sleep(20);}}try{Protected(file.GetAccessControl());if(file.Length!=0)throw Invalid();return file;}catch{file.Dispose();throw;}}
 static Phase ReadCore(string directory,UsbAdmissionJournal.Record operation){string path=Path.Combine(directory,"admission-stage.bin");if(!File.Exists(path))return Phase.Missing;if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw Invalid();using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){Protected(file.GetAccessControl());if(file.Length!=Length)throw Invalid();var bytes=new byte[Length];int offset=0;while(offset<bytes.Length){int count=file.Read(bytes,offset,bytes.Length-offset);if(count==0)throw Invalid();offset+=count;}return Decode(bytes,operation);}}
 internal static Phase Read(string directory,UsbAdmissionJournal.Record operation){using(var anchor=new SentinelPolicyDirectory(directory)){Protected(Directory.GetAccessControl(directory));using(var held=Lock(directory))return ReadCore(directory,operation);}}
 internal static void Advance(string directory,UsbAdmissionJournal.Record operation,Phase expected,Phase next){AdvanceCore(directory,operation,expected,next,0);}
 // Caller first verifies producer quiescence and fresh saved/effective cleanup.
 // Retire before clearing the operation journal. If interrupted in between,
 // recovery still has the full operation and must reverify empty policy rather
 // than treating the absent sidecar as permission to arm another operation.
 internal static void RetireVerified(string directory,UsbAdmissionJournal.Record operation){
  using(var anchor=new SentinelPolicyDirectory(directory)){Protected(Directory.GetAccessControl(directory));using(var held=Lock(directory)){
   if(ReadCore(directory,operation)!=Phase.VerifiedComplete)throw Invalid();
   File.Delete(Path.Combine(directory,"admission-stage.bin"));
   if(ReadCore(directory,operation)!=Phase.Missing)throw Invalid();
  }}
 }
 // fail is reachable solely through the disposable test build.
 static void AdvanceCore(string directory,UsbAdmissionJournal.Record operation,Phase expected,Phase next,int fail){if(operation==null||(int)next!=(int)expected+1||next<Phase.Active||next>Phase.VerifiedComplete)throw Invalid();using(var anchor=new SentinelPolicyDirectory(directory)){Protected(Directory.GetAccessControl(directory));using(var held=Lock(directory)){
  if(ReadCore(directory,operation)!=expected)throw Invalid();string path=Path.Combine(directory,"admission-stage.bin"),temporary=Path.Combine(directory,"admission-stage-"+operation.Nonce+".tmp");
  // A same-operation interrupted temporary file is never committed implicitly.
  // The exclusive protected lock serializes replacement; discard only this fixed
  // operation temporary path, refusing reparses or unprotected files first.
  if(File.Exists(temporary)){if((File.GetAttributes(temporary)&FileAttributes.ReparsePoint)!=0)throw Invalid();Protected(File.GetAccessControl(temporary));File.Delete(temporary);}
  byte[] bytes=Encode(operation,next);using(var file=new FileStream(temporary,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,Security())){if(fail==1){file.Write(bytes,0,bytes.Length/2);file.Flush(true);throw new IOException("Injected partial stage write");}file.Write(bytes,0,bytes.Length);file.Flush(true);Protected(file.GetAccessControl());}
  if(fail==2)throw new IOException("Injected before stage replacement");
  if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);
  using(var committed=new FileStream(path,FileMode.Open,FileAccess.ReadWrite,FileShare.Read)){Protected(committed.GetAccessControl());committed.Flush(true);}
  if(ReadCore(directory,operation)!=next)throw Invalid();
 }}}
#if SENTINEL_USB_ADMISSION_TEST
 internal static void TestAdvance(string directory,UsbAdmissionJournal.Record operation,Phase expected,Phase next,int fail){AdvanceCore(directory,operation,expected,next,fail);}
#endif
}
