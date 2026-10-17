using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

// Read-only diagnostic. A port candidate is never an input exemption.
public static class UsbConnectorEvidence {
 [StructLayout(LayoutKind.Sequential)]struct PropertyKey{public Guid Format;public uint Id;}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string instance,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder buffer,uint size,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_PropertyW(uint node,ref PropertyKey key,out uint type,byte[] buffer,ref uint size,uint flags);
 public sealed class Result {public readonly string state;public readonly int matches;public readonly bool enumerationPartial,exemptionVerified=false;internal Result(string value,int count,bool partial){state=value;matches=count;enumerationPartial=partial;}}
 public static Result ForUsbParent(string instance){
  uint node;if(string.IsNullOrEmpty(instance)||instance.Length>512||!instance.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)||instance.IndexOf('\0')>=0||CM_Locate_DevNodeW(out node,instance,0)!=0)return new Result("unresolved",0,true);
  var key=new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=11};var bytes=new byte[1024];uint size=1024,type;
  if(CM_Get_DevNode_PropertyW(node,ref key,out type,bytes,ref size,0)!=0||type!=0x12||size<2||size>1024||size%2!=0)return new Result("unresolved",0,true);
  uint parent;var hub=new StringBuilder(513);if(CM_Get_Parent(out parent,node,0)!=0||CM_Get_Device_IDW(parent,hub,513,0)!=0)return new Result("unresolved",0,true);
  return QueryOnHub(Encoding.Unicode.GetString(bytes,0,(int)size).TrimEnd('\0'),hub.ToString());
 }
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_Interface_List_SizeW(out uint size,ref Guid guid,string device,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_Interface_ListW(ref Guid guid,string device,char[] buffer,uint size,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DeviceIoControl(SafeFileHandle file,uint code,byte[] input,uint inputSize,byte[] output,uint outputSize,out uint returned,IntPtr overlapped);
 static uint Code(uint function){return (0x22u<<16)|(function<<2);}
 static byte[] Read(SafeFileHandle hub,uint function,uint port,out uint returned){var input=new byte[4096];BitConverter.GetBytes(port).CopyTo(input,0);var output=new byte[4096];if(!DeviceIoControl(hub,Code(function),input,(uint)input.Length,output,(uint)output.Length,out returned,IntPtr.Zero))return null;return output;}
 public static string ParseConnection(byte[] bytes,uint port,uint returned){
  if(bytes==null||port==0||port>64||returned<35||returned>bytes.Length||returned>4096)return "unresolved";
  uint index=BitConverter.ToUInt32(bytes,0),status=BitConverter.ToUInt32(bytes,31);
  if(status==1)return index==port?"connected":"unresolved";
  if(status!=0||(index!=0&&index!=port))return "unresolved";
  // This host returns a successful, zeroed 35-byte record for unoccupied ports.
  // Never interpret a failed query, short record or populated descriptor as empty.
  for(int i=4;i<returned;i++)if(bytes[i]!=0)return "unresolved";
  return "empty";
 }
 public static string Parse(byte[] bytes,uint port,uint returned){
  if(bytes==null||port==0||port>64||returned<18||returned>bytes.Length||BitConverter.ToUInt32(bytes,0)!=port)return "unresolved";
  uint length=BitConverter.ToUInt32(bytes,4),flags=BitConverter.ToUInt32(bytes,8);
  if(length<18||length>returned||length>4096||length%2!=0||(flags&0xfffffff0u)!=0)return "unresolved";
  if((flags&1)!=0)return "user_connectable";
  // Companion routes require separate topology proof, not an inferred internal port.
  if((flags&4)!=0||BitConverter.ToUInt16(bytes,12)!=0||BitConverter.ToUInt16(bytes,14)!=0||bytes[16]!=0||bytes[17]!=0)return "unresolved";
  return "internal_port_candidate";
 }
 public static Result Query(string privateDriverKey){
  return QueryOnHub(privateDriverKey,null);
 }
 static Result QueryOnHub(string privateDriverKey,string privateHubInstance){
  if(string.IsNullOrEmpty(privateDriverKey)||privateDriverKey.Length>512||privateDriverKey.IndexOf('\0')>=0)return new Result("unresolved",0,true);
  Guid guid=new Guid("f18a0e88-c30c-11d0-8815-00a0c906bed8");uint size;
  if(CM_Get_Device_Interface_List_SizeW(out size,ref guid,privateHubInstance,0)!=0||size<2||size>16384)return new Result("unavailable",0,true);
  var list=new char[size];if(CM_Get_Device_Interface_ListW(ref guid,privateHubInstance,list,size,0)!=0)return new Result("unavailable",0,true);
  int hubs=0,matches=0;string result="unresolved";bool partial=false;
  foreach(string path in new string(list).Split('\0')){
   if(path.Length==0)continue;if(++hubs>16||path.Length>1024||!path.StartsWith(@"\\?\")){partial=true;break;}
   using(var hub=CreateFileW(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)){
    if(hub.IsInvalid){partial=true;continue;}uint returned;byte[] info=Read(hub,277,0,out returned);
    if(info==null||returned<6){partial=true;continue;}uint ports=BitConverter.ToUInt16(info,4);if(ports==0||ports>64){partial=true;continue;}
    for(uint port=1;port<=ports;port++){
     byte[] connection=Read(hub,274,port,out returned);string connectionState=ParseConnection(connection,port,returned);if(connectionState=="empty")continue;if(connectionState!="connected"){partial=true;continue;}
     byte[] key=Read(hub,264,port,out returned);if(key==null||returned<10||returned>4096){partial=true;continue;}
     uint length=BitConverter.ToUInt32(key,4);if(BitConverter.ToUInt32(key,0)!=port||length<10||length>returned||length%2!=0){partial=true;continue;}
     string driver=Encoding.Unicode.GetString(key,8,(int)length-8);int end=driver.IndexOf('\0');if(end<=0){partial=true;continue;}driver=driver.Substring(0,end);
     if(!string.Equals(driver,privateDriverKey,StringComparison.OrdinalIgnoreCase))continue;
     matches++;byte[] connector=Read(hub,278,port,out returned);result=Parse(connector,port,returned);
    }
   }
  }
  return new Result(matches==1&&!partial?result:"unresolved",matches,partial);
 }
}
