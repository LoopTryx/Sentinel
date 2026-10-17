using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;

// Native-only authority. No renderer-supplied IDs, clocks or verification Booleans.
// A permit still requires broker revalidation and measured containment; it is not a hold.
internal sealed class UsbApprovalBinding {
 internal enum Action { Enroll, AllowInput }
 internal sealed class Connection {internal readonly string Subject,Capabilities;internal readonly long Generation;internal readonly UsbApprovalBinding Owner;internal Connection(UsbApprovalBinding owner,string subject,string capabilities,long generation){Owner=owner;Subject=subject;Capabilities=capabilities;Generation=generation;}}
 internal sealed class Permit {internal readonly Connection Connection;internal readonly Action Operation;internal readonly long Issued,Expires;internal bool Used;internal Permit(Connection connection,Action action,long issued){Connection=connection;Operation=action;Issued=issued;Expires=checked(issued+5000);}}
 readonly object sync=new object();readonly Dictionary<string,Connection> connections=new Dictionary<string,Connection>(StringComparer.OrdinalIgnoreCase);readonly Func<long> clock;long serial,last;bool busy,failed;
 internal UsbApprovalBinding(){var watch=Stopwatch.StartNew();clock=()=>watch.ElapsedMilliseconds;}
 internal UsbApprovalBinding(Func<long> nativeClock){if(nativeClock==null)throw new ArgumentNullException("nativeClock");clock=nativeClock;}
 bool Time(out long now){now=clock();if(now<0||now<last){failed=true;connections.Clear();return false;}last=now;return !failed;}
 bool Current(Connection connection){Connection current;return connection!=null&&connection.Owner==this&&connections.TryGetValue(connection.Subject,out current)&&object.ReferenceEquals(current,connection);}
 internal Connection Attach(string subject,string capabilities){lock(sync){long now;if(!Time(out now)||string.IsNullOrEmpty(subject)||subject.Length>512||subject.IndexOf('\0')>=0||string.IsNullOrEmpty(capabilities)||capabilities.Length>128||capabilities.IndexOf('\0')>=0||(!connections.ContainsKey(subject)&&connections.Count>=64)||serial==long.MaxValue)return null;var connection=new Connection(this,subject,capabilities,++serial);connections[subject]=connection;return connection;}}
 internal void Detach(Connection connection){lock(sync){if(Current(connection))connections.Remove(connection.Subject);}}
 // verifier is a trusted native delegate calling Windows Hello, not an IPC argument.
 internal async Task<Permit> Verify(Connection connection,Action operation,Func<Task<bool>> verifier){
  long started;lock(sync){if(!Time(out started)||busy||!Current(connection)||verifier==null||(operation!=Action.Enroll&&operation!=Action.AllowInput))return null;busy=true;}
  try{bool verified;try{verified=await verifier();}catch{return null;}lock(sync){long now;if(!Time(out now)||!verified||!Current(connection)||now-started>=60000)return null;return new Permit(connection,operation,now);}}
  finally{lock(sync){busy=false;}}
 }
 internal bool Consume(Permit permit,Connection connection,Action operation){lock(sync){if(permit==null||permit.Used)return false;permit.Used=true;long now;return Time(out now)&&Current(connection)&&object.ReferenceEquals(permit.Connection,connection)&&permit.Operation==operation&&now>=permit.Issued&&now<permit.Expires;}}
}
