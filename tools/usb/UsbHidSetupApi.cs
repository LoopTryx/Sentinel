using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

// Targeted class-installer transitions only. Execute inside the caller's bounded,
// kill-contained worker: Windows SetupAPI itself has no cancellation guarantee.
public static class UsbHidSetupApi {
 public sealed class Node {
  public readonly string Id,Class;public readonly bool Disableable;public readonly uint Status,Problem;
  readonly string[] compatible;readonly Node[] children;
  public string[] Compatible{get{return (string[])compatible.Clone();}}public Node[] Children{get{return (Node[])children.Clone();}}
  public Node(string id,string cls,string[] ids,bool disableable,uint status,uint problem,Node[] descendants){Id=id;Class=cls;compatible=(string[])(ids??new string[0]).Clone();Disableable=disableable;Status=status;Problem=problem;children=(Node[])(descendants??new Node[0]).Clone();}
 }
 public sealed class Plan {
  public readonly string Instance,Topology;internal readonly string Tree;
  // Native captured, parent-authenticated recovery witness. Legacy plans without
  // this witness cannot authorize a recovery transition.
  public readonly string RecoveryConnector,RecoveryTree;
  public readonly uint BeforeStatus,BeforeProblem;public readonly bool Disableable;
  internal Plan(string id,string topology,string tree):this(id,topology,tree,0,0,false,null,null){}
  internal Plan(string id,string topology,string tree,uint status,uint problem,bool disableable):this(id,topology,tree,status,problem,disableable,null,null){}
  internal Plan(string id,string topology,string tree,uint status,uint problem,bool disableable,string connector,string recoveryTree){Instance=id;Topology=topology;Tree=tree;BeforeStatus=status;BeforeProblem=problem;Disableable=disableable;RecoveryConnector=connector;RecoveryTree=recoveryTree;}
 } public sealed class Result {public readonly string State;public readonly int NativeError;public readonly uint Status,Problem;public readonly bool RestartRequired;internal Result(string state,int error,uint status,uint problem,bool restart){State=state;NativeError=error;Status=status;Problem=problem;RestartRequired=restart;}}
 internal interface IDevice {Node Read(string instance);int Change(string instance,bool enable,out bool restart);}
 internal interface IRecoveryDevice:IDevice {string ReadConnector(string instance);}
 static bool HidClass(string cls){return cls=="HIDClass"||cls=="Keyboard"||cls=="Mouse";}
 public static bool IsSafeTree(Node root){try{var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);int count=0;Check(root,true,seen,ref count,0);return true;}catch{return false;}}
 static void Check(Node n,bool root,HashSet<string> seen,ref int count,int depth){
  if(n==null||depth>16||++count>128||string.IsNullOrEmpty(n.Id)||!seen.Add(n.Id)||!HidClass(n.Class))throw new InvalidOperationException("unsafe_hid_tree");
  if(root){if(!n.Id.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)||Array.FindIndex(n.Compatible,x=>string.Equals(x,@"USB\Class_03",StringComparison.OrdinalIgnoreCase))<0)throw new InvalidOperationException("not_usb_hid_function");}
  else if(!n.Id.StartsWith(@"HID\",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("unrelated_descendant");
  foreach(var child in n.Children)Check(child,false,seen,ref count,depth+1);
 }
 internal static string TreeBinding(Node node){var parts=new List<string>();Bind(node,parts);parts.Sort(StringComparer.Ordinal);return string.Join("\n",parts.ToArray());}
 static void Bind(Node n,List<string> parts){parts.Add(n.Id.ToUpperInvariant()+"|"+n.Class+"|"+string.Join(",",n.Compatible));foreach(var child in n.Children)Bind(child,parts);}
 // Binding includes directed edges so an existing HID node cannot be moved under
 // a different ancestor merely because its instance ID already existed.
 internal static string RecoveryTreeBinding(Node root){if(!IsSafeTree(root))throw new InvalidOperationException("unsafe_recovery_tree");var parts=new List<string>();RecoveryBind(root,"",parts);parts.Sort(StringComparer.Ordinal);return string.Join("\n",parts.ToArray());}
 static void RecoveryBind(Node n,string parent,List<string> parts){if(n.Id.IndexOfAny(new[]{'|','\n','\r',','})>=0||n.Class.IndexOfAny(new[]{'|','\n','\r',','})>=0)throw new InvalidOperationException("invalid_recovery_binding");var ids=n.Compatible;foreach(var id in ids)if(id.IndexOfAny(new[]{'|','\n','\r',','})>=0)throw new InvalidOperationException("invalid_recovery_binding");Array.Sort(ids,StringComparer.OrdinalIgnoreCase);parts.Add(parent.ToUpperInvariant()+"|"+n.Id.ToUpperInvariant()+"|"+n.Class+"|"+string.Join(",",ids).ToUpperInvariant());foreach(var child in n.Children)RecoveryBind(child,n.Id,parts);}
 internal static bool IsRecoverySubset(Node authenticatedBefore,Node current){try{return IsSafeTree(authenticatedBefore)&&IsSafeTree(current)&&Subset(RecoveryTreeBinding(authenticatedBefore),current);}catch{return false;}}
 static bool Subset(string authenticatedTree,Node current){if(string.IsNullOrEmpty(authenticatedTree)||authenticatedTree.Length>32768||!IsSafeTree(current))return false;var old=new HashSet<string>(authenticatedTree.Split('\n'),StringComparer.Ordinal);if(old.Count>128)return false;string root="|"+current.Id.ToUpperInvariant()+"|";bool rootMatched=false;foreach(string row in RecoveryTreeBinding(current).Split('\n')){if(!old.Contains(row))return false;if(row.StartsWith(root,StringComparison.Ordinal))rootMatched=true;}return rootMatched;}
 public static Node InspectRecovery(Plan authenticatedPlan,Action recoveryFence){return InspectRecovery(authenticatedPlan,recoveryFence,new Native());}
 internal static Node InspectRecovery(Plan plan,Action fence,IRecoveryDevice native){if(plan==null||fence==null)throw new ArgumentNullException();fence();if(string.IsNullOrEmpty(plan.RecoveryConnector)||string.IsNullOrEmpty(plan.RecoveryTree))throw new InvalidOperationException("missing_recovery_witness");string connector=native.ReadConnector(plan.Instance);var node=native.Read(plan.Instance);if(connector!=plan.RecoveryConnector||!string.Equals(node.Id,plan.Instance,StringComparison.OrdinalIgnoreCase)||!Subset(plan.RecoveryTree,node))throw new InvalidOperationException("recovery_identity_changed");fence();return node;}
 public static Result ExecuteRecovery(Plan authenticatedPlan,bool enable,Action recoveryFence){return ExecuteRecovery(authenticatedPlan,enable,recoveryFence,new Native());}
 internal static Result ExecuteRecovery(Plan plan,bool enable,Action fence,IRecoveryDevice native){var before=InspectRecovery(plan,fence,native);if(!enable&&!before.Disableable)return new Result("Failed",0,before.Status,before.Problem,false);fence();bool restart;int error=native.Change(plan.Instance,enable,out restart);if(error!=0)return new Result("Failed",error,before.Status,before.Problem,restart);var after=InspectRecovery(plan,fence,native);return Classify(enable,after,restart);}
 public static Plan Prepare(UsbAdmissionInventory.Result fresh,string exactInstance){return Prepare(fresh,exactInstance,new Native());}
 internal static Plan Prepare(UsbAdmissionInventory.Result fresh,string id,IDevice native){
  if(fresh==null||!fresh.Complete||fresh.Preflight==null||fresh.Preflight.State!="review_required"||fresh.Preflight.Unresolved!=0||string.IsNullOrEmpty(fresh.Preflight.TopologyToken))throw new InvalidOperationException("fresh_inventory_required");
  int matches=0;foreach(var c in fresh.Preflight.Candidates){if(string.Equals(c.Instance,id,StringComparison.OrdinalIgnoreCase)){if(c.Category!="external_approval_required")throw new InvalidOperationException("protected_input");matches++;}}
  if(matches!=1)throw new InvalidOperationException("ambiguous_target");var node=native.Read(id);if(!string.Equals(node.Id,id,StringComparison.OrdinalIgnoreCase)||!IsSafeTree(node))throw new InvalidOperationException("unsafe_target");var recovery=native as IRecoveryDevice;return new Plan(node.Id,fresh.Preflight.TopologyToken,TreeBinding(node),node.Status,node.Problem,node.Disableable,recovery==null?null:recovery.ReadConnector(node.Id),recovery==null?null:RecoveryTreeBinding(node));
 }
 public static Node Inspect(Plan plan){if(plan==null)throw new ArgumentNullException("plan");var native=new Native();var fresh=UsbAdmissionInventory.Collect(plan.Topology);Prepare(fresh,plan.Instance,native);return native.Read(plan.Instance);}
 public static Result Execute(Plan plan,bool enable,Action authorizedWriterFence){return Execute(plan,enable,authorizedWriterFence,new Native());}
 internal static Result Execute(Plan plan,bool enable,Action fence,IDevice native){
  if(plan==null||fence==null)throw new ArgumentNullException();fence();var fresh=UsbAdmissionInventory.Collect(plan.Topology);return ExecuteChecked(plan,enable,fence,native,fresh);
 }
 internal static Result ExecuteChecked(Plan plan,bool enable,Action fence,IDevice native,UsbAdmissionInventory.Result fresh){
  if(plan==null||fence==null)throw new ArgumentNullException();fence();var checkedPlan=Prepare(fresh,plan.Instance,native);if(checkedPlan.Topology!=plan.Topology||checkedPlan.Tree!=plan.Tree)throw new InvalidOperationException("target_changed");
  var node=native.Read(plan.Instance);if(!enable&&!node.Disableable)return new Result("Failed",0,node.Status,node.Problem,false);
  fence();bool restart;int error=native.Change(plan.Instance,enable,out restart);if(error!=0)return new Result("Failed",error,node.Status,node.Problem,restart);
  fence();var after=native.Read(plan.Instance);return Classify(enable,after,restart);
 }
 internal static Result Classify(bool enable,Node after,bool restart){if(restart)return new Result("Restart required",0,after.Status,after.Problem,true);if(enable&&after.Problem!=0)return new Result("Failed",0,after.Status,after.Problem,false);if(!enable&&after.Problem!=22)return new Result("Failed",0,after.Status,after.Problem,false);return new Result("Pending verification",0,after.Status,after.Problem,false);}
 [StructLayout(LayoutKind.Sequential)]struct DevInfo{public uint Size;public Guid Class;public uint Node;public UIntPtr Reserved;}
 [StructLayout(LayoutKind.Sequential)]struct Header{public uint Size,Function;}
 [StructLayout(LayoutKind.Sequential)]struct ChangeParams{public Header Header;public uint State,Scope,Profile;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct InstallParams{public uint Size,Flags,FlagsEx;public IntPtr Parent,Callback,Context,Queue;public UIntPtr Reserved;public uint Reserved2;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string Path;}
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr SetupDiGetClassDevsW(IntPtr cls,string enumerator,IntPtr parent,uint flags);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiOpenDeviceInfoW(IntPtr set,string id,IntPtr parent,uint flags,ref DevInfo info);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiSetClassInstallParamsW(IntPtr set,ref DevInfo info,ref ChangeParams parameters,uint size);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiCallClassInstaller(uint function,IntPtr set,ref DevInfo info);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiGetDeviceInstallParamsW(IntPtr set,ref DevInfo info,ref InstallParams parameters);
 [DllImport("setupapi.dll")]static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string id,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Child(out uint child,uint node,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Sibling(out uint sibling,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder text,uint length,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_Status(out uint status,out uint problem,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_DevNode_Registry_PropertyW(uint node,uint property,out uint type,byte[] buffer,ref uint length,uint flags);
 sealed class Native:IRecoveryDevice {
  [StructLayout(LayoutKind.Sequential)]struct PropertyKey{internal Guid Format;internal uint Id;}
  [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
  [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_PropertyW(uint node,ref PropertyKey key,out uint type,byte[] data,ref uint size,uint flags);
  public string ReadConnector(string id){uint node;if(CM_Locate_DevNodeW(out node,id,0)!=0)throw new InvalidOperationException("recovery_function_absent");var seen=new HashSet<uint>();var rows=new List<string>();bool rooted=false,external=false;int locationCount=0;var clock=Stopwatch.StartNew();for(int depth=0;depth<12&&seen.Add(node);depth++){
   if(clock.Elapsed.TotalSeconds>5)throw new InvalidOperationException("recovery_connector_bound");var text=new StringBuilder(513);if(CM_Get_Device_IDW(node,text,513,0)!=0)throw new InvalidOperationException("recovery_ancestor_unavailable");string current=text.ToString();if(current.IndexOfAny(new[]{'|','\n','\r'})>=0)throw new InvalidOperationException("recovery_ancestor_invalid");rows.Add("ID|"+current.ToUpperInvariant());if(current.StartsWith(@"HTREE\",StringComparison.OrdinalIgnoreCase)){rooted=true;break;}
   var key=new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=37};var bytes=new byte[16384];uint size=(uint)bytes.Length,type;uint result=CM_Get_DevNode_PropertyW(node,ref key,out type,bytes,ref size,0);if(result!=0&&result!=0x25)throw new InvalidOperationException("recovery_location_unavailable");if(result==0){var locations=UsbAdmissionInventory.DecodeStrings(bytes,size,type,true);Array.Sort(locations,StringComparer.Ordinal);foreach(var location in locations){if(location.IndexOfAny(new[]{'|','\n','\r'})>=0)throw new InvalidOperationException("recovery_location_invalid");rows.Add("LOCATION|"+location.ToUpperInvariant());locationCount++;}}
   if(current.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)&&current.IndexOf("&MI_",StringComparison.OrdinalIgnoreCase)<0){if(external)throw new InvalidOperationException("ambiguous_recovery_connector");var connector=UsbConnectorEvidence.ForUsbParent(current);if(connector.enumerationPartial||connector.matches!=1||connector.state!="user_connectable")throw new InvalidOperationException("protected_recovery_connector");external=true;}
   uint parent;if(CM_Get_Parent(out parent,node,0)!=0)throw new InvalidOperationException("recovery_ancestor_unavailable");node=parent;
  }if(!rooted||!external||locationCount==0||rows.Count>256)throw new InvalidOperationException("incomplete_recovery_connector");string witness=string.Join("\n",rows.ToArray());if(witness.Length>32768)throw new InvalidOperationException("recovery_connector_bound");return witness;}
  string[] Property(uint node,uint property,bool multi){var data=new byte[16384];uint size=(uint)data.Length,type;if(CM_Get_DevNode_Registry_PropertyW(node,property,out type,data,ref size,0)!=0||size<2||size>data.Length||size%2!=0||type!=(multi?7u:1u))throw new InvalidOperationException("native_property_unavailable");string s=Encoding.Unicode.GetString(data,0,(int)size);if(!s.EndsWith(multi?"\0\0":"\0",StringComparison.Ordinal))throw new InvalidOperationException("native_property_invalid");return s.TrimEnd('\0').Split('\0');}
  public Node Read(string id){uint node;if(CM_Locate_DevNodeW(out node,id,0)!=0)throw new InvalidOperationException("target_absent");int count=0;return ReadTree(node,new HashSet<uint>(),ref count,0,Stopwatch.StartNew());}
  Node ReadTree(uint node,HashSet<uint> seen,ref int count,int depth,Stopwatch clock){if(depth>16||++count>128||!seen.Add(node)||clock.Elapsed.TotalSeconds>5)throw new InvalidOperationException("native_tree_bound");var text=new StringBuilder(513);uint status,problem;if(CM_Get_Device_IDW(node,text,513,0)!=0||CM_Get_DevNode_Status(out status,out problem,node,0)!=0)throw new InvalidOperationException("native_status_unavailable");var children=new List<Node>();uint child;uint result=CM_Get_Child(out child,node,0);if(result!=0&&result!=13)throw new InvalidOperationException("native_children_unavailable");if(result==0){for(;;){children.Add(ReadTree(child,seen,ref count,depth+1,clock));uint sibling;result=CM_Get_Sibling(out sibling,child,0);if(result==13)break;if(result!=0)throw new InvalidOperationException("native_siblings_unavailable");child=sibling;}}
   return new Node(text.ToString(),Property(node,8,false)[0],depth==0?Property(node,3,true):new string[0],(status&0x2000)!=0,status,problem,children.ToArray());}
  public int Change(string id,bool enable,out bool restart){restart=false;IntPtr set=SetupDiGetClassDevsW(IntPtr.Zero,null,IntPtr.Zero,6);if(set==new IntPtr(-1))return Marshal.GetLastWin32Error();try{var info=new DevInfo{Size=(uint)Marshal.SizeOf(typeof(DevInfo))};if(!SetupDiOpenDeviceInfoW(set,id,IntPtr.Zero,0,ref info))return Marshal.GetLastWin32Error();
   // Enable globally first (DevCon convention), then configuration-specific.
   if(enable){int e=Transition(set,ref info,1,1);if(e!=0)return e;}
   int error=Transition(set,ref info,enable?1u:2u,2);if(error!=0)return error;
   var p=new InstallParams{Size=(uint)Marshal.SizeOf(typeof(InstallParams))};if(!SetupDiGetDeviceInstallParamsW(set,ref info,ref p))return Marshal.GetLastWin32Error();restart=(p.Flags&(0x80u|0x100u))!=0;return 0;
  }finally{SetupDiDestroyDeviceInfoList(set);}}
  static int Transition(IntPtr set,ref DevInfo info,uint state,uint scope){var p=new ChangeParams{Header=new Header{Size=(uint)Marshal.SizeOf(typeof(Header)),Function=0x12},State=state,Scope=scope};if(!SetupDiSetClassInstallParamsW(set,ref info,ref p,(uint)Marshal.SizeOf(typeof(ChangeParams))))return Marshal.GetLastWin32Error();return SetupDiCallClassInstaller(0x12,set,ref info)?0:Marshal.GetLastWin32Error();}
 }
}
