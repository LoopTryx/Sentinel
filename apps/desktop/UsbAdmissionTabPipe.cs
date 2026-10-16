using System;using System.IO;using System.IO.Pipes;using System.Text;using System.Threading;using System.Threading.Tasks;using System.Diagnostics;using System.Runtime.InteropServices;using System.Security.Principal;using System.Security.AccessControl;using System.Security.Cryptography;
// Transport only. Native callback retains all Hello, selection and policy authority.
// No payload logging. Root pins the installed server image separately at launch.
internal static class UsbAdmissionTabPipe {
 internal const int MaxPayload=32768,DeadlineMilliseconds=150000;
 static readonly byte[] Magic=Encoding.ASCII.GetBytes("SNTTAB01");
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeClientProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe,out uint id);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe,out uint id);
 internal static void ValidateName(string name){if(!System.Text.RegularExpressions.Regex.IsMatch(name??"",@"\Asentinel-usb-tab-[0-9a-f]{32}\z"))throw new InvalidOperationException("USB tab pipe name refused");}
 internal static void ValidatePeer(int expectedPid,long expectedStart,int expectedSession,int actualPid,long actualStart,int actualSession){if(expectedPid<1||expectedStart<1||expectedSession<0||actualPid!=expectedPid||actualStart!=expectedStart||actualSession!=expectedSession)throw new InvalidOperationException("USB tab pipe peer refused");}
 static void Peer(PipeStream pipe,bool clientSide,int expectedPid,long expectedStart,int session){uint id;if(!(clientSide?GetNamedPipeServerProcessId(pipe.SafePipeHandle,out id):GetNamedPipeClientProcessId(pipe.SafePipeHandle,out id))||id>int.MaxValue)throw new InvalidOperationException("USB tab pipe identity unavailable");using(var process=Process.GetProcessById((int)id))ValidatePeer(expectedPid,expectedStart,session,process.Id,process.StartTime.ToUniversalTime().Ticks,process.SessionId);}
 static byte[] Payload(string value){if(value==null||value.Length>MaxPayload)throw new InvalidOperationException("USB tab payload refused");int count=Utf8.GetByteCount(value);if(count<1||count>MaxPayload)throw new InvalidOperationException("USB tab payload bound");return Utf8.GetBytes(value);}
 static bool Equal(byte[] first,byte[] second){if(first==null||second==null||first.Length!=second.Length)return false;int different=0;for(int i=0;i<first.Length;i++)different|=first[i]^second[i];return different==0;}
 static void Nonce(byte[] nonce){if(nonce==null||nonce.Length!=16)throw new InvalidOperationException("USB tab nonce refused");int nonzero=0;foreach(byte value in nonce)nonzero|=value;if(nonzero==0)throw new InvalidOperationException("USB tab nonce refused");}
 internal static byte[] Encode(string value,byte[] nonce){Nonce(nonce);byte[] body=Payload(value);var frame=new byte[28+body.Length];Buffer.BlockCopy(Magic,0,frame,0,8);Buffer.BlockCopy(nonce,0,frame,8,16);int length=body.Length;for(int i=0;i<4;i++)frame[24+i]=(byte)(length>>(8*i));Buffer.BlockCopy(body,0,frame,28,length);return frame;}
 static int Header(byte[] header,out byte[] nonce){if(header==null||header.Length!=28)throw new InvalidOperationException("USB tab frame refused");int different=0;for(int i=0;i<8;i++)different|=header[i]^Magic[i];if(different!=0)throw new InvalidOperationException("USB tab frame refused");uint length=0;for(int i=0;i<4;i++)length|=(uint)header[24+i]<<(8*i);if(length<1||length>MaxPayload)throw new InvalidOperationException("USB tab frame bound");nonce=new byte[16];Buffer.BlockCopy(header,8,nonce,0,16);Nonce(nonce);return (int)length;}
 internal static string Decode(byte[] frame,byte[] expectedNonce){if(frame==null||frame.Length<29||frame.Length>28+MaxPayload)throw new InvalidOperationException("USB tab frame bound");var header=new byte[28];Buffer.BlockCopy(frame,0,header,0,28);byte[] nonce;int length=Header(header,out nonce);if(frame.Length!=28+length||(expectedNonce!=null&&!Equal(nonce,expectedNonce)))throw new InvalidOperationException("USB tab reply refused");return Utf8.GetString(frame,28,length);}
 static async Task Exact(Stream stream,byte[] buffer,CancellationToken token){int offset=0;while(offset<buffer.Length){int count=await stream.ReadAsync(buffer,offset,buffer.Length-offset,token).ConfigureAwait(false);if(count<1)throw new EndOfStreamException("USB tab frame incomplete");offset+=count;}}
 sealed class Received{internal string Value;internal byte[] Nonce;}
 static async Task<Received> Read(Stream stream,byte[] expected,CancellationToken token){var header=new byte[28];await Exact(stream,header,token).ConfigureAwait(false);byte[] nonce;int length=Header(header,out nonce);if(expected!=null&&!Equal(nonce,expected))throw new InvalidOperationException("USB tab reply refused");var body=new byte[length];await Exact(stream,body,token).ConfigureAwait(false);return new Received{Value=Utf8.GetString(body),Nonce=nonce};}
 static async Task Write(Stream stream,string value,byte[] nonce,CancellationToken token){byte[] frame=Encode(value,nonce);await stream.WriteAsync(frame,0,frame.Length,token).ConfigureAwait(false);await stream.FlushAsync(token).ConfigureAwait(false);}
 static PipeSecurity Security(){var security=new PipeSecurity();var owner=WindowsIdentity.GetCurrent().User;if(owner==null)throw new InvalidOperationException("USB tab owner unavailable");security.SetOwner(owner);security.SetAccessRuleProtection(true,false);security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid,null),PipeAccessRights.FullControl,AccessControlType.Deny));foreach(var sid in new[]{owner,new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null)})security.AddAccessRule(new PipeAccessRule(sid,PipeAccessRights.FullControl,AccessControlType.Allow));return security;}
 internal sealed class Server {
  readonly string name;readonly int hostPid,session;readonly long hostStart;int serving;
  internal Server(string pipeName,int expectedHostPid,long expectedHostStartUtcTicks){ValidateName(pipeName);if(expectedHostPid<1||expectedHostStartUtcTicks<1)throw new ArgumentException("USB tab host required");name=pipeName;hostPid=expectedHostPid;hostStart=expectedHostStartUtcTicks;session=Process.GetCurrentProcess().SessionId;}
  // One request per connection, serial across connections. Cancellation/timeout
  // discards late replies; callback must independently retain recovery and honor
  // its native operation lifetime. This layer never authorizes an operation.
  bool HostAlive(){try{using(var host=Process.GetProcessById(hostPid)){ValidatePeer(hostPid,hostStart,session,host.Id,host.StartTime.ToUniversalTime().Ticks,host.SessionId);return !host.HasExited;}}catch{return false;}}
  internal async Task Serve(Func<string,Task<string>> callback,CancellationToken token){
   if(callback==null)throw new ArgumentNullException("callback");if(Interlocked.CompareExchange(ref serving,1,0)!=0)throw new InvalidOperationException("USB tab server already serving");
   // Correlation replay cache is bounded, and is never owner authorization.
   var used=new System.Collections.Generic.HashSet<string>(StringComparer.Ordinal);int refusals=0;
   try{while(!token.IsCancellationRequested&&HostAlive()){
    Task<string> action=null;bool pause=false;
    try{using(var pipe=new NamedPipeServerStream(name,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,Security()))using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token))using(deadline.Token.Register(()=>{try{pipe.Dispose();}catch{}})){
     // Idle waiting has only the caller's lifetime token; per-request budget
     // starts after connection, so an idle broker survives a user's absence.
     await pipe.WaitForConnectionAsync(token).ConfigureAwait(false);deadline.CancelAfter(DeadlineMilliseconds);Peer(pipe,false,hostPid,hostStart,session);
     Received request=await Read(pipe,null,deadline.Token).ConfigureAwait(false);if(used.Count>=8192)return;if(!used.Add(Convert.ToBase64String(request.Nonce)))throw new InvalidOperationException("USB tab replay refused");
     action=Task.Factory.StartNew(()=>callback(request.Value),CancellationToken.None,TaskCreationOptions.DenyChildAttach,TaskScheduler.Default).Unwrap();
     Task finished=await Task.WhenAny(action,Task.Delay(DeadlineMilliseconds,deadline.Token)).ConfigureAwait(false);deadline.Token.ThrowIfCancellationRequested();if(finished!=action)throw new TimeoutException("USB tab operation timeout");
     string reply=await action.ConfigureAwait(false);deadline.Token.ThrowIfCancellationRequested();Peer(pipe,false,hostPid,hostStart,session);await Write(pipe,reply,request.Nonce,deadline.Token).ConfigureAwait(false);
    }}catch{
     if(token.IsCancellationRequested)return;
     // Never accept another request while a timed-out native operation remains
     // outstanding. Its owner retains its independent recovery/lifetime.
     if(action!=null&&!action.IsCompleted)return;
     if(!HostAlive()||++refusals>=32)return;
     pause=true;
    }
    if(pause)await Task.Delay(50,token).ConfigureAwait(false);
   }}finally{Interlocked.Exchange(ref serving,0);}
  }
 }
 internal static Task Serve(string name,int expectedHostPid,long expectedHostStartTicks,Func<string,Task<string>> callback,CancellationToken token){return new Server(name,expectedHostPid,expectedHostStartTicks).Serve(callback,token);}
 internal static Task<string> Exchange(string name,int expectedOperatorPid,long expectedOperatorStartTicks,string request){return Exchange(name,expectedOperatorPid,expectedOperatorStartTicks,request,CancellationToken.None);}
 internal static async Task<string> Exchange(string pipeName,int operatorPid,long operatorStartUtcTicks,string request,CancellationToken token){ValidateName(pipeName);if(operatorPid<1||operatorStartUtcTicks<1)throw new ArgumentException("USB tab operator required");Payload(request);var nonce=new byte[16];using(var random=RandomNumberGenerator.Create())random.GetBytes(nonce);using(var pipe=new NamedPipeClientStream(".",pipeName,PipeDirection.InOut,PipeOptions.Asynchronous,TokenImpersonationLevel.Identification))using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token)){deadline.CancelAfter(DeadlineMilliseconds);using(deadline.Token.Register(()=>{try{pipe.Dispose();}catch{}})){await pipe.ConnectAsync(DeadlineMilliseconds,deadline.Token).ConfigureAwait(false);int session=Process.GetCurrentProcess().SessionId;Peer(pipe,true,operatorPid,operatorStartUtcTicks,session);await Write(pipe,request,nonce,deadline.Token).ConfigureAwait(false);Received reply=await Read(pipe,nonce,deadline.Token).ConfigureAwait(false);Peer(pipe,true,operatorPid,operatorStartUtcTicks,session);deadline.Token.ThrowIfCancellationRequested();return reply.Value;}}}
 }
