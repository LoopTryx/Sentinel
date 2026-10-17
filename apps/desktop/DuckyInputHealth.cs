using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

// Traverses only descendants of the native enrolled root. Never enables devices.
public static class DuckyInputHealth {
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern int CM_Locate_DevNodeW(out uint node,string id,int flags);
 [DllImport("cfgmgr32.dll")]static extern int CM_Get_Child(out uint child,uint node,int flags);
 [DllImport("cfgmgr32.dll")]static extern int CM_Get_Sibling(out uint sibling,uint node,int flags);
 [DllImport("cfgmgr32.dll")]static extern int CM_Get_DevNode_Status(out uint status,out uint problem,uint node,int flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern int CM_Get_Device_IDW(uint node,StringBuilder value,int length,int flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern int CM_Get_DevNode_Registry_PropertyW(uint node,uint property,out uint type,byte[] value,ref uint size,uint flags);
 const uint CM_DRP_CLASSGUID=9;
 public static string Classify(bool present,bool rootHealthy,bool hidPresent,bool childError){return !present?"disconnected":!rootHealthy||childError?"input_error":!hidPresent?"input_missing":"ready";}
 public static string Read(string target){
  uint root,status,problem;if(CM_Locate_DevNodeW(out root,target,0)!=0)return "disconnected";
  bool healthy=CM_Get_DevNode_Status(out status,out problem,root,0)==0&&problem==0,hid=false,error=false;
  var queue=new Queue<uint>();var seen=new HashSet<uint>();queue.Enqueue(root);
  while(queue.Count>0&&seen.Count<64){uint node=queue.Dequeue();if(!seen.Add(node)){error=true;continue;}
   if(node!=root){if(CM_Get_DevNode_Status(out status,out problem,node,0)!=0||problem!=0)error=true;var id=new StringBuilder(513);if(CM_Get_Device_IDW(node,id,513,0)!=0)error=true;else if(id.ToString().StartsWith("HID\\",StringComparison.OrdinalIgnoreCase)){var bytes=new byte[160];uint size=160,type;if(CM_Get_DevNode_Registry_PropertyW(node,CM_DRP_CLASSGUID,out type,bytes,ref size,0)!=0||type!=1||size<2||size>160)error=true;else if(Encoding.Unicode.GetString(bytes,0,(int)size).TrimEnd('\0').Equals("{4d36e96b-e325-11ce-bfc1-08002be10318}",StringComparison.OrdinalIgnoreCase))hid=true;}}
   uint child;if(CM_Get_Child(out child,node,0)==0){queue.Enqueue(child);int siblings=0;while(CM_Get_Sibling(out child,child,0)==0){if(++siblings>=64){error=true;break;}queue.Enqueue(child);}}
  }
  if(queue.Count>0)error=true;
  return Classify(true,healthy,hid,error);
 }
}
