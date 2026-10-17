using System;using System.IO;using System.Text;using System.Diagnostics;using System.Threading;using System.Collections.Generic;using System.Security.Principal;using System.Security.AccessControl;using System.Runtime.InteropServices;using System.Reflection;using System.Security.Cryptography;
#if !SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION && !SENTINEL_USB_EXACT_LIVE_REVIEWED
#error Exact backend is private-qualification-only until live provider review.
#endif
internal sealed class UsbExactBlockBackend:UsbExactBlockTransaction.INativeBackend,IDisposable {
 internal static readonly string StateRoot=Path.Combine(UsbExactBlockRecoveryTasks.CodeRoot,"State");
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
 UsbExactBlockGpo.Image overlayBefore,overlayCandidate;bool overlayTransition;
 void CaptureOverlay(){var pending=store.ReadPending();var committed=store.ReadCommitted();if(pending==null){overlayBefore=Image(committed);overlayCandidate=overlayBefore;overlayTransition=false;}else{Require(UsbExactBlockState.Same(committed,pending.Request.Before)||UsbExactBlockState.Same(committed,pending.Request.After));overlayBefore=Image(pending.Request.Before);overlayCandidate=Image(pending.Request.After);overlayTransition=true;}}
#endif
 readonly string scope;readonly FileStream manifestPin;
 readonly UsbExactBlockFileStore store;readonly UsbExactBlockRecoveryTasks tasks;readonly string image;readonly SentinelPolicyDirectory anchor;
 static void Require(bool ok){if(!ok)throw new InvalidOperationException("Exact native backend refused");}
 static bool Trusted(IdentityReference sid){return sid.Value=="S-1-5-18"||sid.Value=="S-1-5-32-544";}
 static void ValidateMode(string mode,string nonce){Require(mode=="apply"||mode=="verify"||mode=="recover");Require(System.Text.RegularExpressions.Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"));}
 sealed class ExactJob : IDisposable {
  [StructLayout(LayoutKind.Sequential)]struct SecurityAttributes{public int Length;public IntPtr Descriptor;[MarshalAs(UnmanagedType.Bool)]public bool Inherit;}
  [StructLayout(LayoutKind.Sequential)]struct BasicLimits{public long ProcessTime,JobTime;public uint Flags;public UIntPtr MinWorkingSet,MaxWorkingSet;public uint ActiveProcesses;public UIntPtr Affinity;public uint Priority,Scheduling;}
  [StructLayout(LayoutKind.Sequential)]struct IoCounters{public ulong A,B,C,D,E,F;}
  [StructLayout(LayoutKind.Sequential)]struct Limits{public BasicLimits Basic;public IoCounters Io;public UIntPtr A,B,C,D;}
  [StructLayout(LayoutKind.Sequential)]struct Accounting{public long A,B,C,D;public uint PageFaults,TotalProcesses,ActiveProcesses,TerminatedProcesses;}
  [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
  [DllImport("advapi32.dll")]static extern uint GetSecurityInfo(IntPtr handle,int type,uint info,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
  [DllImport("advapi32.dll")]static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
  [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr memory);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObject(ref SecurityAttributes security,string name);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenJobObject(uint access,bool inherit,string name);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr handle,int kind,ref Limits limits,uint size);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(IntPtr handle,int kind,out Accounting data,uint size,IntPtr returned);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(IntPtr handle,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateJobObject(IntPtr handle,uint exitCode);
  [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
  IntPtr handle;static bool processAttached;
  ExactJob(IntPtr value){handle=value;try{Authenticate();}catch{CloseHandle(handle);handle=IntPtr.Zero;throw;}}
  static string Name(string nonce,string mode){ValidateMode(mode,nonce);return @"Global\SentinelUsbExactJob-"+nonce+"-"+mode;}
  void Authenticate(){IntPtr owner,group,dacl,sacl,descriptor;if(GetSecurityInfo(handle,6,5,out owner,out group,out dacl,out sacl,out descriptor)!=0)throw new InvalidOperationException("Admission job security unavailable");try{uint length=GetSecurityDescriptorLength(descriptor);if(length<20||length>16384)throw new InvalidOperationException("Admission job security bound");var bytes=new byte[length];Marshal.Copy(descriptor,bytes,0,(int)length);var security=new RawSecurityDescriptor(bytes,0);if(security.Owner==null||!Trusted(security.Owner)||(security.ControlFlags&ControlFlags.DiscretionaryAclProtected)==0||security.DiscretionaryAcl==null)throw new InvalidOperationException("Unowned admission job");bool system=false;foreach(GenericAce entry in security.DiscretionaryAcl){var ace=entry as CommonAce;if(ace==null||ace.AceQualifier!=AceQualifier.AccessAllowed||!Trusted(ace.SecurityIdentifier))throw new InvalidOperationException("Unowned admission job access");if(ace.SecurityIdentifier.Value=="S-1-5-18"&&((ace.AccessMask&0x10000000)!=0||(ace.AccessMask&0x0002000C)==0x0002000C))system=true;}if(!system)throw new InvalidOperationException("Admission job SYSTEM access unavailable");}finally{LocalFree(descriptor);}}
  internal static void Attach(string nonce,string mode){if(processAttached)throw new InvalidOperationException("Exact worker job already attached");using(var existing=Open(nonce,mode)){if(existing==null)throw new InvalidOperationException("Parent exact job unavailable");bool member;if(!IsProcessInJob(GetCurrentProcess(),existing.handle,out member)||!member)throw new InvalidOperationException("Exact worker was not assigned before launch");processAttached=true;}}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup {public int Size;public string Reserved,Desktop,Title;public int X,Y,XSize,YSize,XChars,YChars,Fill,Flags;public short Show,ReservedCount;public IntPtr ReservedData,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)]struct ProcessInfo {public IntPtr Process,Thread;public uint ProcessId,ThreadId;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcess(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo info);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(IntPtr handle,out uint result);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(IntPtr handle,uint result);
  internal static void Launch(string image,string arguments,string nonce,string mode){IntPtr descriptor;uint size;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;BA)",1,out descriptor,out size))throw new InvalidOperationException("Exact parent job security failed");IntPtr created;bool existed;int createError;try{var security=new SecurityAttributes{Length=Marshal.SizeOf(typeof(SecurityAttributes)),Descriptor=descriptor,Inherit=false};created=CreateJobObject(ref security,Name(nonce,mode));createError=Marshal.GetLastWin32Error();existed=createError==183;}finally{LocalFree(descriptor);}if(created==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(createError,"Exact parent job create failed");using(var job=new ExactJob(created)){if(existed||job.Active!=0)throw new InvalidOperationException("Exact parent job already exists");var limits=new Limits();limits.Basic.Flags=0x2000;if(!SetInformationJobObject(job.handle,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits))))throw new InvalidOperationException("Exact parent job limit failed");var startup=new Startup{Size=Marshal.SizeOf(typeof(Startup))};ProcessInfo child;if(!CreateProcess(image,new StringBuilder("\""+image+"\" "+arguments),IntPtr.Zero,IntPtr.Zero,false,0x00000004|0x08000000,IntPtr.Zero,UsbExactBlockRecoveryTasks.CodeRoot,ref startup,out child))throw new InvalidOperationException("Exact suspended child create failed");try{if(!AssignProcessToJobObject(job.handle,child.Process))throw new InvalidOperationException("Exact suspended child assignment failed");if(ResumeThread(child.Thread)==uint.MaxValue)throw new InvalidOperationException("Exact suspended child resume failed");if(WaitForSingleObject(child.Process,150000)!=0){job.Terminate();throw new TimeoutException("Exact producer deadline");}uint result;if(!GetExitCodeProcess(child.Process,out result)||result!=0)throw new InvalidOperationException("Exact producer failed");var clock=Stopwatch.StartNew();while(job.Active!=0&&clock.ElapsedMilliseconds<1000)Thread.Sleep(10);if(job.Active!=0){job.Terminate();throw new InvalidOperationException("Exact producer descendants remain");}}finally{if(WaitForSingleObject(child.Process,0)!=0)TerminateProcess(child.Process,1);CloseHandle(child.Thread);CloseHandle(child.Process);}}}
  internal static ExactJob Open(string nonce,string mode){IntPtr handle=OpenJobObject(0x0004|0x0008|0x00020000,false,Name(nonce,mode));if(handle==IntPtr.Zero){if(Marshal.GetLastWin32Error()==2)return null;throw new InvalidOperationException("Admission job open failed");}return new ExactJob(handle);}
  internal uint Active{get{Accounting data;if(!QueryInformationJobObject(handle,1,out data,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero))throw new InvalidOperationException("Admission job accounting unavailable");return data.ActiveProcesses;}}
  internal void Terminate(){if(!TerminateJobObject(handle,1))throw new InvalidOperationException("Admission job termination failed");}

 public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
 }

 internal UsbExactBlockBackend(UsbExactBlockFileStore nativeStore,string workerHash){Require(nativeStore!=null);store=nativeStore;anchor=new SentinelPolicyDirectory(StateRoot);try{tasks=new UsbExactBlockRecoveryTasks(store,workerHash);string manifest=Path.Combine(UsbExactBlockRecoveryTasks.CodeRoot,"exact-worker.manifest");Require((File.GetAttributes(manifest)&FileAttributes.ReparsePoint)==0);manifestPin=new FileStream(manifest,FileMode.Open,FileAccess.Read,FileShare.Read);ValidateManifestSecurity(manifestPin.GetAccessControl());Require(manifestPin.Length==107);byte[] data=new byte[107];int position=0;while(position<data.Length){int count=manifestPin.Read(data,position,data.Length-position);Require(count>0);position+=count;}string text=Encoding.ASCII.GetString(data);Require(System.Text.RegularExpressions.Regex.IsMatch(text,@"\ASNTEXW01\n[0-9a-f]{64}\n[0-9a-f]{32}\n\z"));string[] fields=text.Split('\n');Require(fields[1]==workerHash);scope=fields[2];image=Path.Combine(UsbExactBlockRecoveryTasks.CodeRoot,UsbExactBlockRecoveryTasks.ImageName(workerHash));
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
CaptureOverlay();
#endif
}catch{if(manifestPin!=null)manifestPin.Dispose();if(tasks!=null)tasks.Dispose();anchor.Dispose();throw;}}
 static void ValidateManifestSecurity(FileSystemSecurity security){Require(security.AreAccessRulesProtected&&Trusted(security.GetOwner(typeof(SecurityIdentifier))));bool sy=false,ba=false;foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier))){Require(rule.AccessControlType==AccessControlType.Allow);if(Trusted(rule.IdentityReference)){bool full=(rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl;if(rule.IdentityReference.Value=="S-1-5-18")sy|=full;else ba|=full;}else Require(rule.IdentityReference.Value=="S-1-5-32-545"&&(rule.FileSystemRights&~(FileSystemRights.ReadAndExecute|FileSystemRights.Synchronize))==0);}Require(sy&&ba);}
 static UsbExactBlockGpo.Image Image(UsbExactBlockState.Snapshot state){return state==null?UsbExactBlockGpo.Empty():UsbExactBlockGpo.Desired(state.Generation,state.Digest,state.Blocked);}
 void Bound(UsbExactBlockState.Request request){var pending=store.ReadPending();Require(pending!=null&&pending.Request.Digest==request.Digest);
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
CaptureOverlay();
#endif
}
 void WithProvider(Action fence,Action<UsbExactBlockGpo> action){
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
// The legacy exclusion lease must cover each read/write, not the controller's
// wait for another process: the worker/recovery takes the same authenticated lease.
using(var baseline=new UsbExactBlockBaseline(key=>UsbExactBlockGpo.ValidateLegacyOverlay(key,overlayBefore,overlayCandidate,overlayTransition)))action(UsbExactBlockGpo.CreateReviewedMachine(baseline,fence));
#else
action(new UsbExactBlockGpo(@"SOFTWARE\Sentinel\ExactBlockQualification\"+scope,scope,fence));
#endif
}
 public void PrepareIndependentRecovery(UsbExactBlockState.Request request){Bound(request);tasks.Arm(request);}
 public void VerifyIndependentRecovery(UsbExactBlockState.Request request){Bound(request);tasks.VerifyArmed(request);}
 public void ApplyCandidate(UsbExactBlockState.Request request){Run(request,"apply");}
 public void VerifyPolicy(UsbExactBlockState.Snapshot expected){store.WithReadFence((committed,pending,fence)=>{
Require(UsbExactBlockState.Same(expected,committed)||pending!=null&&(UsbExactBlockState.Same(expected,pending.Request.Before)||UsbExactBlockState.Same(expected,pending.Request.After)));
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
if(pending==null){overlayBefore=Image(committed);overlayCandidate=overlayBefore;overlayTransition=false;}else{Require(UsbExactBlockState.Same(committed,pending.Request.Before)||UsbExactBlockState.Same(committed,pending.Request.After));overlayBefore=Image(pending.Request.Before);overlayCandidate=Image(pending.Request.After);overlayTransition=true;}
#endif
WithProvider(fence,provider=>provider.Verify(provider.Managed(Image(expected))));});}
 public void StopProducersAndVerifyQuiescent(UsbExactBlockState.Request request){Bound(request);foreach(string mode in new[]{"apply","verify"})using(var job=ExactJob.Open(request.Nonce,mode)){if(job==null)continue;job.Terminate();var clock=Stopwatch.StartNew();while(job.Active!=0&&clock.ElapsedMilliseconds<10000)Thread.Sleep(25);Require(job.Active==0);}}
 public void RestoreBefore(UsbExactBlockState.Request request){Write(request,true);}
 public void RetireIndependentRecovery(UsbExactBlockState.Request request){var committed=store.ReadCommitted();tasks.Retire(request,()=>VerifyPolicy(committed));}
 sealed class Drain {readonly Thread thread;internal bool Ok=true;internal Drain(Stream stream){thread=new Thread(()=>{try{int total=0,count;var bytes=new byte[512];while((count=stream.Read(bytes,0,bytes.Length))>0){total+=count;if(total>65536)throw new IOException();}}catch{Ok=false;}});thread.IsBackground=true;thread.Start();}internal void Finish(){Require(thread.Join(1000)&&Ok);}}
 static void Refresh(){using(var process=new Process()){process.StartInfo=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"gpupdate.exe"),"/target:computer /force /wait:30"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};try{process.Start();var output=new Drain(process.StandardOutput.BaseStream);var error=new Drain(process.StandardError.BaseStream);Require(process.WaitForExit(35000));output.Finish();error.Finish();Require(process.ExitCode==0);}finally{try{if(!process.HasExited)process.Kill();}catch{}}}}
 void Write(UsbExactBlockState.Request request,bool recovering){store.WithWriterFence(request,recovering,fence=>WithProvider(fence,provider=>{var before=provider.Managed(Image(request.Before));var candidate=provider.Managed(Image(request.After));var desired=recovering?before:candidate;provider.WriteSaved(before,candidate,desired,recovering);Refresh();fence();provider.VerifyEffective(desired);provider.FinalizeSaved(before,candidate,desired);Refresh();fence();provider.Verify(desired);}));}
 void Run(UsbExactBlockState.Request request,string mode){Bound(request);ValidateMode(mode,request.Nonce);ExactJob.Launch(image,mode+" "+request.Nonce+" "+request.Digest,request.Nonce,mode);}
 internal void ExecuteWorker(string mode,string nonce,string digest){ValidateMode(mode,nonce);var pending=store.ReadPending();Require(pending!=null&&pending.Request.Nonce==nonce&&pending.Request.Digest==digest);var request=pending.Request;if(mode!="recover")ExactJob.Attach(nonce,mode);if(mode=="apply"){tasks.VerifyArmed(request);Write(request,false);}else if(mode=="verify")VerifyPolicy(store.ReadCommitted());else{var decision=store.ClaimRecovery(digest);StopProducersAndVerifyQuiescent(request);if(UsbExactBlockState.Same(decision,request.Before))RestoreBefore(request);else Require(UsbExactBlockState.Same(decision,request.After));VerifyPolicy(decision);/* Running recovery cannot self-authenticate task retirement. Retain terminal pending for external/startup controller. */}}
 internal void DispatchRecoveryForQualification(UsbExactBlockState.Request request){Bound(request);tasks.VerifyRegistered(request);dynamic service=null,folder=null;try{service=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service",true));service.Connect();folder=service.GetFolder("\\");dynamic task=folder.GetTask(UsbExactBlockRecoveryTasks.TaskName(request.Nonce));DateTime previous=(DateTime)task.LastRunTime;while(DateTime.Now<=previous.AddSeconds(1))Thread.Sleep(50);tasks.VerifyRegistered(request);task.Run(null);var timer=Stopwatch.StartNew();while(timer.ElapsedMilliseconds<180000){Thread.Sleep(100);task=folder.GetTask(UsbExactBlockRecoveryTasks.TaskName(request.Nonce));tasks.VerifyRunningRegistration(request);if((DateTime)task.LastRunTime>previous&&(int)task.State==3){Require((int)task.LastTaskResult==0);tasks.VerifyRegistered(request);return;}}throw new TimeoutException("Exact SYSTEM recovery qualification timeout");}finally{if(folder!=null&&Marshal.IsComObject(folder))Marshal.FinalReleaseComObject(folder);if(service!=null&&Marshal.IsComObject(service))Marshal.FinalReleaseComObject(service);}}
 public void Dispose(){
#if SENTINEL_USB_EXACT_LIVE_REVIEWED

#endif
if(manifestPin!=null)manifestPin.Dispose();if(tasks!=null)tasks.Dispose();if(anchor!=null)anchor.Dispose();}
}
