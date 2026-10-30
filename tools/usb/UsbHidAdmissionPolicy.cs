using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Security.Principal;

// Pure canonical admission decisions. Native authorization, protected storage and
// the authoritative Rust policy compiler remain separate enforcement boundaries.
public static class UsbHidAdmissionPolicy {
 public const int MaximumBytes=32768,MaximumStateBytes=8192,MaximumTransitionBytes=32768;
 public enum Stage:byte {Prepared=0,RecoveryArmed=1,Applied=2,PolicyVerified=3,Committed=4,RecoveryClaimed=128}
 public sealed class Transition { public readonly Request Request; public readonly Stage Phase; public Transition(Request request,Stage phase){if(request==null||!(phase==Stage.Prepared||phase==Stage.RecoveryArmed||phase==Stage.Applied||phase==Stage.PolicyVerified||phase==Stage.Committed||phase==Stage.RecoveryClaimed))throw Bad();Request=request;Phase=phase;} }
 public static bool Same(Snapshot a,Snapshot b){return a==null?b==null:b!=null&&a.Digest==b.Digest&&Encode(a).SequenceEqual(Encode(b));}
 static InvalidDataException Bad(){return new InvalidDataException("HID admission data refused");}
 static void Hex(string s,int n){if(s==null||s.Length!=n||s.Any(c=>!(c>='0'&&c<='9'||c>='a'&&c<='f')))throw Bad();}
 static string Hash(byte[] b){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
 static string[] Ids(string[] ids,int max){if(ids==null||ids.Length>max)throw Bad();var result=ids.Select(s=>{if(s==null)throw Bad();string v=s.ToUpperInvariant();UsbExactBlockState.ValidateId(v);return v;}).OrderBy(s=>s,StringComparer.Ordinal).ToArray();if(result.Distinct(StringComparer.Ordinal).Count()!=result.Length)throw Bad();return result;}
 static bool Equal(string[] a,string[] b){return a.SequenceEqual(b,StringComparer.Ordinal);}
 public sealed class Snapshot {
  public readonly ulong Generation;public readonly string OwnerSid,ReceiptDigest,Digest;public readonly bool Active;readonly string[] safety,approvals;
  public string[] InternalSafety{get{return (string[])safety.Clone();}}public string[] ExternalApprovals{get{return (string[])approvals.Clone();}}
  public Snapshot(ulong generation,string ownerSid,bool active,string[] internalSafety,string[] externalApprovals,string receiptDigest){
   if(generation==0||ownerSid==null||ownerSid.Length>184)throw Bad();try{var sid=new SecurityIdentifier(ownerSid);if(sid.Value!=ownerSid||!sid.IsAccountSid())throw Bad();}catch(ArgumentException){throw Bad();}
   safety=Ids(internalSafety,32);approvals=Ids(externalApprovals,32);if(safety.Length+approvals.Length>32||9+safety.Concat(approvals).Sum(id=>1+id.Length)>4072)throw Bad();if(safety.Length==0||safety.Intersect(approvals,StringComparer.Ordinal).Any())throw Bad();Hex(receiptDigest,64);Generation=generation;OwnerSid=ownerSid;Active=active;ReceiptDigest=receiptDigest;Digest=Hash(Encode(this));
  }
 }
 public sealed class Request {
  public readonly string Action,Nonce,TopologyHash,Digest;public readonly Snapshot Before,After;public readonly DateTime IssuedUtc,RollbackDeadlineUtc;readonly string[] targets;
  public string[] Targets{get{return (string[])targets.Clone();}}
  public Request(string action,Snapshot before,Snapshot after,string[] targetIds,string nonce,string topologyHash,DateTime issuedUtc,DateTime rollbackDeadlineUtc){
   if(before==null||after==null||before.Generation==ulong.MaxValue||after.Generation!=before.Generation+1||before.OwnerSid!=after.OwnerSid||before.ReceiptDigest!=after.ReceiptDigest||!Equal(before.InternalSafety,after.InternalSafety))throw Bad();
   targets=Ids(targetIds,32);Hex(nonce,32);Hex(topologyHash,64);if(issuedUtc.Kind!=DateTimeKind.Utc||rollbackDeadlineUtc.Kind!=DateTimeKind.Utc||rollbackDeadlineUtc<=issuedUtc||rollbackDeadlineUtc-issuedUtc>TimeSpan.FromMinutes(5))throw Bad();
   var expected=new HashSet<string>(before.ExternalApprovals,StringComparer.Ordinal);bool changed=false;
   if(action=="activate"||action=="deactivate"){if(targets.Length!=0||before.Active==after.Active||after.Active!=(action=="activate"))throw Bad();}
   else if(action=="block"||action=="allow"){if(!before.Active||!after.Active||targets.Length==0||targets.Intersect(before.InternalSafety,StringComparer.Ordinal).Any())throw Bad();foreach(string id in targets)changed|=action=="allow"?expected.Add(id):expected.Remove(id);if(!changed)throw Bad();}
   else throw Bad();var sorted=expected.OrderBy(s=>s,StringComparer.Ordinal).ToArray();if(!Equal(sorted,after.ExternalApprovals))throw Bad();
   Action=action;Before=before;After=after;Nonce=nonce;TopologyHash=topologyHash;IssuedUtc=issuedUtc;RollbackDeadlineUtc=rollbackDeadlineUtc;Digest=Hash(Encode(this));
  }
  public void ValidateFresh(Snapshot current,DateTime nowUtc){if(nowUtc.Kind!=DateTimeKind.Utc||nowUtc<IssuedUtc||nowUtc>=RollbackDeadlineUtc||current==null||current.Digest!=Before.Digest)throw Bad();}
 }
 static byte[] Pack(Action<BinaryWriter> write){using(var s=new MemoryStream())using(var w=new BinaryWriter(s,Encoding.UTF8)){write(w);w.Flush();byte[] body=s.ToArray();if(body.Length>MaximumBytes-32)throw Bad();using(var sha=SHA256.Create()){w.Write(sha.ComputeHash(body));w.Flush();return s.ToArray();}}}
 static byte[] Body(byte[] bytes){if(bytes==null||bytes.Length<40||bytes.Length>MaximumBytes)throw Bad();byte[] body=bytes.Take(bytes.Length-32).ToArray();using(var sha=SHA256.Create())if(!sha.ComputeHash(body).SequenceEqual(bytes.Skip(body.Length)))throw Bad();return body;}
 static void Text(BinaryWriter w,string s){byte[] b=Encoding.ASCII.GetBytes(s);if(b.Length<1||b.Length>200)throw Bad();w.Write((ushort)b.Length);w.Write(b);}
 static byte[] Read(BinaryReader r,int n){byte[] b=r.ReadBytes(n);if(b.Length!=n)throw Bad();return b;}
 static string Text(BinaryReader r){int n=r.ReadUInt16();if(n<1||n>200)throw Bad();byte[] b=Read(r,n);if(b.Any(c=>c<33||c>126))throw Bad();return Encoding.ASCII.GetString(b);}
 static void List(BinaryWriter w,string[] ids){w.Write((ushort)ids.Length);foreach(string id in ids)Text(w,id);}
 static string[] List(BinaryReader r,int max){int n=r.ReadUInt16();if(n>max)throw Bad();var a=new string[n];for(int i=0;i<n;i++)a[i]=Text(r);return a;}
 static void Magic(BinaryReader r,string m){if(Encoding.ASCII.GetString(Read(r,8))!=m)throw Bad();}
 public static byte[] Encode(Snapshot s){if(s==null)throw Bad();return Pack(w=>{w.Write(Encoding.ASCII.GetBytes("SNTHID01"));w.Write(s.Generation);Text(w,s.OwnerSid);w.Write((byte)(s.Active?1:0));Text(w,s.ReceiptDigest);List(w,s.InternalSafety);List(w,s.ExternalApprovals);});}
 public static Snapshot Decode(byte[] bytes){try{using(var ms=new MemoryStream(Body(bytes)))using(var r=new BinaryReader(ms)){Magic(r,"SNTHID01");ulong g=r.ReadUInt64();string o=Text(r);byte active=r.ReadByte();if(active>1)throw Bad();string receipt=Text(r);var safety=List(r,32);var approvals=List(r,32);if(ms.Position!=ms.Length)throw Bad();var s=new Snapshot(g,o,active==1,safety,approvals,receipt);if(!Encode(s).SequenceEqual(bytes))throw Bad();return s;}}catch(EndOfStreamException){throw Bad();}catch(ArgumentException){throw Bad();}}
 static void State(BinaryWriter w,Snapshot s){byte[] b=Encode(s);w.Write(b.Length);w.Write(b);}static Snapshot State(BinaryReader r){int n=r.ReadInt32();if(n<40||n>MaximumBytes)throw Bad();return Decode(Read(r,n));}
 public static byte[] Encode(Request q){if(q==null)throw Bad();return Pack(w=>{w.Write(Encoding.ASCII.GetBytes("SNTHIR01"));Text(w,q.Action);Text(w,q.Nonce);Text(w,q.TopologyHash);w.Write(q.IssuedUtc.Ticks);w.Write(q.RollbackDeadlineUtc.Ticks);State(w,q.Before);State(w,q.After);List(w,q.Targets);});}
 public static Request DecodeRequest(byte[] bytes){try{using(var ms=new MemoryStream(Body(bytes)))using(var r=new BinaryReader(ms)){Magic(r,"SNTHIR01");string action=Text(r),nonce=Text(r),topology=Text(r);var issued=new DateTime(r.ReadInt64(),DateTimeKind.Utc);var deadline=new DateTime(r.ReadInt64(),DateTimeKind.Utc);var before=State(r);var after=State(r);var targets=List(r,32);if(ms.Position!=ms.Length)throw Bad();var q=new Request(action,before,after,targets,nonce,topology,issued,deadline);if(!Encode(q).SequenceEqual(bytes))throw Bad();return q;}}catch(EndOfStreamException){throw Bad();}catch(ArgumentException){throw Bad();}}
 // Feed these exact approvals to the existing Rust UsbHid compiler; it owns
 // AllowDenyLayered/AllowInstanceIDs and USB\Class_03 policy layout. Inactive
 // means restore the authenticated original baseline, never invent an empty one.
  public static byte[] Encode(Transition value){if(value==null)throw Bad();byte[] request=Encode(value.Request);return Pack(w=>{w.Write(Encoding.ASCII.GetBytes("SNTHIJ01"));w.Write((byte)value.Phase);w.Write(request.Length);w.Write(request);});}
 public static Transition DecodeTransition(byte[] bytes){try{using(var ms=new MemoryStream(Body(bytes)))using(var r=new BinaryReader(ms)){Magic(r,"SNTHIJ01");Stage phase=(Stage)r.ReadByte();int n=r.ReadInt32();if(n<40||n>MaximumTransitionBytes-45)throw Bad();Request q=DecodeRequest(Read(r,n));if(ms.Position!=ms.Length)throw Bad();var value=new Transition(q,phase);if(!Encode(value).SequenceEqual(bytes))throw Bad();return value;}}catch(EndOfStreamException){throw Bad();}catch(ArgumentException){throw Bad();}}
 public static string[] CompilerApprovals(Snapshot s){if(s==null||!s.Active)throw Bad();return s.InternalSafety.Concat(s.ExternalApprovals).OrderBy(x=>x,StringComparer.Ordinal).ToArray();}
}

