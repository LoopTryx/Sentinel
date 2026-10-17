using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

// Read-only advisory metadata classification. No privilege, IPC, approval or policy.
public static class UsbInternalDetection {
 [StructLayout(LayoutKind.Sequential)]struct PropertyKey{public Guid Format;public uint Id;}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string instance,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder buffer,uint size,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_DevNode_PropertyW(uint node,ref PropertyKey key,out uint type,byte[] buffer,ref uint size,uint flags);
 static string Property(uint node,uint property,uint expected){var key=new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=property};var bytes=new byte[4096];uint size=4096,type;if(CM_Get_DevNode_PropertyW(node,ref key,out type,bytes,ref size,0)!=0||type!=expected||size<2||size>4096||size%2!=0)return null;return Encoding.Unicode.GetString(bytes,0,(int)size);}
 public static bool HasTouchpadUsage(string ids){if(ids==null||ids.Length>2048)return false;foreach(string id in ids.Split('\0'))if(id.Length<=512&&System.Text.RegularExpressions.Regex.IsMatch(id,@"(^|[\\&_])UP[:_]000D[_&]U[:_]0005($|[&])",System.Text.RegularExpressions.RegexOptions.IgnoreCase))return true;return false;}
 public static Result ReadForInstance(string instance,string deviceClass){
  if(string.IsNullOrEmpty(instance)||instance.Length>512||instance.IndexOf('\0')>=0)return new Result("unresolved","unknown","invalid_instance");
  uint node;if(CM_Locate_DevNodeW(out node,instance,0)!=0)return new Result("unresolved","unknown","native_metadata_unavailable");
  var enumerators=new List<string>();var seen=new HashSet<uint>();var services=new HashSet<string>(StringComparer.OrdinalIgnoreCase);bool complete=false,touchpad=false;
  for(int depth=0;depth<12&&seen.Add(node);depth++){
   var id=new StringBuilder(513);if(CM_Get_Device_IDW(node,id,513,0)!=0)break;int separator=id.ToString().IndexOf('\\');if(separator<=0)break;string enumerator=id.ToString().Substring(0,separator);enumerators.Add(enumerator);
   if(enumerator.Equals("HTREE",StringComparison.OrdinalIgnoreCase)){complete=true;break;}
   if(depth==0)touchpad=HasTouchpadUsage(Property(node,4,0x2012))||HasTouchpadUsage(Property(node,3,0x2012));
   string service=Property(node,6,0x12);if(service!=null){service=service.TrimEnd('\0');if(service.Equals("hidi2c",StringComparison.OrdinalIgnoreCase)||service.Equals("i8042prt",StringComparison.OrdinalIgnoreCase))services.Add(service);}
   uint parent;if(CM_Get_Parent(out parent,node,0)!=0)break;node=parent;
  }
  string transport="";if(services.Count==1)foreach(string service in services)transport=service;
  return Classify(enumerators.ToArray(),transport,deviceClass,touchpad,complete);
 }
 public sealed class Result {
  public readonly string State,Role,Evidence;
  public readonly bool ExemptionVerified=false;
  internal Result(string state,string role,string evidence){State=state;Role=role;Evidence=evidence;}
 }
 public static Result Classify(string[] enumerators,string transportService,string deviceClass,bool touchpadUsage,bool complete){
  var unresolved=new Result("unresolved","unknown","insufficient_transport_evidence");
  if(!complete||enumerators==null||enumerators.Length==0||enumerators.Length>12||transportService==null||transportService.Length>64||deviceClass==null||deviceClass.Length>32)return unresolved;
  var chain=new HashSet<string>(StringComparer.OrdinalIgnoreCase);bool bluetooth=false;
  foreach(string item in enumerators){if(string.IsNullOrEmpty(item)||item.Length>32)return unresolved;foreach(char c in item)if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'))return unresolved;chain.Add(item);if(item.StartsWith("BTH",StringComparison.OrdinalIgnoreCase))bluetooth=true;}
  if(!enumerators[enumerators.Length-1].Equals("HTREE",StringComparison.OrdinalIgnoreCase))return unresolved;
  if(bluetooth)return new Result("external_bluetooth","input","bluetooth_ancestry");
  // USB at any level wins over ACPI ancestors. Connector proof is a separate native query.
  if(chain.Contains("USB")||chain.Contains("USBSTOR"))return new Result("unresolved_usb","input","connector_evidence_required");
  if(!chain.Contains("ACPI"))return unresolved;
  if(transportService.Equals("i8042prt",StringComparison.OrdinalIgnoreCase)&&(deviceClass.Equals("Keyboard",StringComparison.OrdinalIgnoreCase)||deviceClass.Equals("Mouse",StringComparison.OrdinalIgnoreCase)))return new Result("internal_candidate",deviceClass.ToLowerInvariant(),"acpi_ps2_transport");
  if(transportService.Equals("hidi2c",StringComparison.OrdinalIgnoreCase)&&touchpadUsage&&deviceClass.Equals("HIDClass",StringComparison.OrdinalIgnoreCase))return new Result("internal_candidate","touchpad","acpi_i2c_touchpad_usage");
  return unresolved;
 }
}
