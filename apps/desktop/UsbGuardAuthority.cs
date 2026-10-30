using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Security.Cryptography;

// Service-internal signature verification. Native enrollment must pin the owner
// public key and authenticate the caller before using this seam. No hold claims.
internal sealed class UsbGuardAuthority:IDisposable {
 internal enum Operation:byte {AllowOnce=1,Enroll=2}
 internal sealed class Caller {internal readonly UsbGuardAuthority Owner;internal readonly byte[] Binding;internal Caller(UsbGuardAuthority owner,byte[] binding){Owner=owner;Binding=binding;}}
 internal sealed class Connection {internal readonly UsbGuardAuthority Owner;internal readonly string Subject,Capabilities;internal readonly long Generation;internal Connection(UsbGuardAuthority owner,string subject,string capabilities,long generation){Owner=owner;Subject=subject;Capabilities=capabilities;Generation=generation;}}
 internal sealed class Challenge {internal readonly Connection Connection;internal readonly Caller Caller;internal readonly Operation Action;internal readonly long Issued,Expires;readonly byte[] payload;internal byte[] Payload{get{return (byte[])payload.Clone();}}internal Challenge(Connection connection,Caller caller,Operation action,long issued,byte[] bytes){Connection=connection;Caller=caller;Action=action;Issued=issued;Expires=checked(issued+60000);payload=bytes;}}
 readonly object sync=new object();readonly Dictionary<string,Connection> connections=new Dictionary<string,Connection>(StringComparer.OrdinalIgnoreCase);readonly Dictionary<Connection,Challenge> challenges=new Dictionary<Connection,Challenge>();readonly Func<long> clock;readonly RSACryptoServiceProvider publicKey;readonly byte[] run=Random(32);long serial,last;bool failed,disposed;
 internal UsbGuardAuthority(byte[] enrolledPublicKey):this(enrolledPublicKey,MonotonicClock()){}
 static Func<long> MonotonicClock(){var watch=Stopwatch.StartNew();return ()=>watch.ElapsedMilliseconds;}
 internal UsbGuardAuthority(byte[] enrolledPublicKey,Func<long> nativeClock){
  if(enrolledPublicKey==null||enrolledPublicKey.Length<20||enrolledPublicKey.Length>1024||enrolledPublicKey[0]!=6||nativeClock==null)throw new ArgumentException("Invalid protected owner public key.");
  publicKey=new RSACryptoServiceProvider();publicKey.PersistKeyInCsp=false;
  try{publicKey.ImportCspBlob((byte[])enrolledPublicKey.Clone());if(!publicKey.PublicOnly||publicKey.KeySize<2048||publicKey.KeySize>4096)throw new ArgumentException("Unsupported owner key.");}catch{publicKey.Dispose();throw;}clock=nativeClock;
 }
 static byte[] Random(int size){var output=new byte[size];using(var random=RandomNumberGenerator.Create())random.GetBytes(output);return output;}
 static byte[] Hash(string value){using(var sha=SHA256.Create())return sha.ComputeHash(Encoding.UTF8.GetBytes(value));}
 static bool Text(string value,int max){if(string.IsNullOrEmpty(value)||value.Length>max)return false;foreach(char c in value)if(char.IsControl(c))return false;return true;}
 bool Time(out long now){now=clock();if(disposed||failed||now<last||now<0||now>long.MaxValue-60000){failed=true;connections.Clear();challenges.Clear();return false;}last=now;return true;}
 bool Current(Connection connection){Connection current;return connection!=null&&connection.Owner==this&&connections.TryGetValue(connection.Subject,out current)&&object.ReferenceEquals(connection,current);}
 // Called only after OS pipe token, PID/session and installed image verification.
 internal Caller BindNativeCaller(string ownerSid,byte[] installedImageHash,uint process,uint session){lock(sync){long now;if(!Time(out now)||!Text(ownerSid,184)||installedImageHash==null||installedImageHash.Length!=32||process==0)return null;using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write(run);writer.Write(Hash(ownerSid));writer.Write(installedImageHash);writer.Write(process);writer.Write(session);writer.Write(Random(32));return new Caller(this,stream.ToArray());}}}
 internal Connection Attach(string subject,string capabilities){lock(sync){long now;if(!Time(out now)||!Text(subject,512)||!Text(capabilities,128)||serial==long.MaxValue||(!connections.ContainsKey(subject)&&connections.Count>=64))return null;Connection prior;if(connections.TryGetValue(subject,out prior))challenges.Remove(prior);var connection=new Connection(this,subject,capabilities,++serial);connections[subject]=connection;return connection;}}
 internal void Detach(Connection connection){lock(sync){if(Current(connection)){connections.Remove(connection.Subject);challenges.Remove(connection);}}}
 internal Challenge Issue(Connection connection,Operation action,Caller caller){lock(sync){long now;if(!Time(out now)||!Current(connection)||caller==null||caller.Owner!=this||(action!=Operation.AllowOnce&&action!=Operation.Enroll))return null;using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write(Encoding.ASCII.GetBytes("SNTUSB-AUTH-v1"));writer.Write(run);writer.Write(Hash(connection.Subject));writer.Write(Hash(connection.Capabilities));writer.Write(connection.Generation);writer.Write(caller.Binding);writer.Write((byte)action);writer.Write(now);writer.Write(now+60000);writer.Write(Random(32));var challenge=new Challenge(connection,caller,action,now,stream.ToArray());challenges[connection]=challenge;return challenge;}}}
 internal bool VerifyAndConsume(Challenge challenge,byte[] signature,Connection connection,Operation action,Caller caller){lock(sync){long now;if(!Time(out now)||challenge==null)return false;Challenge issued;if(!challenges.TryGetValue(challenge.Connection,out issued)||!object.ReferenceEquals(issued,challenge))return false;challenges.Remove(challenge.Connection);if(!Current(connection)||!object.ReferenceEquals(challenge.Connection,connection)||!object.ReferenceEquals(challenge.Caller,caller)||caller==null||caller.Owner!=this||challenge.Action!=action||now<challenge.Issued||now>=challenge.Expires||signature==null||signature.Length!=publicKey.KeySize/8)return false;try{return publicKey.VerifyData(challenge.Payload,"SHA256",(byte[])signature.Clone());}catch(CryptographicException){return false;}}}
 public void Dispose(){lock(sync){if(disposed)return;disposed=true;connections.Clear();challenges.Clear();Array.Clear(run,0,run.Length);publicKey.Dispose();}}
}
