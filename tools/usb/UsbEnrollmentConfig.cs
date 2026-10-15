using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;

// Persistent enrollment preference, distinct from the timed recovery journal.
// The native broker must authenticate Windows Hello against OwnerSid and verify
// native topology before Commit. No receipt/bool/ID syntax authenticates approval.
public sealed class UsbEnrollmentConfig : IDisposable {
 public sealed class Snapshot {
  public readonly ulong Generation;
  public readonly string OwnerSid;
  readonly string[] internalSafety,approvedExternal;
  public string[] InternalSafety {get{return (string[])internalSafety.Clone();}}
  public string[] ApprovedExternal {get{return (string[])approvedExternal.Clone();}}
  public Snapshot(ulong generation,string ownerSid,string[] verifiedInternalSafety,string[] explicitlyApprovedExternal){
   if(generation==0||ownerSid==null||ownerSid.Length>184)throw Invalid();
   try{var sid=new SecurityIdentifier(ownerSid);if(sid.Value!=ownerSid||!sid.IsAccountSid())throw Invalid();}catch(ArgumentException){throw Invalid();}
   if(verifiedInternalSafety==null||explicitlyApprovedExternal==null||verifiedInternalSafety.Length>32||explicitlyApprovedExternal.Length>32||verifiedInternalSafety.Length+explicitlyApprovedExternal.Length>32)throw Invalid();
   verifiedInternalSafety=(string[])verifiedInternalSafety.Clone();explicitlyApprovedExternal=(string[])explicitlyApprovedExternal.Clone();
   var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);int encoded=9;
   foreach(var group in new[]{verifiedInternalSafety,explicitlyApprovedExternal})foreach(string id in group){ValidateId(id);if(!seen.Add(id))throw Invalid();encoded+=1+id.Length;}
   if(encoded>4072)throw Invalid();
   Generation=generation;OwnerSid=ownerSid;internalSafety=verifiedInternalSafety;approvedExternal=explicitlyApprovedExternal;
  }
 }
 const int Maximum=8+8+1+184+2+4063+32;
 static readonly byte[] Magic=Encoding.ASCII.GetBytes("SNTENR01");
 readonly object sync=new object();
 readonly SentinelPolicyDirectory anchor;
 readonly FileStream exclusive;
 readonly string committedPath,pendingPath;
 bool disposed;
 static InvalidDataException Invalid(){return new InvalidDataException("Enrollment configuration refused.");}
 static void ValidateId(string id){
  if(string.IsNullOrEmpty(id)||id.Length>200)throw Invalid();foreach(char c in id)if(c<33||c>126||"*?/\"<>|".IndexOf(c)>=0)throw Invalid();
  var parts=id.Split('\\');if(parts.Length!=3||Array.Exists(parts,p=>p.Length==0))throw Invalid();
 }
 public static byte[] Encode(Snapshot snapshot){
  if(snapshot==null)throw Invalid();
  using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){
   writer.Write(Magic);writer.Write(snapshot.Generation);byte[] owner=Encoding.ASCII.GetBytes(snapshot.OwnerSid);writer.Write((byte)owner.Length);writer.Write(owner);
   string[] internals=snapshot.InternalSafety,externals=snapshot.ApprovedExternal;writer.Write((byte)internals.Length);writer.Write((byte)externals.Length);
   foreach(var group in new[]{internals,externals})foreach(string id in group){byte[] bytes=Encoding.ASCII.GetBytes(id);writer.Write((byte)bytes.Length);writer.Write(bytes);}
   writer.Flush();using(var sha=SHA256.Create())writer.Write(sha.ComputeHash(memory.ToArray()));writer.Flush();return memory.ToArray();
  }
 }
 public static Snapshot Decode(byte[] bytes){
  if(bytes==null||bytes.Length<8+8+1+1+2+32||bytes.Length>Maximum)throw Invalid();
  using(var sha=SHA256.Create()){byte[] digest=sha.ComputeHash(bytes,0,bytes.Length-32);int different=0;for(int i=0;i<32;i++)different|=digest[i]^bytes[bytes.Length-32+i];if(different!=0)throw Invalid();}
  try{using(var stream=new MemoryStream(bytes,0,bytes.Length-32))using(var reader=new BinaryReader(stream,Encoding.ASCII)){
   for(int i=0;i<8;i++)if(reader.ReadByte()!=Magic[i])throw Invalid();ulong generation=reader.ReadUInt64();int ownerLength=reader.ReadByte();if(ownerLength<1||ownerLength>184)throw Invalid();byte[] rawOwner=reader.ReadBytes(ownerLength);if(rawOwner.Length!=ownerLength||Array.Exists(rawOwner,b=>b>127))throw Invalid();string owner=Encoding.ASCII.GetString(rawOwner);
   int internalCount=reader.ReadByte(),externalCount=reader.ReadByte();if(internalCount+externalCount>32)throw Invalid();var internals=new string[internalCount];var externals=new string[externalCount];
   foreach(var group in new[]{internals,externals})for(int i=0;i<group.Length;i++){int length=reader.ReadByte();if(length<1||length>200)throw Invalid();byte[] raw=reader.ReadBytes(length);if(raw.Length!=length||Array.Exists(raw,b=>b>127))throw Invalid();group[i]=Encoding.ASCII.GetString(raw);}
   if(stream.Position!=stream.Length)throw Invalid();return new Snapshot(generation,owner,internals,externals);
  }}catch(EndOfStreamException){throw Invalid();}
 }
 static FileSecurity Security(){var acl=new FileSecurity();acl.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));acl.SetAccessRuleProtection(true,false);foreach(var sid in new[]{WellKnownSidType.BuiltinAdministratorsSid,WellKnownSidType.LocalSystemSid})acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid,null),FileSystemRights.FullControl,AccessControlType.Allow));return acl;}
 static void Protected(FileSystemSecurity acl){
  var admin=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);var system=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);var owner=acl.GetOwner(typeof(SecurityIdentifier));if(!owner.Equals(admin)&&!owner.Equals(system))throw Invalid();if(!acl.AreAccessRulesProtected)throw Invalid();bool full=false;
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow)continue;if(!rule.IdentityReference.Equals(admin)&&!rule.IdentityReference.Equals(system))throw Invalid();if((rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)full=true;}if(!full)throw Invalid();
 }
 static void NotReparse(string path){if(File.Exists(path)&&(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw Invalid();}
 public UsbEnrollmentConfig(string protectedDirectory){
  if(string.IsNullOrEmpty(protectedDirectory)||!Path.IsPathRooted(protectedDirectory))throw Invalid();
  // Parent retains trusted ancestry pins. This store additionally pins the final
  // protected directory for its entire lifetime; never use a user-writable parent.
  anchor=new SentinelPolicyDirectory(protectedDirectory);
  try{
   Protected(Directory.GetAccessControl(protectedDirectory,AccessControlSections.Owner|AccessControlSections.Access));
   string lockPath=Path.Combine(protectedDirectory,".enrollment.lock");NotReparse(lockPath);
   exclusive=new FileStream(lockPath,FileMode.OpenOrCreate,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,Security());Protected(exclusive.GetAccessControl());
   committedPath=Path.Combine(protectedDirectory,"enrollment.bin");pendingPath=Path.Combine(protectedDirectory,"enrollment.pending");
   ReadCore(committedPath);ReadCore(pendingPath); // Invalid existing bytes never reset or become approvals.
  }catch{if(exclusive!=null)exclusive.Dispose();anchor.Dispose();throw;}
 }
 void Current(){if(disposed)throw new ObjectDisposedException("UsbEnrollmentConfig");}
 byte[] ReadBytes(string path){
  Current();if(!File.Exists(path))return null;NotReparse(path);
  using(var input=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
   Protected(input.GetAccessControl());if(input.Length<1||input.Length>Maximum)throw Invalid();byte[] bytes=new byte[(int)input.Length];int offset=0;while(offset<bytes.Length){int count=input.Read(bytes,offset,bytes.Length-offset);if(count==0)throw Invalid();offset+=count;}return bytes;
  }
 }
 Snapshot ReadCore(string path){byte[] bytes=ReadBytes(path);return bytes==null?null:Decode(bytes);}
 public Snapshot ReadCommitted(){lock(sync){return ReadCore(committedPath);}}
 public Snapshot ReadPending(){lock(sync){return ReadCore(pendingPath);}}
 static bool Same(byte[] a,byte[] b){if(a==null||b==null)return a==null&&b==null;if(a.Length!=b.Length)return false;int different=0;for(int i=0;i<a.Length;i++)different|=a[i]^b[i];return different==0;}
 public void Commit(ulong expectedGeneration,Snapshot next){lock(sync){CommitCore(expectedGeneration,next,0);}}
 // Test-only interruption points execute the real private file protocol; no OS
 // device policy exists here. Not an IPC or renderer-callable operation.
 internal void CommitForTest(ulong expectedGeneration,Snapshot next,int interruption){lock(sync){if(interruption<1||interruption>3)throw Invalid();CommitCore(expectedGeneration,next,interruption);}}
 void CommitCore(ulong expectedGeneration,Snapshot next,int interruption){
  Current();if(next==null||expectedGeneration==ulong.MaxValue||next.Generation!=expectedGeneration+1)throw Invalid();
  byte[] before=ReadBytes(committedPath);Snapshot previous=before==null?null:Decode(before);
  if((previous==null?0:previous.Generation)!=expectedGeneration||previous!=null&&previous.OwnerSid!=next.OwnerSid)throw Invalid();
  if(ReadCore(pendingPath)!=null)throw new IOException("Enrollment staging requires recovery.");
  byte[] bytes=Encode(next);
  using(var output=new FileStream(pendingPath,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,Security())){
   Protected(output.GetAccessControl());if(interruption==1){output.Write(bytes,0,bytes.Length/2);output.Flush(true);throw new IOException("Injected staged interruption.");}
   output.Write(bytes,0,bytes.Length);output.Flush(true);
  }
  if(!Same(bytes,ReadBytes(pendingPath)))throw Invalid();Decode(bytes);
  if(interruption==2)throw new IOException("Injected pre-commit interruption.");
  if(!Same(before,ReadBytes(committedPath)))throw Invalid();
  // File.Replace is the filesystem atomic visibility boundary. Flush(true)
  // precedes it; this does not claim immunity to storage-controller power loss.
  if(before==null)File.Move(pendingPath,committedPath);else File.Replace(pendingPath,committedPath,null);
  if(interruption==3)throw new IOException("Injected post-commit interruption.");
  if(!Same(bytes,ReadBytes(committedPath))||ReadCore(pendingPath)!=null)throw Invalid();
 }
 // Explicitly abort a VALID uncommitted proposal. Never auto-promote pending
 // approvals on startup, and never remove malformed staging behind the owner.
 public void DiscardPending(ulong expectedCommittedGeneration,ulong expectedPendingGeneration){lock(sync){
  Snapshot committed=ReadCore(committedPath),pending=ReadCore(pendingPath);ulong current=committed==null?0:committed.Generation;
  if(current!=expectedCommittedGeneration||pending==null||current==ulong.MaxValue||pending.Generation!=current+1||pending.Generation!=expectedPendingGeneration||committed!=null&&committed.OwnerSid!=pending.OwnerSid)throw Invalid();
  File.Delete(pendingPath);
 }}
 public void Dispose(){lock(sync){if(disposed)return;disposed=true;exclusive.Dispose();anchor.Dispose();}}
}
