using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Text;

internal sealed class UsbGuardArrivalLedger {
 readonly Dictionary<string,string> sessions=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
 internal string Arrive(string nativeParent){if(string.IsNullOrEmpty(nativeParent)||nativeParent.Length>512||nativeParent.IndexOf('\0')>=0||sessions.ContainsKey(nativeParent)||sessions.Count>=64)return null;string reference=Guid.NewGuid().ToString("N");sessions[nativeParent]=reference;return reference;}
 internal bool Current(string parent,string reference){string current;return sessions.TryGetValue(parent,out current)&&current==reference;}
 internal void Remove(string parent){sessions.Remove(parent);}
 internal void Clear(){sessions.Clear();}
 internal static bool ValidInterfaceSize(int size){return size>=30&&size<=4096&&size%2==0;}
}
// User-session notifications only. This is not the privileged admission service.
internal sealed class UsbGuardArrival:IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct Filter{public uint Size,Type,Reserved;public Guid Class;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr RegisterDeviceNotificationW(IntPtr recipient,ref Filter filter,uint flags);
 [DllImport("user32.dll")]static extern bool UnregisterDeviceNotification(IntPtr notification);
 [StructLayout(LayoutKind.Sequential)]struct PropertyKey{public Guid Format;public uint Id;}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern uint CM_Locate_DevNodeW(out uint node,string instance,uint flags);
 [DllImport("cfgmgr32.dll")]static extern uint CM_Get_DevNode_PropertyW(uint node,ref PropertyKey key,out uint type,byte[] buffer,ref uint size,uint flags);
 readonly UsbGuardArrivalLedger ledger=new UsbGuardArrivalLedger();readonly Dictionary<string,UsbGuardPopup> popups=new Dictionary<string,UsbGuardPopup>(StringComparer.OrdinalIgnoreCase);readonly Dictionary<string,string> interfaceRoots=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);IntPtr notification;bool disposed;int pending;
 internal int ArrivalCount{get;private set;}internal int PopupCount{get;private set;}internal int EventCount{get;private set;}internal int RejectedBroadcasts{get;private set;}internal int UnresolvedParents{get;private set;}internal bool Registered{get{return notification!=IntPtr.Zero;}}
 static readonly Guid UsbInterface=new Guid("a5dcbf10-6530-11d2-901f-00c04fb951ed");
 readonly Func<string,string,string,string,UsbGuardNotice> enrolledNotice;
 internal UsbGuardArrival(Window window,IntPtr handle,Func<string,string,string,string,UsbGuardNotice> noticeProvider=null){enrolledNotice=noticeProvider;var filter=new Filter{Size=(uint)Marshal.SizeOf(typeof(Filter)),Type=5,Class=UsbInterface};notification=RegisterDeviceNotificationW(handle,ref filter,0);}
 internal void Receive(IntPtr operation,IntPtr data){
  EventCount=Math.Min(1000000,EventCount+1);
  if(disposed||notification==IntPtr.Zero||data==IntPtr.Zero||(operation.ToInt64()!=0x8000&&operation.ToInt64()!=0x8004))return;
  int size=Marshal.ReadInt32(data);if(!UsbGuardArrivalLedger.ValidInterfaceSize(size)||Marshal.ReadInt32(data,4)!=5||(Guid)Marshal.PtrToStructure(IntPtr.Add(data,12),typeof(Guid))!=UsbInterface){RejectedBroadcasts=Math.Min(1000000,RejectedBroadcasts+1);return;}
  string path=Marshal.PtrToStringUni(IntPtr.Add(data,28),(size-28)/2);int end=path.IndexOf('\0');if(end<0)return;path=path.Substring(0,end);
  string root;
  if(operation.ToInt64()==0x8004){if(!interfaceRoots.TryGetValue(path,out root))return;interfaceRoots.Remove(path);foreach(string remaining in interfaceRoots.Values)if(string.Equals(remaining,root,StringComparison.OrdinalIgnoreCase))return;ledger.Remove(root);UsbGuardPopup popup;if(popups.TryGetValue(root,out popup)){popup.Disconnect();popups.Remove(root);}return;}
  if(interfaceRoots.ContainsKey(path)||interfaceRoots.Count>=128)return;string instance=UsbInputIdentity.InstanceFromInterface(path);root=UsbInputIdentity.PrivateUsbGroupFromInstance(instance);if(root==null){UnresolvedParents=Math.Min(1000000,UnresolvedParents+1);return;}interfaceRoots[path]=root;
  if(pending>=4)return;string reference=ledger.Arrive(root);if(reference==null)return;ArrivalCount=Math.Min(1000000,ArrivalCount+1);pending++;
  Inspect(root,reference);
 }
 async void Inspect(string root,string reference){
  try{
   var metadata=await Task.Run(()=>new{connector=UsbConnectorEvidence.ForUsbParent(root),name=Name(root),collections=UsbInputIdentity.CountInputCollectionsForInstance(root)});
   if(disposed||!ledger.Current(root,reference)||metadata.connector.state=="internal_port_candidate")return;
   // No admission service is installed yet; never offer a cosmetic release or
   // claim this post-arrival notification prevented the device's first input.
   string kind="USB connection";var type=metadata.collections.GetType();var keyboards=type.GetProperty("keyboards");var mice=type.GetProperty("mice");if(keyboards!=null&&mice!=null){int k=(int)keyboards.GetValue(metadata.collections,null),m=(int)mice.GetValue(metadata.collections,null);if(k>0&&m>0)kind="Keyboard and mouse input";else if(k>0)kind="Keyboard input";else if(m>0)kind="Mouse input";}
   if(popups.Count>=4)return;var popup=new UsbGuardPopup((enrolledNotice==null?null:enrolledNotice(root,reference,metadata.name,kind))??UsbGuardNotice.Unavailable(reference,metadata.name,kind,"service_unavailable"),null);popups[root]=popup;popup.Closed+=(s,e)=>{UsbGuardPopup current;if(popups.TryGetValue(root,out current)&&object.ReferenceEquals(current,popup))popups.Remove(root);};popup.Show();PopupCount=Math.Min(1000000,PopupCount+1);
  }catch{}finally{pending--;}
 }
 static string Name(string root){uint node;if(CM_Locate_DevNodeW(out node,root,0)!=0)return "USB device";foreach(var key in new[]{new PropertyKey{Format=new Guid("540b947e-8b40-45bc-a8a2-6a0b894cbda2"),Id=4},new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=14}}){var property=key;var bytes=new byte[512];uint size=512,type;if(CM_Get_DevNode_PropertyW(node,ref property,out type,bytes,ref size,0)==0&&type==18&&size>=2&&size<=512&&size%2==0)return Encoding.Unicode.GetString(bytes,0,(int)size).TrimEnd('\0');}return "USB device";}
 public void Dispose(){if(disposed)return;disposed=true;ledger.Clear();interfaceRoots.Clear();if(notification!=IntPtr.Zero){UnregisterDeviceNotification(notification);notification=IntPtr.Zero;}foreach(var popup in new List<UsbGuardPopup>(popups.Values))popup.Close();popups.Clear();}
}
