using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

// Native read-only inventory. IDs remain private in the returned in-memory subjects.
public static class UsbAdmissionInventory {
 // Windows SDK cfgmgr32.h: ENUMERATOR=0x1, PRESENT=0x100.
 // https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/cfgmgr32.h
 // Property IDs follow shared/devpkey.h in the same Microsoft SDK mirror.
 const uint PresentUsb=0x101,MissingProperty=0x25;
 [StructLayout(LayoutKind.Sequential)]struct Key{public Guid Format;public uint Id;}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_ID_List_SizeW(out uint size,string filter,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_ID_ListW(string filter,char[] list,uint size,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string instance,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_Parent(out uint parent,uint node,uint flags);
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Get_Device_IDW(uint node,StringBuilder value,uint size,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_PropertyW(uint node,ref Key key,out uint type,byte[] buffer,ref uint size,uint flags);
 static readonly Guid DeviceProperties=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),BusProperties=new Guid("540b947e-8b40-45bc-a8a2-6a0b894cbda2");
 public sealed class Subject{public UsbAdmissionPreflight.Input Input;public string DisplayName;}
 public sealed class Result{public UsbAdmissionPreflight.Result Preflight;public Subject[] Subjects;public int PresentUsbNodes,PropertyQueries;public bool Complete;public string FailureCode;}
 public static string[] DecodeStrings(byte[] bytes,uint size,uint type,bool multiple){
  if(bytes==null||size>bytes.Length||size>16384||size%2!=0||size<2||type!=(multiple?0x2012u:0x12u))throw new InvalidOperationException("invalid_property");
  if(multiple&&size==2&&bytes[0]==0&&bytes[1]==0)return new string[0];
  string text=new UnicodeEncoding(false,false,true).GetString(bytes,0,(int)size);
  if(!text.EndsWith(multiple?"\0\0":"\0",StringComparison.Ordinal))throw new InvalidOperationException("invalid_property");
  var result=new List<string>();foreach(string item in text.Substring(0,text.Length-(multiple?2:1)).Split('\0')){if(item.Length==0){if(multiple&&text=="\0\0")return new string[0];throw new InvalidOperationException("invalid_property");}if(item.Length>512||result.Count>=64)throw new InvalidOperationException("invalid_property");result.Add(item);}
  if(!multiple&&result.Count!=1)throw new InvalidOperationException("invalid_property");return result.ToArray();
 }
 public static string[] DecodeEnumeration(char[] bytes,uint size){
  if(bytes==null||size>bytes.Length||size<2||size>131072)throw new InvalidOperationException("invalid_enumeration");
  string text=new string(bytes,0,(int)size);int end=text.IndexOf("\0\0",StringComparison.Ordinal);if(end<0)throw new InvalidOperationException("invalid_enumeration");
  for(int i=end;i<text.Length;i++)if(text[i]!='\0')throw new InvalidOperationException("invalid_enumeration");
  if(end==0)return new string[0];string[] ids=text.Substring(0,end).Split('\0');if(ids.Length>256)throw new InvalidOperationException("inventory_bound");var unique=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(string id in ids)if(id.Length>512||!id.StartsWith(@"USB\",StringComparison.OrdinalIgnoreCase)||!unique.Add(id))throw new InvalidOperationException("invalid_enumeration");return ids;
 }
 static string Failure(Exception error){string value=error.Message;if(value!=null&&value.Length<=96&&System.Text.RegularExpressions.Regex.IsMatch(value,@"^(?:inventory_bound|invalid_enumeration|enumeration_unavailable|topology_changed|topology_unavailable|property_unavailable_[0-9]+_status_[0-9]+|property_decode_[0-9]+_type_[0-9]+_size_[0-9]+)$"))return value;return "inventory_unavailable";}
 public static string Display(string raw){if(string.IsNullOrWhiteSpace(raw))return "USB input device";var b=new StringBuilder();foreach(char c in raw){if(b.Length==64)break;if(c>=' '&&c<='~'&&c!='<'&&c!='>'&&c!='&')b.Append(c);}string value=b.ToString().Trim();return value.Length==0?"USB input device":value;}
 sealed class Reader {
  public int Queries;public Stopwatch Clock=Stopwatch.StartNew();readonly Dictionary<string,string[]> properties=new Dictionary<string,string[]>(StringComparer.OrdinalIgnoreCase);
  public void Budget(){if(Queries>=512||Clock.Elapsed.TotalSeconds>=60)throw new InvalidOperationException("inventory_bound");}
  public string[] Read(uint node,Guid format,uint property,bool multiple){string cache=node+":"+format+":"+property;string[] found;if(properties.TryGetValue(cache,out found))return found;Budget();Queries++;var key=new Key{Format=format,Id=property};var bytes=new byte[16384];uint size=16384,type;uint status=CM_Get_DevNode_PropertyW(node,ref key,out type,bytes,ref size,0);if(status==MissingProperty)found=new string[0];else{if(status!=0)throw new InvalidOperationException("property_unavailable_"+property+"_status_"+status);try{found=DecodeStrings(bytes,size,type,multiple);}catch{throw new InvalidOperationException("property_decode_"+property+"_type_"+type+"_size_"+size);}}properties.Add(cache,found);Budget();return found;}
 }
 public static Result Collect(string expectedTopologyToken){
  var result=new Result();var reader=new Reader();var subjects=new List<Subject>();var connectors=new Dictionary<string,UsbConnectorEvidence.Result>(StringComparer.OrdinalIgnoreCase);bool complete=true;
  try{
   uint size;if(CM_Get_Device_ID_List_SizeW(out size,"USB",PresentUsb)!=0||size<2||size>131072)throw new InvalidOperationException("enumeration_unavailable");var list=new char[size];if(CM_Get_Device_ID_ListW("USB",list,size,PresentUsb)!=0)throw new InvalidOperationException("enumeration_unavailable");string[] ids=DecodeEnumeration(list,size);result.PresentUsbNodes=ids.Length;
   foreach(string id in ids){reader.Budget();uint leaf;if(CM_Locate_DevNodeW(out leaf,id,0)!=0)throw new InvalidOperationException("topology_changed");string[] compatible=reader.Read(leaf,DeviceProperties,4,true);bool match=false;foreach(string value in compatible)if(value.Equals(@"USB\Class_03",StringComparison.OrdinalIgnoreCase))match=true;if(!match)continue;
    var input=new UsbAdmissionPreflight.Input{Instance=id,CompatibleIds=compatible,TransportService="",DeviceClass="HIDClass"};var chain=new List<string>();var locations=new List<string>();var seen=new HashSet<uint>();uint node=leaf;string display=null;
    for(int depth=0;depth<12&&seen.Add(node);depth++){
     reader.Budget();var text=new StringBuilder(513);if(CM_Get_Device_IDW(node,text,513,0)!=0)throw new InvalidOperationException("topology_unavailable");string current=text.ToString();chain.Add(current);if(current.StartsWith(@"HTREE\",StringComparison.OrdinalIgnoreCase)){input.Complete=true;break;}
     locations.AddRange(reader.Read(node,DeviceProperties,37,true));
     if(current.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)&&current.IndexOf("&MI_",StringComparison.OrdinalIgnoreCase)<0){
      UsbConnectorEvidence.Result connector;if(!connectors.TryGetValue(current,out connector)){connector=UsbConnectorEvidence.ForUsbParent(current);connectors.Add(current,connector);}reader.Budget();input.ConnectorState=connector.state;input.ConnectorMatches=connector.matches;input.ConnectorPartial=connector.enumerationPartial;
      string[] name=reader.Read(node,BusProperties,4,false);if(name.Length>0)display=name[0];
     }
     uint parent;if(CM_Get_Parent(out parent,node,0)!=0)break;node=parent;
    }
    input.ParentChain=chain.ToArray();input.LocationPaths=locations.ToArray();if(!input.Complete)complete=false;subjects.Add(new Subject{Input=input,DisplayName=Display(display)});
   }
  }catch(Exception error){complete=false;result.FailureCode=Failure(error);}
  var inputs=new List<UsbAdmissionPreflight.Input>();foreach(var subject in subjects)inputs.Add(subject.Input);result.Subjects=subjects.ToArray();result.PropertyQueries=reader.Queries;result.Complete=complete;result.Preflight=UsbAdmissionPreflight.EvaluateUsbHid(inputs.ToArray(),complete,expectedTopologyToken);return result;
 }
}
