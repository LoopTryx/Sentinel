using System;using System.Diagnostics;using System.IO;using System.Runtime.InteropServices;using System.Threading;
internal static class BrowserOverview {
 [StructLayout(LayoutKind.Sequential)]struct Times{public uint low,high;public ulong Value{get{return ((ulong)high<<32)|low;}}}
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetSystemTimes(out Times idle,out Times kernel,out Times user);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)]sealed class Memory {public uint length=(uint)Marshal.SizeOf(typeof(Memory));public uint load;public ulong total,available,pageTotal,pageAvailable,virtualTotal,virtualAvailable,extended;}
 [DllImport("kernel32.dll",CharSet=CharSet.Auto,SetLastError=true)]static extern bool GlobalMemoryStatusEx([In,Out]Memory value);
 internal static object Read(){double? cpu=null,total=null,available=null,capacity=null,free=null,chromeBytes=null;int chromeProcesses=0;
  try{Times i1,k1,u1,i2,k2,u2;if(GetSystemTimes(out i1,out k1,out u1)){Thread.Sleep(150);if(GetSystemTimes(out i2,out k2,out u2)){double elapsed=(double)(k2.Value-k1.Value)+(double)(u2.Value-u1.Value);if(elapsed>0)cpu=Math.Max(0,Math.Min(100,100*(1-(double)(i2.Value-i1.Value)/elapsed)));}}}catch{}
  try{var m=new Memory();if(GlobalMemoryStatusEx(m)){total=m.total;available=m.available;}}catch{}
  try{var disk=new DriveInfo(Path.GetPathRoot(Environment.SystemDirectory));capacity=disk.TotalSize;free=disk.AvailableFreeSpace;}catch{}
  try{double sum=0;foreach(var process in Process.GetProcessesByName("chrome")){using(process){if(chromeProcesses>=256)continue;try{sum+=process.WorkingSet64;chromeProcesses++;}catch{}}}if(chromeProcesses>0)chromeBytes=sum;}catch{}
  return new{cpuPercent=cpu,memoryTotal=total,memoryAvailable=available,storageTotal=capacity,storageFree=free,chromeMemory=chromeBytes,chromeProcesses,tabMemory=(double?)null,at=DateTime.UtcNow.ToString("o")};
 }
}
