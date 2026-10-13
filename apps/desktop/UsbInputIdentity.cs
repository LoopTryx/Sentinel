using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class UsbInputIdentity {
 [StructLayout(LayoutKind.Sequential)]struct InputDevice{public IntPtr Handle;public uint Type;}
 [DllImport("user32.dll")]static extern uint GetRawInputDeviceList(IntPtr list,ref uint count,uint size);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern uint GetRawInputDeviceInfoW(IntPtr device,uint command,IntPtr buffer,ref uint size);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string id,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder buffer,uint size,uint flags);
 public static string InstanceFromInterface(string path){
  if(path==null||path.Length>1024||!path.StartsWith(@"\\?\"))return null;
  int end=path.LastIndexOf("#{",StringComparison.Ordinal);if(end<5)return null;
  string instance=path.Substring(4,end-4).Replace('#','\\');if(instance.IndexOf('\0')>=0||instance.Length>512)return null;return instance;
 }
 public static string ClassifyAncestry(IEnumerable<string> ancestry){
  int count=0;foreach(string id in ancestry){if(++count>12||id==null||id.Length>512)return "unverified";
   if(id.StartsWith(@"USB\",StringComparison.OrdinalIgnoreCase)||id.StartsWith(@"USBSTOR\",StringComparison.OrdinalIgnoreCase))return "usb_placement_unverified";
   if(id.StartsWith(@"BTH",StringComparison.OrdinalIgnoreCase))return "non_usb";
   if(id.StartsWith(@"ACPI\",StringComparison.OrdinalIgnoreCase))return "platform_input";
  }return "unverified";
 }
 public static string Placement(IntPtr device){
  uint size=0;if(GetRawInputDeviceInfoW(device,0x20000007,IntPtr.Zero,ref size)==uint.MaxValue||size<2||size>1024)return "unverified";
  uint capacity=size;IntPtr buffer=Marshal.AllocHGlobal(checked((int)size*2));string instance;
  try{if(GetRawInputDeviceInfoW(device,0x20000007,buffer,ref size)==uint.MaxValue||size>capacity)return "unverified";instance=InstanceFromInterface(Marshal.PtrToStringUni(buffer,(int)size).TrimEnd('\0'));}finally{Marshal.FreeHGlobal(buffer);}
  uint node;if(instance==null||CM_Locate_DevNodeW(out node,instance,0)!=0)return "unverified";
  var ids=new List<string>();var seen=new HashSet<uint>();for(int depth=0;depth<12&&seen.Add(node);depth++){
   var id=new StringBuilder(513);if(CM_Get_Device_IDW(node,id,513,0)!=0)return "unverified";ids.Add(id.ToString());string result=ClassifyAncestry(ids);if(result!="unverified")return result;
   uint parent;if(CM_Get_Parent(out parent,node,0)!=0)break;node=parent;
  }return "unverified";
 }
 public static object InventorySummary(){
  uint count=0,unit=(uint)Marshal.SizeOf(typeof(InputDevice));if(GetRawInputDeviceList(IntPtr.Zero,ref count,unit)==uint.MaxValue||count>256)return new{state="unavailable"};
  uint capacity=count;IntPtr buffer=Marshal.AllocHGlobal(checked((int)(count*unit)));try{
   uint read=GetRawInputDeviceList(buffer,ref count,unit);if(read==uint.MaxValue||read>capacity||read>256)return new{state="unavailable"};
   int keyboards=0,mice=0,platform=0,usb=0,unknown=0,other=0,platformKeyboards=0,platformMice=0;
   for(int i=0;i<read;i++){var item=(InputDevice)Marshal.PtrToStructure(IntPtr.Add(buffer,(int)(i*unit)),typeof(InputDevice));if(item.Type>1)continue;if(item.Type==1)keyboards++;else mice++;string location=Placement(item.Handle);if(location=="platform_input"){platform++;if(item.Type==1)platformKeyboards++;else platformMice++;}else if(location=="usb_placement_unverified")usb++;else if(location=="non_usb")other++;else unknown++;}
   return new{state=unknown>0?"partial":"observed",keyboards,mice,platformInputsExcluded=platform,platformKeyboardsExcluded=platformKeyboards,platformMiceExcluded=platformMice,usbPlacementUnverified=usb,otherNonUsbExcluded=other,unresolved=unknown,enrolled=0,holdSupported=false};
  }finally{Marshal.FreeHGlobal(buffer);}
 }
}
