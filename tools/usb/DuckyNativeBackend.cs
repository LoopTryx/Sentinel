using System;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
public static class SentinelDuckyNative {
 [StructLayout(LayoutKind.Sequential)] struct Key {public Guid Format;public uint Id;}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string id,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder text,uint length,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_DevNode_PropertyW(uint node,ref Key key,out uint type,byte[] value,ref uint size,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_Status(out uint status,out uint problem,uint node,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Enable_DevNode(uint node,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Disable_DevNode(uint node,uint flags);
 static void Check(uint result){if(result!=0)throw new InvalidOperationException("native_configuration_error_"+result);}
 static uint Target(string id,string root){
  if(id==null||root==null||id.Length>512||root.Length>512||!Regex.IsMatch(id,@"\AHID\\[A-Za-z0-9_&\\{}#-]+\z")||!Regex.IsMatch(root,@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}[^\\]*\\[A-Za-z0-9_&{}#-]+\z")||root.Contains("&MI_"))throw new ArgumentException("invalid_target");
  uint node;Check(CM_Locate_DevNodeW(out node,id,0));
  var classKey=new Key{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=10};uint type,size=16;var bytes=new byte[16];Check(CM_Get_DevNode_PropertyW(node,ref classKey,out type,bytes,ref size,0));
  if(type!=13||size!=16||new Guid(bytes)!=new Guid("4d36e96b-e325-11ce-bfc1-08002be10318"))throw new InvalidOperationException("not_keyboard");
  uint cursor=node;bool found=false;
  for(int i=0;i<6;i++){uint parent;Check(CM_Get_Parent(out parent,cursor,0));var text=new StringBuilder(513);Check(CM_Get_Device_IDW(parent,text,513,0));if(string.Equals(text.ToString(),root,StringComparison.OrdinalIgnoreCase)){cursor=parent;found=true;break;}cursor=parent;}
  if(!found)throw new InvalidOperationException("board_ancestry_changed");
  var nameKey=new Key{Format=new Guid("540b947e-8b40-45bc-a8a2-6a0b894cbda2"),Id=4};size=512;bytes=new byte[512];Check(CM_Get_DevNode_PropertyW(cursor,ref nameKey,out type,bytes,ref size,0));
  if(type!=18||size<2||size>512||size%2!=0||Encoding.Unicode.GetString(bytes,0,(int)size).TrimEnd('\0')!="RP2040-Zero")throw new InvalidOperationException("not_selected_board");return node;
 }
 static int Problem(uint node){uint status,problem;Check(CM_Get_DevNode_Status(out status,out problem,node,0));return (int)problem;}
 public static string[] HardwareIds(string id,string root){uint node=Target(id,root);var key=new Key{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=3};uint type,size=4096;var bytes=new byte[4096];Check(CM_Get_DevNode_PropertyW(node,ref key,out type,bytes,ref size,0));if(type!=8210||size<2||size>4096||size%2!=0)throw new InvalidOperationException("invalid_hardware_identity");var result=new System.Collections.Generic.List<string>();foreach(string value in Encoding.Unicode.GetString(bytes,0,(int)size).Split(new[]{'\0'},StringSplitOptions.RemoveEmptyEntries))if(value.Length<=512&&Regex.IsMatch(value,@"\AHID\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}"))result.Add(value);if(result.Count==0||result.Count>16)throw new InvalidOperationException("missing_hardware_identity");return result.ToArray();}
 public static int Read(string id,string root){return Problem(Target(id,root));}
 public static int Enable(string id,string root){uint node=Target(id,root);int prior=Problem(node);if(prior!=0&&prior!=22)throw new InvalidOperationException("unowned_device_problem");Check(CM_Enable_DevNode(node,0));return Problem(Target(id,root));}
 public static int Disable(string id,string root){uint node=Target(id,root);if(Problem(node)!=0)throw new InvalidOperationException("already_unhealthy");Check(CM_Disable_DevNode(node,1));return Problem(Target(id,root));}
}

