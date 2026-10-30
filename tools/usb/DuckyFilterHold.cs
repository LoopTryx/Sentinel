using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
public static class DuckyFilterHold {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string p,uint a,uint s,IntPtr d,uint c,uint f,IntPtr t);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool DeviceIoControl(SafeFileHandle h,uint c,byte[] i,uint n,byte[] o,uint m,out uint r,IntPtr v);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateJobObject(IntPtr a,string n);
 [DllImport("kernel32.dll")]static extern bool SetInformationJobObject(IntPtr j,int c,byte[] p,uint n);
 [DllImport("kernel32.dll")]static extern bool AssignProcessToJobObject(IntPtr j,IntPtr p);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=8192};
 public static int UniqueMatch(string[] expected,string[][] reported){int found=-1;for(int i=0;i<reported.Length;i++){bool hit=false;foreach(string id in reported[i])foreach(string wanted in expected)if(string.Equals(id,wanted,StringComparison.OrdinalIgnoreCase)&&id.IndexOf("VID_",StringComparison.OrdinalIgnoreCase)>=0)hit=true;if(hit){if(found!=-1)return -1;found=i;}}return found;}
 sealed class Context : IDisposable {
  public SafeFileHandle File;public EventWaitHandle Ready;
  public void Dispose(){if(File!=null)File.Dispose();if(Ready!=null)Ready.Dispose();}
 }
 static Context Open(int slot){
  var c=new Context{File=CreateFile(@"\\.\interception"+slot.ToString("00"),0x80000000,0,IntPtr.Zero,3,0,IntPtr.Zero)};
  if(c.File.IsInvalid)return c;
  try{c.Ready=new EventWaitHandle(false,EventResetMode.ManualReset);var input=new byte[IntPtr.Size*2];var pointer=c.Ready.SafeWaitHandle.DangerousGetHandle();Array.Copy(IntPtr.Size==8?BitConverter.GetBytes(pointer.ToInt64()):BitConverter.GetBytes(pointer.ToInt32()),input,IntPtr.Size);uint n;if(!DeviceIoControl(c.File,0x222040,input,(uint)input.Length,null,0,out n,IntPtr.Zero))throw new Exception("context_event_failed");return c;}catch{c.Dispose();throw;}
 }
 static string[] Identity(Context h){byte[] b=new byte[2048];uint n;if(h.File.IsInvalid||!DeviceIoControl(h.File,0x222200,null,0,b,2048,out n,IntPtr.Zero)||n==0||n>2048||n%2!=0)return new string[0];return Encoding.Unicode.GetString(b,0,(int)n).Split(new[]{'\0'},StringSplitOptions.RemoveEmptyEntries);}
 public static ushort DecodeFilterReply(bool success,uint returned,byte[] buffer){if(!success||buffer==null||buffer.Length!=2||(returned!=0&&returned!=2))throw new Exception("filter_read_failed");return BitConverter.ToUInt16(buffer,0);}
 public static ushort StableFilterReply(bool a,uint na,byte[] ba,bool b,uint nb,byte[] bb){ushort one=DecodeFilterReply(a,na,ba),two=DecodeFilterReply(b,nb,bb);if(one!=two)throw new Exception("filter_reply_not_populated_or_changed");return one;}
 static ushort Filter(Context h){byte[] first=new byte[]{165,90},second=new byte[]{90,165};uint oneBytes,twoBytes;bool oneOk=DeviceIoControl(h.File,0x222020,null,0,first,2,out oneBytes,IntPtr.Zero);bool twoOk=DeviceIoControl(h.File,0x222020,null,0,second,2,out twoBytes,IntPtr.Zero);return StableFilterReply(oneOk,oneBytes,first,twoOk,twoBytes,second);}
 static void SetFilter(Context h,ushort value){
#if !SENTINEL_USB_LAB_HOLD
 if(value!=0)throw new Exception("unqualified_backend");
#endif
uint n;byte[] b=BitConverter.GetBytes(value);if(!DeviceIoControl(h.File,0x222010,b,2,null,0,out n,IntPtr.Zero)||Filter(h)!=value)throw new Exception("filter_write_failed");}
 static Context Select(string[] ids){var handles=new Context[10];var names=new string[10][];int selected=-1;try{for(int i=0;i<10;i++){handles[i]=Open(i);names[i]=Identity(handles[i]);}selected=UniqueMatch(ids,names);if(selected<0)return null;var result=handles[selected];handles[selected]=null;return result;}finally{foreach(var handle in handles)if(handle!=null)handle.Dispose();}}
 public static void Probe(string[] ids){using(var h=Select(ids)){if(h==null||Filter(h)!=0)throw new Exception("target_not_unique_or_busy");}using(var h=Select(ids)){if(h==null||Filter(h)!=0)throw new Exception("filter_release_probe_failed");}}
 static int Worker(){
  string line=Console.ReadLine();if(line==null||line.Length>8192)return 2;
  var config=Json.Deserialize<Dictionary<string,object>>(line);string keyboard=(string)config["keyboard"],root=(string)config["root"],runId=(string)config["runId"];var ids=SentinelDuckyNative.HardwareIds(keyboard,root);
  if(SentinelDuckyNative.Read(keyboard,root)!=0)return 3;Probe(ids);Console.WriteLine("ready");Console.Out.Flush();string start=Console.ReadLine();if(start=="probe-only")return 0;if(start!="start")return 4;
#if !SENTINEL_USB_LAB_HOLD
 return 12;
#else
  long dropped=0;bool released=false,armed=false;var clock=Stopwatch.StartNew();Context active=null;
  try{while(clock.Elapsed.TotalSeconds<120){
   if(active==null){try{if(SentinelDuckyNative.Read(keyboard,root)!=0){Thread.Sleep(20);continue;}}catch{Thread.Sleep(20);continue;}active=Select(ids);if(active==null){Thread.Sleep(20);continue;}if(Filter(active)!=0)throw new Exception("target_busy");SetFilter(active,65535);if(!armed){Console.WriteLine("armed");Console.Out.Flush();armed=true;}}
   bool current=false;try{current=SentinelDuckyNative.Read(keyboard,root)==0&&UniqueMatch(ids,new[]{Identity(active)})==0;}catch{}
   if(!current){throw new Exception("connection_changed");}
   if(active.Ready.WaitOne(20)){var bytes=new byte[384];uint count;bool ok=DeviceIoControl(active.File,0x222100,null,0,bytes,384,out count,IntPtr.Zero);Array.Clear(bytes,0,bytes.Length);if(!ok||count>384||count%12!=0)throw new Exception("bounded_read_failed");dropped=Math.Min(1000000,dropped+count/12);}
  }}finally{if(active!=null){try{SetFilter(active,0);released=true;}finally{active.Dispose();}}}
  Console.WriteLine(Json.Serialize(new{state="released",runId=runId,reportsDiscarded=dropped,filterResetVerified=released}));return released?0:5;
#endif
 }
 public static int Main(string[] args){if(args.Length==1&&args[0]=="--selftest"){try{StableFilterReply(true,0,new byte[]{165,90},true,0,new byte[]{90,165});return 1;}catch{}if(StableFilterReply(true,0,new byte[]{0,0},true,0,new byte[]{0,0})!=0)return 1;if(DecodeFilterReply(true,0,new byte[]{255,255})!=65535||DecodeFilterReply(true,2,new byte[]{0,0})!=0)return 1;var ids=new[]{"HID\\VID_0001&PID_0001"};if(UniqueMatch(ids,new[]{ids,new[]{"other"}})!=0||UniqueMatch(ids,new[]{ids,ids})!=-1||UniqueMatch(ids,new[]{new[]{"other"}})!=-1)return 1;Console.WriteLine("Driver target uniqueness PASS; no filter change");return 0;}if(args.Length==1&&args[0]=="--worker"){try{return Worker();}catch{Console.Error.WriteLine("worker_failed");return 6;}}bool crashTest=args.Length==1&&args[0]=="--crash-test",probeOnly=args.Length==1&&args[0]=="--probe";bool hold=args.Length==1&&args[0]=="--hold";if(!hold&&!crashTest&&!probeOnly)return 2;
#if !SENTINEL_USB_LAB_HOLD
  if(hold||crashTest){Console.WriteLine("{\"state\":\"unqualified_backend\",\"appliedByThisRun\":false}");return 12;}
#endif
  string directory=Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);Process child=null;IntPtr job=IntPtr.Zero;Dictionary<string,object> original=null;string runId=Guid.NewGuid().ToString("N");
  try{
   var target=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(directory,"ducky-target-private.json")));original=target;
   string config=Json.Serialize(new{keyboard=target["keyboard"],root=target["root"],runId=runId});
   child=new Process{StartInfo=new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,"--worker"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true}};child.Start();
   job=CreateJobObject(IntPtr.Zero,null);var limits=new byte[IntPtr.Size==8?144:112];Array.Copy(BitConverter.GetBytes(8192u),0,limits,16,4);if(job==IntPtr.Zero||!SetInformationJobObject(job,9,limits,(uint)limits.Length)||!AssignProcessToJobObject(job,child.Handle))throw new Exception("guardian_job_failed");
   child.StandardInput.WriteLine(config);child.StandardInput.Flush();var ready=child.StandardOutput.ReadLineAsync();if(!ready.Wait(5000)||ready.Result!="ready")throw new Exception("driver_probe_failed");
   if(probeOnly){child.StandardInput.WriteLine("probe-only");child.StandardInput.Flush();if(!child.WaitForExit(5000)||child.ExitCode!=0)throw new Exception("probe_worker_exit_failed");File.WriteAllText(Path.Combine(directory,"ducky-filter-state.json"),Json.Serialize(new{state="lifecycle_probe_passed",runId=runId,noInputFilterApplied=true}));return 0;}
   child.StandardInput.WriteLine("start");child.StandardInput.Flush();var armed=child.StandardOutput.ReadLineAsync();if(!armed.Wait(5000)||armed.Result!="armed")throw new Exception("driver_arm_failed");
   File.WriteAllText(Path.Combine(directory,"ducky-filter-state.json"),Json.Serialize(new{state="input_held",runId=runId,leaseSeconds=120,firstInputPrevention="unverified"}));
   if(crashTest){Thread.Sleep(2000);child.Kill();if(!child.WaitForExit(5000))throw new Exception("owned_child_not_exited");var fresh=SentinelDuckyNative.HardwareIds((string)target["keyboard"],(string)target["root"]);Probe(fresh);File.WriteAllText(Path.Combine(directory,"ducky-filter-state.json"),Json.Serialize(new{state="crash_release_verified",runId=runId,filterZeroVerified=true}));return 0;}
   if(!child.WaitForExit(130000))throw new Exception("guardian_lease_expired");string result=child.StandardOutput.ReadToEnd();if(child.ExitCode!=0||result.Length>2048)throw new Exception("driver_release_unverified");File.WriteAllText(Path.Combine(directory,"ducky-filter-state.json"),result);return 0;
  }catch{File.WriteAllText(Path.Combine(directory,"ducky-filter-state.json"),Json.Serialize(new{state="failed",runId=runId,release="unknown"}));return 1;}
  finally{
   bool workerExited=child==null;
   if(child!=null){try{if(!child.HasExited){child.Kill();workerExited=child.WaitForExit(5000);}else workerExited=true;}catch{workerExited=false;}finally{child.Dispose();}}
   if(job!=IntPtr.Zero)CloseHandle(job);
   try{if(!workerExited)throw new Exception("owned_worker_exit_unverified");if(original==null)throw new Exception("no_owned_target");var ids=SentinelDuckyNative.HardwareIds((string)original["keyboard"],(string)original["root"]);Probe(ids);File.WriteAllText(Path.Combine(directory,"ducky-filter-release.json"),Json.Serialize(new{runId=runId,workerExited=true,filterZeroVerified=true}));}catch{File.WriteAllText(Path.Combine(directory,"ducky-filter-release.json"),Json.Serialize(new{runId=runId,workerExited=workerExited,filterZeroVerified=false,release="unknown"}));}
  }
 }
}







