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
 internal static string ReadInstance(IntPtr device){
  uint size=0;if(GetRawInputDeviceInfoW(device,0x20000007,IntPtr.Zero,ref size)==uint.MaxValue||size<2||size>1024)return "unverified";
  uint capacity=size;IntPtr buffer=Marshal.AllocHGlobal(checked((int)size*2));string instance;
  try{if(GetRawInputDeviceInfoW(device,0x20000007,buffer,ref size)==uint.MaxValue||size>capacity)return "unverified";instance=InstanceFromInterface(Marshal.PtrToStringUni(buffer,(int)size).TrimEnd('\0'));}finally{Marshal.FreeHGlobal(buffer);}
  return instance;
 }
 public static string Placement(IntPtr device){
  string instance=ReadInstance(device);uint node;if(instance==null||instance=="unverified"||CM_Locate_DevNodeW(out node,instance,0)!=0)return "unverified";
  var ids=new List<string>();var seen=new HashSet<uint>();for(int depth=0;depth<12&&seen.Add(node);depth++){
   var id=new StringBuilder(513);if(CM_Get_Device_IDW(node,id,513,0)!=0)return "unverified";ids.Add(id.ToString());string result=ClassifyAncestry(ids);if(result!="unverified")return result;
   uint parent;if(CM_Get_Parent(out parent,node,0)!=0)break;node=parent;
  }return "unverified";
 }
 public static string PhysicalUsbAncestor(IEnumerable<string> ancestry){
  int count=0;foreach(string id in ancestry){if(++count>12||id==null||id.Length>512)return null;
   if(id.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)&&id.IndexOf("&MI_",StringComparison.OrdinalIgnoreCase)<0)return id;
  }return null;
 }
 public static string PrivateUsbGroup(IntPtr device){
  return PrivateUsbGroupFromInstance(ReadInstance(device));
 }
 public static string PrivateUsbGroupFromInstance(string instance){
  uint node;if(instance==null||instance=="unverified"||instance.Length>512||instance.IndexOf('\0')>=0||CM_Locate_DevNodeW(out node,instance,0)!=0)return null;
  var ids=new List<string>();var seen=new HashSet<uint>();for(int depth=0;depth<12&&seen.Add(node);depth++){
   var id=new StringBuilder(513);if(CM_Get_Device_IDW(node,id,513,0)!=0)return null;ids.Add(id.ToString());string root=PhysicalUsbAncestor(ids);if(root!=null)return root;
   uint parent;if(CM_Get_Parent(out parent,node,0)!=0)break;node=parent;
  }return null;
 }
 public static object CountInputCollectionsForInstance(string instance){
  string target=PrivateUsbGroupFromInstance(instance);if(target==null)return new{state="unavailable"};
  uint count=0,unit=(uint)Marshal.SizeOf(typeof(InputDevice));if(GetRawInputDeviceList(IntPtr.Zero,ref count,unit)==uint.MaxValue||count>256)return new{state="unavailable"};
  uint capacity=count;IntPtr buffer=Marshal.AllocHGlobal(checked((int)(count*unit)));try{
   uint read=GetRawInputDeviceList(buffer,ref count,unit);if(read==uint.MaxValue||read>capacity)return new{state="unavailable"};int keyboards=0,mice=0;
   for(int i=0;i<read;i++){var item=(InputDevice)Marshal.PtrToStructure(IntPtr.Add(buffer,(int)(i*unit)),typeof(InputDevice));if(item.Type>1||!string.Equals(PrivateUsbGroup(item.Handle),target,StringComparison.OrdinalIgnoreCase))continue;if(item.Type==1)keyboards++;else mice++;}
   return new{state="observed",matchedParentGroups=1,keyboards,mice,trusted=false,held=false};
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 public static object InventorySummary(){
  uint count=0,unit=(uint)Marshal.SizeOf(typeof(InputDevice));if(GetRawInputDeviceList(IntPtr.Zero,ref count,unit)==uint.MaxValue||count>256)return new{state="unavailable"};
  uint capacity=count;IntPtr buffer=Marshal.AllocHGlobal(checked((int)(count*unit)));try{
   uint read=GetRawInputDeviceList(buffer,ref count,unit);if(read==uint.MaxValue||read>capacity||read>256)return new{state="unavailable"};
   int keyboards=0,mice=0,platform=0,usb=0,unknown=0,other=0,platformKeyboards=0,platformMice=0;var groups=new HashSet<string>(StringComparer.OrdinalIgnoreCase);int ungrouped=0;
   for(int i=0;i<read;i++){var item=(InputDevice)Marshal.PtrToStructure(IntPtr.Add(buffer,(int)(i*unit)),typeof(InputDevice));if(item.Type>1)continue;if(item.Type==1)keyboards++;else mice++;string location=Placement(item.Handle);if(location=="platform_input"){platform++;if(item.Type==1)platformKeyboards++;else platformMice++;}else if(location=="usb_placement_unverified")usb++;else if(location=="non_usb")other++;else unknown++;}
   for(int i=0;i<read;i++){var item=(InputDevice)Marshal.PtrToStructure(IntPtr.Add(buffer,(int)(i*unit)),typeof(InputDevice));if(item.Type>1||Placement(item.Handle)!="usb_placement_unverified")continue;string group=PrivateUsbGroup(item.Handle);if(group==null)ungrouped++;else groups.Add(group);}
   return new{state=unknown>0||ungrouped>0?"partial":"observed",keyboards,mice,platformInputsExcluded=platform,platformKeyboardsExcluded=platformKeyboards,platformMiceExcluded=platformMice,usbPlacementUnverified=usb,usbParentGroups=groups.Count,ungroupedUsbInterfaces=ungrouped,otherNonUsbExcluded=other,unresolved=unknown,enrolled=0,holdSupported=false};
  }finally{Marshal.FreeHGlobal(buffer);}
 }
}
