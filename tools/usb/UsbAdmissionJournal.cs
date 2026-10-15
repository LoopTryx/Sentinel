using System;
using System.IO;
using System.Text;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;

// Integrity checksum is corruption detection, not caller authentication. The
// broker must authenticate/enroll callers and retain its parent directory pins.
public sealed class UsbAdmissionJournal : IDisposable {
 public sealed class Record {
  public readonly string Nonce,TopologyHash;
  public readonly DateTime IssuedUtc,DeadlineUtc;
  readonly byte[] policy;
  public byte[] Policy {get{return (byte[])policy.Clone();}}
  public Record(string nonce,DateTime issuedUtc,DateTime deadlineUtc,string topologyHash,byte[] compiledPolicy){
   Hex(nonce,32);Hex(topologyHash,64);
   if(issuedUtc.Kind!=DateTimeKind.Utc||deadlineUtc.Kind!=DateTimeKind.Utc||deadlineUtc<=issuedUtc||(deadlineUtc-issuedUtc).TotalSeconds>300)throw Invalid();
   ValidatePolicy(compiledPolicy);
   Nonce=nonce;IssuedUtc=issuedUtc;DeadlineUtc=deadlineUtc;TopologyHash=topologyHash;policy=(byte[])compiledPolicy.Clone();
  }
  public bool RequiresRecovery(DateTime nowUtc){if(nowUtc.Kind!=DateTimeKind.Utc)throw Invalid();return nowUtc<IssuedUtc||nowUtc>=DeadlineUtc;}
 }
 const int MaxPolicy=4072,Header=8+32+8+8+64+4,MaxRecord=Header+MaxPolicy+32;
 static readonly byte[] Magic=Encoding.ASCII.GetBytes("SNTADM01");
 readonly SentinelPolicyDirectory anchor;
 readonly FileStream file;
 readonly object sync=new object();
 bool disposed;
 static InvalidDataException Invalid(){return new InvalidDataException("Admission journal refused.");}
 static void Hex(string value,int length){if(value==null||value.Length!=length)throw Invalid();foreach(char c in value)if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')))throw Invalid();}
 static void ValidatePolicy(byte[] bytes){
  if(bytes==null||bytes.Length<9||bytes.Length>MaxPolicy||Encoding.ASCII.GetString(bytes,0,8)!="SNTINP03"||bytes[8]<1||bytes[8]>32)throw Invalid();
  int offset=9;var ids=new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
  for(int i=0;i<bytes[8];i++){
   if(offset>=bytes.Length)throw Invalid();int length=bytes[offset++];if(length<1||length>200||length>bytes.Length-offset)throw Invalid();
   for(int j=0;j<length;j++){byte c=bytes[offset+j];if(c<33||c>126||"*?/\"<>|".IndexOf((char)c)>=0)throw Invalid();}
   string id=Encoding.ASCII.GetString(bytes,offset,length);string[] parts=id.Split('\\');if(parts.Length!=3||Array.Exists(parts,p=>p.Length==0)||!ids.Add(id))throw Invalid();offset+=length;
  }
  if(offset!=bytes.Length)throw Invalid();
 }
 // Verify protected owner and DACL even when the parent already checked them.
 static void Protected(FileSystemSecurity security){
  var admin=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);var system=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);
  var owner=(SecurityIdentifier)security.GetOwner(typeof(SecurityIdentifier));if(!owner.Equals(admin)&&!owner.Equals(system))throw Invalid();
  if(!security.AreAccessRulesProtected)throw Invalid();
  bool allowed=false;
  foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow)continue;if(!rule.IdentityReference.Equals(admin)&&!rule.IdentityReference.Equals(system))throw Invalid();if((rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)allowed=true;}
  if(!allowed)throw Invalid();
 }
 public UsbAdmissionJournal(string protectedDirectory){
  if(string.IsNullOrEmpty(protectedDirectory)||!Path.IsPathRooted(protectedDirectory))throw Invalid();
  anchor=new SentinelPolicyDirectory(protectedDirectory);
  try{
   Protected(Directory.GetAccessControl(protectedDirectory,AccessControlSections.Owner|AccessControlSections.Access));
   string path=Path.Combine(protectedDirectory,"admission.bin");
   if(File.Exists(path)&&(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw Invalid();
   var security=new FileSecurity();security.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));security.SetAccessRuleProtection(true,false);
   foreach(var sid in new[]{WellKnownSidType.BuiltinAdministratorsSid,WellKnownSidType.LocalSystemSid})security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid,null),FileSystemRights.FullControl,AccessControlType.Allow));
   file=new FileStream(path,FileMode.OpenOrCreate,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,security);
   Protected(file.GetAccessControl());
   Read(); // Invalid existing state refuses admission; never auto-clear it.
  }catch{if(file!=null)file.Dispose();anchor.Dispose();throw;}
 }
 void Current(){if(disposed)throw new ObjectDisposedException("UsbAdmissionJournal");}
 public Record Read(){lock(sync){return ReadCore();}}
 Record ReadCore(){
  Current();if(file.Length==0)return null;if(file.Length<Header+9+32||file.Length>MaxRecord)throw Invalid();
  byte[] bytes=new byte[(int)file.Length];file.Position=0;int offset=0;while(offset<bytes.Length){int read=file.Read(bytes,offset,bytes.Length-offset);if(read==0)throw Invalid();offset+=read;}
  using(var sha=SHA256.Create()){byte[] digest=sha.ComputeHash(bytes,0,bytes.Length-32);int different=0;for(int i=0;i<32;i++)different|=digest[i]^bytes[bytes.Length-32+i];if(different!=0)throw Invalid();}
  using(var reader=new BinaryReader(new MemoryStream(bytes,0,bytes.Length-32),Encoding.ASCII)){
   for(int i=0;i<8;i++)if(reader.ReadByte()!=Magic[i])throw Invalid();
   string nonce=Encoding.ASCII.GetString(reader.ReadBytes(32));long issued=reader.ReadInt64(),deadline=reader.ReadInt64();string topology=Encoding.ASCII.GetString(reader.ReadBytes(64));int length=reader.ReadInt32();if(length<9||length>MaxPolicy||length!=bytes.Length-Header-32)throw Invalid();
   try{return new Record(nonce,new DateTime(issued,DateTimeKind.Utc),new DateTime(deadline,DateTimeKind.Utc),topology,reader.ReadBytes(length));}catch(ArgumentException){throw Invalid();}
  }
 }
 public void Arm(Record record){lock(sync){ArmCore(record);}}
 void ArmCore(Record record){
  Current();if(record==null)throw Invalid();if(Read()!=null)throw new IOException("Admission operation already recorded.");
  byte[] bytes;using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){
   writer.Write(Magic);writer.Write(Encoding.ASCII.GetBytes(record.Nonce));writer.Write(record.IssuedUtc.Ticks);writer.Write(record.DeadlineUtc.Ticks);writer.Write(Encoding.ASCII.GetBytes(record.TopologyHash));byte[] policy=record.Policy;writer.Write(policy.Length);writer.Write(policy);writer.Flush();using(var sha=SHA256.Create())writer.Write(sha.ComputeHash(memory.ToArray()));writer.Flush();bytes=memory.ToArray();
  }
  file.Position=0;file.Write(bytes,0,bytes.Length);file.SetLength(bytes.Length);file.Flush(true);
  Record verified=Read();if(verified==null||verified.Nonce!=record.Nonce||verified.TopologyHash!=record.TopologyHash||verified.IssuedUtc!=record.IssuedUtc||verified.DeadlineUtc!=record.DeadlineUtc)throw Invalid();
  byte[] expectedPolicy=record.Policy,actualPolicy=verified.Policy;if(expectedPolicy.Length!=actualPolicy.Length)throw Invalid();for(int i=0;i<expectedPolicy.Length;i++)if(expectedPolicy[i]!=actualPolicy[i])throw Invalid();
 }
 // Broker may clear only AFTER it independently verifies restoration. The
 // expected nonce prevents stale callbacks from clearing a newer operation.
 public void ClearAfterVerifiedRestore(string expectedNonce){lock(sync){Current();Hex(expectedNonce,32);Record record=Read();if(record==null)return;if(record.Nonce!=expectedNonce)throw Invalid();file.SetLength(0);file.Flush(true);}}
 public void Dispose(){lock(sync){if(disposed)return;disposed=true;file.Dispose();anchor.Dispose();}}
}
