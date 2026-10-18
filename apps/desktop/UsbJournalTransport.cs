using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using Microsoft.Win32.SafeHandles;

internal sealed partial class ProtectedUsbJournal {
 internal List<SafeFileHandle> DuplicateForChild(){
  if(Stream==null)throw Refused();Stream.Flush(true);
  var copies=new List<SafeFileHandle>();
  try{foreach(var directory in directories)copies.Add(UsbJournalTransport.Duplicate(directory));copies.Add(UsbJournalTransport.Duplicate(Stream.SafeFileHandle));return copies;}
  catch{foreach(var copy in copies)copy.Dispose();throw;}
 }
 internal static ProtectedUsbJournal ImportHandles(string root,string encoded,bool machine){
  root=LocalPath(root);var paths=new List<string>();for(string cursor=root;cursor!=null;cursor=Path.GetDirectoryName(cursor)){paths.Add(cursor);if(cursor.Length<=3)break;}paths.Reverse();
  string[] values=encoded.Split(',');if(paths.Count>128||values.Length!=paths.Count+1)throw Refused();
  var numbers=new List<long>();foreach(string value in values){long number;if(!long.TryParse(value,NumberStyles.None,CultureInfo.InvariantCulture,out number)||number<=0||!numbers.TrueForAll(n=>n!=number)||(IntPtr.Size==4&&number>int.MaxValue))throw Refused();numbers.Add(number);}
  var retained=new List<SafeFileHandle>();SafeFileHandle file=null;FileStream stream=null;
  try{
   var allowed=machine?new[]{AdminSid,SystemSid}:new[]{CurrentSid()};
   foreach(long number in numbers)retained.Add(new SafeFileHandle(new IntPtr(number),true));file=retained[retained.Count-1];retained.RemoveAt(retained.Count-1);
   for(int i=0;i<paths.Count;i++){var handle=retained[i];CheckHandle(handle,paths[i],true);if(machine&&i<paths.Count-1)CheckMachineParent(handle);}
   CheckPrivate(retained[retained.Count-1],allowed);
   CheckHandle(file,Path.Combine(root,"usb-policy.journal"),false);CheckPrivate(file,allowed);
   stream=new FileStream(file,FileAccess.ReadWrite,4096,false);if(stream.Length>MaxLength)throw Refused();return new ProtectedUsbJournal(stream,retained);
  }catch{if(stream!=null)stream.Dispose();else if(file!=null)file.Dispose();foreach(var handle in retained)handle.Dispose();throw Refused();}
 }
 internal static ProtectedUsbJournal ImportMachine(string encoded){using(var identity=WindowsIdentity.GetCurrent()){if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw Refused();}return ImportHandles(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelUsbGuard"),encoded,true);}
 internal static ProtectedUsbJournal ImportScratch(string root,string encoded){CheckScratchName(root);return ImportHandles(root,encoded,false);}
 // Hold and validate the fixed broker executable as well as its ancestry until creation.
 internal static List<SafeFileHandle> HoldMachineExecutable(string path){
  var handles=new List<SafeFileHandle>();try{
   string application=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Sentinel");
   string binaryRoot=Path.Combine(application,"Usb");
   string name=Path.GetFileName(path);if(!string.Equals(Path.GetDirectoryName(path),binaryRoot,StringComparison.OrdinalIgnoreCase)||(name!="Sentinel.UsbBootstrap.exe"&&name!="Sentinel.UsbBroker.exe"&&name!="Sentinel.UsbRecovery.dll"))throw Refused();
   var paths=new List<string>();for(string cursor=Path.GetDirectoryName(path);cursor!=null;cursor=Path.GetDirectoryName(cursor)){paths.Add(cursor);if(cursor.Length<=3)break;}paths.Reverse();
   foreach(string directory in paths){var handle=Open(directory,0x20080,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);handles.Add(handle);CheckHandle(handle,directory,true);if(directory.Equals(application,StringComparison.OrdinalIgnoreCase)||directory.StartsWith(application+"\\",StringComparison.OrdinalIgnoreCase))CheckPrivate(handle,new[]{AdminSid,SystemSid});else CheckMachineParent(handle);}
   var binary=Open(path,0x20080,1,IntPtr.Zero,3,0x00200000,IntPtr.Zero);handles.Add(binary);CheckHandle(binary,path,false);CheckPrivate(binary,new[]{AdminSid,SystemSid});return handles;
  }catch{foreach(var handle in handles)handle.Dispose();throw Refused();}
 }
}

// Native-only recovery bootstrap. No policy application, UI commands, or selected executable.
// Recovery-only child validates its handles and completes recovery before signalling.
// This completion signal must never be used as ongoing watchdog readiness for apply.
internal static class UsbJournalTransport {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup {public int Size;public string Reserved,Desktop,Title;public uint X,Y,XSize,YSize,XCount,YCount,Fill,Flags;public short Show,ReservedSize;public IntPtr Reserved2,Input,Output,Error;}
 [StructLayout(LayoutKind.Sequential)]struct StartupEx {public Startup Info;public IntPtr Attributes;}
 [StructLayout(LayoutKind.Sequential)]struct ProcessInfo {public IntPtr Process,Thread;public uint Id,ThreadId;}
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DuplicateHandle(IntPtr sourceProcess,IntPtr source,IntPtr targetProcess,out SafeFileHandle copy,uint access,bool inherit,uint options);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref StartupEx startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(SafeFileHandle process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(SafeFileHandle process,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(SafeFileHandle process,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
 internal sealed class Child:IDisposable {
  readonly SafeFileHandle process;internal Child(SafeFileHandle process){this.process=process;}
  internal bool WaitForExit(int milliseconds){if(milliseconds<0||milliseconds>30000)throw new ArgumentOutOfRangeException();return WaitForSingleObject(process,(uint)milliseconds)==0;}
  internal int ExitCode{get{uint code;if(!GetExitCodeProcess(process,out code)||code==259)throw new IOException("USB child has not exited.");return unchecked((int)code);}}
  public void Dispose(){process.Dispose();}
 }
 internal static SafeFileHandle Duplicate(SafeFileHandle handle){return Duplicate(handle,true);}
 internal static SafeFileHandle Duplicate(SafeFileHandle handle,bool inherit){bool retained=false;try{handle.DangerousAddRef(ref retained);SafeFileHandle copy;if(!DuplicateHandle(GetCurrentProcess(),handle.DangerousGetHandle(),GetCurrentProcess(),out copy,0,inherit,2))throw new IOException("USB handle transfer failed.");return copy;}finally{if(retained)handle.DangerousRelease();}}
 static string Quote(string value){if(value.IndexOf('"')>=0||value.IndexOf('\r')>=0||value.IndexOf('\n')>=0||value.EndsWith("\\"))throw new IOException("USB child arguments refused.");return "\""+value+"\"";}
 internal static Child StartMachine(ProtectedUsbJournal journal){
  // Handle inheritance is process-global while duplicates are live. Run only in
  // the dedicated bootstrap, whose sole child launch is this explicit allowlist.
  string bootstrap=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Sentinel","Usb","Sentinel.UsbBootstrap.exe");
  if(!string.Equals(System.Reflection.Assembly.GetEntryAssembly().Location,bootstrap,StringComparison.OrdinalIgnoreCase))throw new IOException("USB transport requires the dedicated bootstrap.");
  string binary=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Sentinel","Usb","Sentinel.UsbBroker.exe");
  using(var identity=WindowsIdentity.GetCurrent()){if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw new IOException("USB broker requires administrator authorization.");}
  var bootstrapHeld=ProtectedUsbJournal.HoldMachineExecutable(bootstrap);try{var held=ProtectedUsbJournal.HoldMachineExecutable(binary);try{return Start(journal,binary,"--recover-inherited",null,IntPtr.Zero);}finally{foreach(var handle in held)handle.Dispose();}}finally{foreach(var handle in bootstrapHeld)handle.Dispose();}
 }
 internal static Child StartScratch(ProtectedUsbJournal journal,string executable,string root,IntPtr excluded){return Start(journal,executable,"child",root,excluded);}
 internal static ProtectedUsbJournal ImportScratch(string root,string encoded){return ProtectedUsbJournal.ImportScratch(root,encoded);}
 internal static void MarkInheritableForTest(IntPtr handle){if(!SetHandleInformation(handle,1,1))throw new IOException("Test inheritance setup failed.");}
 static Child Start(ProtectedUsbJournal journal,string executable,string mode,string root,IntPtr excluded){
  var handles=journal.DuplicateForChild();IntPtr attributes=IntPtr.Zero,array=IntPtr.Zero;bool initialized=false;SafeFileHandle process=null;
  using(var ready=new EventWaitHandle(false,EventResetMode.ManualReset))try{
   SafeFileHandle signal;if(!DuplicateHandle(GetCurrentProcess(),ready.SafeWaitHandle.DangerousGetHandle(),GetCurrentProcess(),out signal,0,true,2))throw new IOException("USB readiness transfer failed.");handles.Add(signal);
   var values=new List<string>();for(int i=0;i<handles.Count-1;i++)values.Add(handles[i].DangerousGetHandle().ToInt64().ToString(CultureInfo.InvariantCulture));
   string arguments=Quote(executable)+" "+mode+" "+(root==null?"":Quote(root)+" ")+Quote(string.Join(",",values))+" "+signal.DangerousGetHandle().ToInt64().ToString(CultureInfo.InvariantCulture)+(root==null?"":" "+excluded.ToInt64().ToString(CultureInfo.InvariantCulture));
   IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);if(size.ToInt64()<=0||size.ToInt64()>65536)throw new IOException("USB child attributes refused.");
   attributes=Marshal.AllocHGlobal(size);if(!InitializeProcThreadAttributeList(attributes,1,0,ref size))throw new IOException("USB child attributes failed.");initialized=true;
   array=Marshal.AllocHGlobal(handles.Count*IntPtr.Size);for(int i=0;i<handles.Count;i++)Marshal.WriteIntPtr(array,i*IntPtr.Size,handles[i].DangerousGetHandle());
   if(!UpdateProcThreadAttribute(attributes,0,new IntPtr(0x20002),array,new IntPtr(handles.Count*IntPtr.Size),IntPtr.Zero,IntPtr.Zero))throw new IOException("USB handle allowlist failed.");
   var startup=new StartupEx{Info=new Startup{Size=Marshal.SizeOf(typeof(StartupEx)),Flags=0x100},Attributes=attributes};ProcessInfo info;
   if(!CreateProcessW(executable,new StringBuilder(arguments),IntPtr.Zero,IntPtr.Zero,true,0x08080000,IntPtr.Zero,Path.GetDirectoryName(executable),ref startup,out info))throw new IOException("USB child startup failed.");
   process=new SafeFileHandle(info.Process,true);using(var thread=new SafeFileHandle(info.Thread,true)){}
   if(!ready.WaitOne(5000))throw new IOException("USB child recovery handshake failed.");
   uint status=WaitForSingleObject(process,0);if(status!=258){uint code;if(mode!="--recover-inherited"||status!=0||!GetExitCodeProcess(process,out code)||code!=0)throw new IOException("USB child recovery failed.");}
   journal.Dispose();var child=new Child(process);process=null;return child;
  }finally{
   bool cleanupFailed=false;if(process!=null){if(WaitForSingleObject(process,0)!=0){cleanupFailed=!TerminateProcess(process,1)||WaitForSingleObject(process,5000)!=0;}process.Dispose();}
   if(initialized)DeleteProcThreadAttributeList(attributes);if(attributes!=IntPtr.Zero)Marshal.FreeHGlobal(attributes);if(array!=IntPtr.Zero)Marshal.FreeHGlobal(array);foreach(var handle in handles)handle.Dispose();if(cleanupFailed)throw new IOException("USB child cleanup failed; recovery remains required.");
  }
 }
}
