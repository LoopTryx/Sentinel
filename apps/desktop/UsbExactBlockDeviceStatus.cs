using System;
using System.Runtime.InteropServices;
// Read-only observation. A committed installation rule is not an input-gate proof.
internal static class UsbExactBlockDeviceStatus {
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string id,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_Status(out uint status,out uint problem,uint node,uint flags);
 internal static bool Stopped(string exactId){UsbExactBlockState.ValidateId(exactId);uint node,status,problem;if(CM_Locate_DevNodeW(out node,exactId,0)!=0||CM_Get_DevNode_Status(out status,out problem,node,0)!=0)return false;return (status&8)==0;}
}
