using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

// Metadata only: no mounted-volume access, input suppression or enrollment.
public static class UsbDeviceInventory {
 [StructLayout(LayoutKind.Sequential)]struct DeviceInfo { public uint Size;public Guid Class;public uint Node;public IntPtr Reserved; }
 [StructLayout(LayoutKind.Sequential)]struct PropertyKey {public Guid Format;public uint Id;}
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr SetupDiGetClassDevsW(ref Guid setupClass,string enumerator,IntPtr parent,uint flags);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiEnumDeviceInfo(IntPtr set,uint index,ref DeviceInfo info);
 [DllImport("setupapi.dll")]static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder buffer,uint size,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_DevNode_PropertyW(uint node,ref PropertyKey key,out uint type,byte[] data,ref uint size,uint flags);
 internal sealed class Node {internal string Id,Root,Placement,Kind,Name;}
 sealed class Group {public string Ref,Name,Evidence;public HashSet<string> Kinds=new HashSet<string>();}
 static string Id(uint node){var buffer=new StringBuilder(513);return CM_Get_Device_IDW(node,buffer,513,0)==0?buffer.ToString():null;}
 static string Description(uint node){
  foreach(var key in new[]{new PropertyKey{Format=new Guid("540b947e-8b40-45bc-a8a2-6a0b894cbda2"),Id=4},new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=14}}){
   var property=key;var bytes=new byte[512];uint size=512,type;uint result=CM_Get_DevNode_PropertyW(node,ref property,out type,bytes,ref size,0);
   if(result!=0||type!=18||size<2||size>512||size%2!=0)continue;
   string text=Encoding.Unicode.GetString(bytes,0,(int)size).TrimEnd('\0');if(text.IndexOf('\0')>=0)continue;
   text=Regex.Replace(text,@"[^\x20-\x7e]","").Trim();if(text.Length>80)text=text.Substring(0,80);if(text.Length>0)return text;
  }return null;
 }
 static Node Resolve(uint node,string kind){
  string instance=Id(node);if(instance==null)return null;var ancestry=new List<string>();var seen=new HashSet<uint>();uint cursor=node;string root=null,name=null;
  for(int depth=0;depth<12&&seen.Add(cursor);depth++){
   string id=Id(cursor);if(id==null)break;ancestry.Add(id);
   if(UsbInputIdentity.PhysicalUsbAncestor(ancestry)!=null){root=id;name=Description(cursor);break;}
   string placement=UsbInputIdentity.ClassifyAncestry(ancestry);if(placement=="platform_input"||placement=="non_usb")break;
   uint parent;if(CM_Get_Parent(out parent,cursor,0)!=0)break;cursor=parent;
  }
  return new Node{Id=instance,Root=root,Placement=UsbInputIdentity.ClassifyAncestry(ancestry),Kind=kind,Name=name};
 }
 internal static object Aggregate(IEnumerable<Node> nodes,bool partial,int omitted,Func<string,bool> excluded=null){
  var groups=new Dictionary<string,Group>(StringComparer.OrdinalIgnoreCase);var order=new List<Group>();var ids=new HashSet<string>(StringComparer.OrdinalIgnoreCase);int count=0;
  foreach(var node in nodes){
   if(++count>512){partial=true;omitted=Math.Min(512,omitted+1);break;}
   if(node==null||string.IsNullOrEmpty(node.Id)||node.Id.Length>512||!ids.Add(node.Id)){partial=true;continue;}
   if(node.Placement=="platform_input"||node.Placement=="non_usb")continue;
   if(node.Root==null||node.Placement!="usb_placement_unverified")partial=true;
   if(node.Root!=null&&excluded!=null&&excluded(node.Root))continue;
   string key=node.Root==null?"node:"+node.Id:"root:"+node.Root;Group group;
   if(!groups.TryGetValue(key,out group)){if(groups.Count>=64){partial=true;omitted=Math.Min(512,omitted+1);continue;}group=new Group{Ref="device-"+(order.Count+1),Name=node.Name,Evidence=node.Root!=null&&node.Placement=="usb_placement_unverified"?"os_reported":"unresolved"};groups.Add(key,group);order.Add(group);}
   group.Kinds.Add(node.Kind);
  }
  var devices=new List<object>();foreach(var group in order){var kinds=new List<string>(group.Kinds);kinds.Sort(StringComparer.Ordinal);var result=new Dictionary<string,object>{{"ref",group.Ref},{"usbEvidence",group.Evidence},{"interfaces",kinds}};if(!string.IsNullOrEmpty(group.Name))result.Add("name",group.Name);devices.Add(result);}
  return new{schemaVersion=1,mode="observation_only",state=partial||omitted>0?"partial":"observed",observedAt=DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),omitted=Math.Min(512,omitted),devices};
 }
 public static object Snapshot(){return Collect(false);}
 public static object Snapshot(Func<string,bool> excluded){return Collect(false,excluded);}
 internal static object PolicyCandidateCounts(){return Collect(true);}
 static object Collect(bool counts,Func<string,bool> excluded=null){
  try{
   var nodes=new List<Node>();bool partial=false;int omitted=0;var watch=Stopwatch.StartNew();
   var classes=new[]{"{4d36e96b-e325-11ce-bfc1-08002be10318}","{4d36e96f-e325-11ce-bfc1-08002be10318}","{745a17a0-74d3-11d0-b6fe-00a0c90f57da}","{4d36e967-e325-11ce-bfc1-08002be10318}"};var kinds=new[]{"hid_keyboard","hid_mouse","hid_other","storage"};
   for(int c=0;c<classes.Length;c++){
    Guid setupClass=new Guid(classes[c]);IntPtr set=SetupDiGetClassDevsW(ref setupClass,null,IntPtr.Zero,2);if(set==new IntPtr(-1)){partial=true;continue;}
    try{for(uint index=0;index<=128;index++){
     if(watch.ElapsedMilliseconds>=2000){partial=true;omitted=Math.Min(512,omitted+1);break;}
     var info=new DeviceInfo{Size=(uint)Marshal.SizeOf(typeof(DeviceInfo))};if(!SetupDiEnumDeviceInfo(set,index,ref info)){if(Marshal.GetLastWin32Error()!=259)partial=true;break;}
     if(index==128){partial=true;omitted=Math.Min(512,omitted+1);break;}var node=Resolve(info.Node,kinds[c]);if(node==null){partial=true;continue;}nodes.Add(node);
    }}finally{SetupDiDestroyDeviceInfoList(set);}
   }if(counts){int input=0,platform=0,other=0,unresolved=0;foreach(var node in nodes){if(node.Kind=="storage")continue;input++;if(node.Placement=="platform_input")platform++;else if(node.Placement=="non_usb")other++;else if(node.Root==null)unresolved++;}return new{state=partial||unresolved>0?"partial":"observed",inputSetupNodes=input,platformInputNodes=platform,nonUsbInputNodes=other,unresolvedInputNodes=unresolved,omitted};}return Aggregate(nodes,partial,omitted,excluded);
  }catch{return new{schemaVersion=1,mode="observation_only",state="unavailable",observedAt=DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),omitted=0,devices=new object[0]};}
 }
}
