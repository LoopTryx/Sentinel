using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading.Tasks;

// Native in-process authority only. No serialized proof or renderer consent bit.
// The installed operator must own the foreground window and select requests from
// protected configuration plus fresh enumeration before invoking this class.
internal static class UsbAdmissionAuthorization {
 static readonly object MintKey=new object();
 [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool WTSQuerySessionInformationW(IntPtr server,int session,int kind,out IntPtr memory,out uint size);
 [DllImport("wtsapi32.dll")]static extern void WTSFreeMemory(IntPtr memory);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 internal sealed class Request {
  internal readonly string OwnerSid,Topology,Action,Digest;
  internal readonly ulong Generation;
  internal Request(string ownerSid,ulong generation,string topology,string action,string digest){
   var sid=new SecurityIdentifier(ownerSid);
   if(!sid.IsAccountSid()||sid.Value!=ownerSid||!Hex(topology)||!Hex(digest)||(action!="initial-arm"&&action!="approve"&&action!="revoke"&&action!="release"))throw new ArgumentException("USB authorization binding refused.");
   OwnerSid=ownerSid;Generation=generation;Topology=topology;Action=action;Digest=digest;
  }
 }
 internal sealed class Proof {
  readonly Request bound;readonly int process,session;readonly IntPtr window;
  readonly Stopwatch age=Stopwatch.StartNew();readonly object sync=new object();bool consumed;
  internal Proof(Request request,IntPtr handle,int pid,int sessionId,object key){if(!object.ReferenceEquals(key,MintKey))throw new InvalidOperationException("Native owner verification required.");bound=request;window=handle;process=pid;session=sessionId;}
  internal void Consume(Request expected){lock(sync){
   bool current=Process.GetCurrentProcess().Id==process&&Process.GetCurrentProcess().SessionId==session&&Window(window)&&Owner(bound.OwnerSid);
   if(!ConsumeGate(ref consumed,bound,expected,age.ElapsedMilliseconds,current))throw new InvalidOperationException("USB owner proof no longer current.");
  }}
 }
 static bool Hex(string text){if(text==null||text.Length!=64)return false;foreach(char c in text)if(!((c>='a'&&c<='f')||(c>='0'&&c<='9')))return false;return true;}
 static bool Same(Request a,Request b){return a.OwnerSid==b.OwnerSid&&a.Generation==b.Generation&&a.Topology==b.Topology&&a.Action==b.Action&&a.Digest==b.Digest;}
 // Pure refusal logic. It cannot construct a proof or authorize an OS operation.
 internal static bool ConsumeGate(ref bool consumed,Request bound,Request expected,long elapsed,bool current){if(consumed)return false;consumed=true;return bound!=null&&expected!=null&&Same(bound,expected)&&elapsed>=0&&elapsed<30000&&current;}
 static bool Window(IntPtr hwnd){uint pid;return hwnd!=IntPtr.Zero&&GetForegroundWindow()==hwnd&&GetWindowThreadProcessId(hwnd,out pid)!=0&&pid==(uint)Process.GetCurrentProcess().Id;}
 internal static bool MatchesOwner(string owner,string processSid,string sessionSid,int processSession,int activeSession){return !string.IsNullOrEmpty(owner)&&owner==processSid&&owner==sessionSid&&processSession>0&&processSession==activeSession;}
 // WTS properties are read from the local session, not supplied by a browser.
 // https://learn.microsoft.com/en-us/windows/win32/api/wtsapi32/nf-wtsapi32-wtsquerysessioninformationw
 static byte[] SessionProperty(int session,int kind){IntPtr memory=IntPtr.Zero;uint size;try{if(!WTSQuerySessionInformationW(IntPtr.Zero,session,kind,out memory,out size)||memory==IntPtr.Zero||size<2||size>2048)throw new InvalidOperationException("USB owner session unavailable.");var bytes=new byte[size];Marshal.Copy(memory,bytes,0,(int)size);return bytes;}finally{if(memory!=IntPtr.Zero)WTSFreeMemory(memory);}}
 static string SessionText(int session,int kind){byte[] bytes=SessionProperty(session,kind);if(bytes.Length%2!=0)throw new InvalidOperationException("USB owner session unavailable.");string text=new System.Text.UnicodeEncoding(false,false,true).GetString(bytes);if(!text.EndsWith("\0")||text.Substring(0,text.Length-1).IndexOf('\0')>=0)throw new InvalidOperationException("USB owner session unavailable.");return text.Substring(0,text.Length-1);}
 static bool Owner(string expected){try{
  int session=Process.GetCurrentProcess().SessionId;byte[] state=SessionProperty(session,8);if(state.Length!=4||BitConverter.ToInt32(state,0)!=0)return false;
  string user=SessionText(session,5),domain=SessionText(session,7);if(user.Length==0||domain.Length==0)return false;
  string sessionSid=((SecurityIdentifier)new NTAccount(domain,user).Translate(typeof(SecurityIdentifier))).Value;
  using(var identity=WindowsIdentity.GetCurrent())return MatchesOwner(expected,identity.User.Value,sessionSid,session,session)&&new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
 }catch{return false;}}
 internal static async Task<Proof> Verify(IntPtr window,Request request){
  if(request==null||!Window(window)||!Owner(request.OwnerSid))return null;
  if(!await UsbOwnerVerification.Verify(window,"Sentinel: verify your identity to change USB device access."))return null;
  if(!Window(window)||!Owner(request.OwnerSid))return null;
  return new Proof(request,window,Process.GetCurrentProcess().Id,Process.GetCurrentProcess().SessionId,MintKey);
 }
}
