using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;
public sealed class UsbInputMonitor {
 [StructLayout(LayoutKind.Sequential)]struct Registration{public ushort Page,Usage;public uint Flags;public IntPtr Target;}
 [DllImport("user32.dll",SetLastError=true)]static extern bool RegisterRawInputDevices(Registration[] items,uint count,uint size);
 [DllImport("user32.dll")]static extern uint GetRawInputData(IntPtr raw,uint command,IntPtr data,ref uint size,uint header);
 sealed class Activity{public string Reference,Kind,Placement;public long Started,Events,Launchers;public bool LeftWin,RightWin;}
 readonly Dictionary<IntPtr,string> placement=new Dictionary<IntPtr,string>();
 readonly Dictionary<IntPtr,Activity> devices=new Dictionary<IntPtr,Activity>();readonly Stopwatch clock=Stopwatch.StartNew();int serial;bool available;int omitted;
 public bool Start(IntPtr window){available=RegisterRawInputDevices(new[]{new Registration{Page=1,Usage=6,Flags=0x2100,Target=window},new Registration{Page=1,Usage=2,Flags=0x2100,Target=window}},2,(uint)Marshal.SizeOf(typeof(Registration)));return available;}
 public void Receive(IntPtr raw){
  uint size=0,header=(uint)(8+2*IntPtr.Size);if(GetRawInputData(raw,0x10000003,IntPtr.Zero,ref size,header)==uint.MaxValue||size<header||size>4096)return;
  IntPtr data=Marshal.AllocHGlobal((int)size);try{uint read=GetRawInputData(raw,0x10000003,data,ref size,header);if(read==uint.MaxValue||read!=size||read<header)return;int kind=Marshal.ReadInt32(data);IntPtr device=Marshal.ReadIntPtr(data,8);if(device==IntPtr.Zero)return;
   string location;if(!placement.TryGetValue(device,out location)){if(placement.Count>=64){omitted=Math.Min(65535,omitted+1);return;}location=UsbInputIdentity.Placement(device);placement.Add(device,location);}
   if(location=="platform_input"||location=="non_usb")return;
   if(kind==1&&read>=header+16){int key=(ushort)Marshal.ReadInt16(data,(int)header+6);bool up=(Marshal.ReadInt16(data,(int)header+2)&1)!=0;Record(device,"keyboard",key,up,clock.ElapsedMilliseconds);}
   else if(kind==0&&read>=header+24)Record(device,"mouse",0,false,clock.ElapsedMilliseconds);
  }finally{Marshal.FreeHGlobal(data);}
 }
 public void Removed(IntPtr device){devices.Remove(device);placement.Remove(device);}
 public void Record(IntPtr device,string kind,int key,bool up,long now){
  if(kind!="keyboard"&&kind!="mouse")return;Activity item;if(!devices.TryGetValue(device,out item)){if(devices.Count>=64){omitted=Math.Min(65535,omitted+1);return;}string location;placement.TryGetValue(device,out location);item=new Activity{Reference="input-"+(++serial),Kind=kind,Placement=location??"unverified",Started=now};devices.Add(device,item);}
  if(kind=="keyboard"){if(key==0x5B)item.LeftWin=!up;if(key==0x5C)item.RightWin=!up;if(up)return;if(key==0x52&&(item.LeftWin||item.RightWin))item.Launchers=Math.Min(1000000,item.Launchers+1);}
  item.Events=Math.Min(1000000,item.Events+1);
 }
 public object Snapshot(){return SnapshotAt(clock.ElapsedMilliseconds);}
 public object SnapshotAt(long now){var entries=new List<object>();foreach(var item in devices.Values){long elapsed=Math.Max(0,now-item.Started);entries.Add(new{reference=item.Reference,kind=item.Kind,placement=item.Placement,trusted=false,held=false,elapsedSeconds=Math.Min(86400,elapsed/1000),initialObservationComplete=elapsed>=60000,eventCount=item.Events,launcherShortcuts=item.Launchers,assessment=item.Launchers>0?"review":"undetermined"});}int ignored=0;foreach(string value in placement.Values)if(value=="platform_input"||value=="non_usb")ignored++;return new{schemaVersion=1,mode="observation_only",state=available?(omitted>0?"partial":"observing"):"unavailable",holdSupported=false,internalExclusionVerified=false,ignoredNonUsbInterfaces=ignored,omitted,devices=entries};}
}
