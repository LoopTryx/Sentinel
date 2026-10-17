using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Security.Principal;

// Canonical bounded data only. Providers must separately authenticate native
// callers, protect storage, serialize decisions and verify actual Windows policy.
public static class UsbExactBlockState {
 public const int MaximumStateBytes=8192,MaximumTransitionBytes=32768;
 public enum Stage:byte {Prepared=0,RecoveryArmed=1,Applied=2,PolicyVerified=3,Committed=4,RecoveryClaimed=128}
 public sealed class Snapshot {
  public readonly ulong Generation;public readonly string OwnerSid,Digest;readonly string[] blocked;
  public string[] Blocked {get{return (string[])blocked.Clone();}}
  public Snapshot(ulong generation,string ownerSid,string[] exactBlockedIds){
   if(generation<1)throw Invalid();ValidateOwner(ownerSid);blocked=CanonicalIds(exactBlockedIds,32,true);Generation=generation;OwnerSid=ownerSid;Digest=Hash(Encode(this));
  }
 }
 public sealed class Request {
  public readonly string Action,Nonce,TopologyHash,Digest;public readonly Snapshot Before,After;public readonly DateTime IssuedUtc,RollbackDeadlineUtc;readonly string[] targets;
  public string[] Targets{get{return (string[])targets.Clone();}}
  public Request(string action,Snapshot before,Snapshot after,string[] exactTargetIds,string nonce,string topologyHash,DateTime issuedUtc,DateTime rollbackDeadlineUtc){
   if(action!="block"&&action!="allow"||after==null||before!=null&&(before.Generation==ulong.MaxValue||before.OwnerSid!=after.OwnerSid)||after.Generation!=(before==null?1:before.Generation+1))throw Invalid();
   targets=CanonicalIds(exactTargetIds,8,false);ValidateHex(nonce,32);ValidateHex(topologyHash,64);
   if(issuedUtc.Kind!=DateTimeKind.Utc||rollbackDeadlineUtc.Kind!=DateTimeKind.Utc||rollbackDeadlineUtc<=issuedUtc||(rollbackDeadlineUtc-issuedUtc).TotalSeconds>300)throw Invalid();
   var expected=new HashSet<string>(before==null?new string[0]:before.Blocked,StringComparer.Ordinal);bool changed=false;foreach(string id in targets)changed|=action=="block"?expected.Add(id):expected.Remove(id);
   var sorted=new List<string>(expected);sorted.Sort(StringComparer.Ordinal);if(!changed||!EqualIds(sorted.ToArray(),after.Blocked))throw Invalid();
   Action=action;Before=before;After=after;Nonce=nonce;TopologyHash=topologyHash;IssuedUtc=issuedUtc;RollbackDeadlineUtc=rollbackDeadlineUtc;Digest=Hash(RequestBytes(this));
  }
 }
 public sealed class Transition {
  public readonly Request Request;public readonly Stage Phase;
  public Transition(Request request,Stage phase){if(request==null||!ValidStage(phase))throw Invalid();Request=request;Phase=phase;}
 }
 static InvalidDataException Invalid(){return new InvalidDataException("Exact USB block data refused");}
 static bool ValidStage(Stage value){return value==Stage.Prepared||value==Stage.RecoveryArmed||value==Stage.Applied||value==Stage.PolicyVerified||value==Stage.Committed||value==Stage.RecoveryClaimed;}
 static void ValidateOwner(string value){if(value==null||value.Length>184)throw Invalid();try{var sid=new SecurityIdentifier(value);if(sid.Value!=value||!sid.IsAccountSid())throw Invalid();}catch(ArgumentException){throw Invalid();}}
 public static void ValidateId(string value){if(value==null||value.Length>200||!System.Text.RegularExpressions.Regex.IsMatch(value,@"\AUSB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}(?:&[A-Z0-9_]+)*\\[A-Z0-9_&{}()+.,#-]+\z"))throw Invalid();}
 static string[] CanonicalIds(string[] values,int maximum,bool allowEmpty){if(values==null||values.Length>maximum||!allowEmpty&&values.Length==0)throw Invalid();var result=new List<string>();var seen=new HashSet<string>(StringComparer.Ordinal);int encoded=9;foreach(string raw in values){if(raw==null)throw Invalid();string id=raw.ToUpperInvariant();ValidateId(id);if(!seen.Add(id))throw Invalid();result.Add(id);encoded+=1+id.Length;}if(encoded>4072)throw Invalid();result.Sort(StringComparer.Ordinal);return result.ToArray();}
 static void ValidateHex(string value,int length){if(value==null||value.Length!=length)throw Invalid();foreach(char c in value)if(c<'0'||c>'9'&&c<'a'||c>'f')throw Invalid();}
 static byte[] HexBytes(string value){var bytes=new byte[value.Length/2];for(int i=0;i<bytes.Length;i++)bytes[i]=Convert.ToByte(value.Substring(i*2,2),16);return bytes;}
 static string Hex(byte[] value){return BitConverter.ToString(value).Replace("-","").ToLowerInvariant();}
 static string Hash(byte[] value){using(var sha=SHA256.Create())return Hex(sha.ComputeHash(value));}
 static bool Equal(byte[] a,byte[] b){if(a==null||b==null||a.Length!=b.Length)return false;int different=0;for(int i=0;i<a.Length;i++)different|=a[i]^b[i];return different==0;}
 static bool EqualIds(string[] a,string[] b){if(a.Length!=b.Length)return false;for(int i=0;i<a.Length;i++)if(a[i]!=b[i])return false;return true;}
 public static bool Same(Snapshot a,Snapshot b){return a==null?b==null:b!=null&&a.Digest==b.Digest&&Equal(Encode(a),Encode(b));}
 static void Text(BinaryWriter writer,string value){byte[] bytes=Encoding.ASCII.GetBytes(value);if(bytes.Length<1||bytes.Length>200)throw Invalid();writer.Write((byte)bytes.Length);writer.Write(bytes);}
 static string Text(BinaryReader reader){int length=reader.ReadByte();if(length<1||length>200)throw Invalid();byte[] bytes=Read(reader,length);foreach(byte value in bytes)if(value<33||value>126)throw Invalid();return Encoding.ASCII.GetString(bytes);}
 static void Ids(BinaryWriter writer,string[] ids){writer.Write((byte)ids.Length);foreach(string id in ids)Text(writer,id);}
 static string[] Ids(BinaryReader reader,int maximum){int count=reader.ReadByte();if(count>maximum)throw Invalid();var ids=new string[count];for(int i=0;i<count;i++)ids[i]=Text(reader);return ids;}
 static byte[] Read(BinaryReader reader,int count){byte[] result=reader.ReadBytes(count);if(result.Length!=count)throw Invalid();return result;}
 static void Magic(BinaryReader reader,string magic){if(!Equal(Read(reader,8),Encoding.ASCII.GetBytes(magic)))throw Invalid();}
 static byte[] Checksum(byte[] body,int maximum){if(body.Length>maximum-32)throw Invalid();using(var stream=new MemoryStream()){stream.Write(body,0,body.Length);using(var sha=SHA256.Create()){byte[] digest=sha.ComputeHash(body);stream.Write(digest,0,32);}return stream.ToArray();}}
 static byte[] Body(byte[] bytes,int maximum){if(bytes==null||bytes.Length<40||bytes.Length>maximum)throw Invalid();int length=bytes.Length-32;var body=new byte[length];Buffer.BlockCopy(bytes,0,body,0,length);using(var sha=SHA256.Create()){var expected=sha.ComputeHash(body);int different=0;for(int i=0;i<32;i++)different|=expected[i]^bytes[length+i];if(different!=0)throw Invalid();}return body;}
 public static byte[] Encode(Snapshot value){if(value==null)throw Invalid();using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream,Encoding.ASCII)){writer.Write(Encoding.ASCII.GetBytes("SNTEXB01"));writer.Write(value.Generation);Text(writer,value.OwnerSid);Ids(writer,value.Blocked);writer.Flush();return Checksum(stream.ToArray(),MaximumStateBytes);}}
 public static Snapshot Decode(byte[] bytes){try{byte[] body=Body(bytes,MaximumStateBytes);using(var stream=new MemoryStream(body))using(var reader=new BinaryReader(stream,Encoding.ASCII)){Magic(reader,"SNTEXB01");ulong generation=reader.ReadUInt64();string owner=Text(reader);string[] ids=Ids(reader,32);if(stream.Position!=stream.Length)throw Invalid();var value=new Snapshot(generation,owner,ids);if(!Equal(Encode(value),bytes))throw Invalid();return value;}}catch(EndOfStreamException){throw Invalid();}catch(ArgumentException){throw Invalid();}}
 static void State(BinaryWriter writer,Snapshot value){byte[] bytes=value==null?new byte[0]:Encode(value);writer.Write(bytes.Length);writer.Write(bytes);}
 static Snapshot State(BinaryReader reader,bool required){int length=reader.ReadInt32();if(length==0&&!required)return null;if(length<40||length>MaximumStateBytes)throw Invalid();return Decode(Read(reader,length));}
 static byte[] RequestBytes(Request value){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream,Encoding.ASCII)){writer.Write(Encoding.ASCII.GetBytes("SNTEXR01"));writer.Write((byte)(value.Action=="block"?0:1));writer.Write(HexBytes(value.Nonce));writer.Write(HexBytes(value.TopologyHash));writer.Write(value.IssuedUtc.Ticks);writer.Write(value.RollbackDeadlineUtc.Ticks);State(writer,value.Before);State(writer,value.After);Ids(writer,value.Targets);writer.Flush();return stream.ToArray();}}
 static Request RequestFromBytes(byte[] bytes){using(var stream=new MemoryStream(bytes))using(var reader=new BinaryReader(stream,Encoding.ASCII)){Magic(reader,"SNTEXR01");byte action=reader.ReadByte();if(action>1)throw Invalid();string nonce=Hex(Read(reader,16)),topology=Hex(Read(reader,32));DateTime issued=new DateTime(reader.ReadInt64(),DateTimeKind.Utc),deadline=new DateTime(reader.ReadInt64(),DateTimeKind.Utc);Snapshot before=State(reader,false),after=State(reader,true);string[] targets=Ids(reader,8);if(stream.Position!=stream.Length)throw Invalid();var value=new Request(action==0?"block":"allow",before,after,targets,nonce,topology,issued,deadline);if(!Equal(RequestBytes(value),bytes))throw Invalid();return value;}}
 public static byte[] Encode(Transition value){if(value==null)throw Invalid();byte[] request=RequestBytes(value.Request);using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream,Encoding.ASCII)){writer.Write(Encoding.ASCII.GetBytes("SNTEXJ01"));writer.Write((byte)value.Phase);writer.Write(request.Length);writer.Write(request);writer.Flush();return Checksum(stream.ToArray(),MaximumTransitionBytes);}}
 public static Transition DecodeTransition(byte[] bytes){try{byte[] body=Body(bytes,MaximumTransitionBytes);using(var stream=new MemoryStream(body))using(var reader=new BinaryReader(stream,Encoding.ASCII)){Magic(reader,"SNTEXJ01");Stage phase=(Stage)reader.ReadByte();int length=reader.ReadInt32();if(length<1||length>MaximumTransitionBytes-45)throw Invalid();Request request=RequestFromBytes(Read(reader,length));if(stream.Position!=stream.Length)throw Invalid();var result=new Transition(request,phase);if(!Equal(Encode(result),bytes))throw Invalid();return result;}}catch(EndOfStreamException){throw Invalid();}catch(ArgumentException){throw Invalid();}}
}
