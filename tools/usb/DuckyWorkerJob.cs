using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

// Opt-in, process-lifetime containment for a dedicated disposable worker only.
// Never call from the desktop UI/broker. No external process IDs are accepted.
public static class DuckyWorkerJob {
 [StructLayout(LayoutKind.Sequential)]struct Basic {
  public long ProcessTime,JobTime;public uint Flags;
  public UIntPtr MinWorkingSet,MaxWorkingSet;public uint ActiveProcesses;
  public UIntPtr Affinity;public uint Priority,Scheduling;
 }
 [StructLayout(LayoutKind.Sequential)]struct Io {public ulong ReadOperations,WriteOperations,OtherOperations,ReadBytes,WriteBytes,OtherBytes;}
 [StructLayout(LayoutKind.Sequential)]struct Extended {public Basic Basic;public Io Io;public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;}
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 static readonly object Sync=new object();static IntPtr lifetimeJob;
 public static void AttachCurrentWorker(){
  lock(Sync){
   if(lifetimeJob!=IntPtr.Zero)return;
   IntPtr job=CreateJobObject(IntPtr.Zero,null);if(job==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
   var limits=new Extended();limits.Basic.Flags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; no breakaway.
   if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended)))){int error=Marshal.GetLastWin32Error();CloseHandle(job);throw new Win32Exception(error);}
   if(!AssignProcessToJobObject(job,GetCurrentProcess())){int error=Marshal.GetLastWin32Error();CloseHandle(job);throw new Win32Exception(error);}
   // Intentionally retained until OS process teardown. Closing it here would
   // terminate this worker. Descendants inherit membership, not this handle.
   lifetimeJob=job;
  }
 }
}
