using System;
using System.Diagnostics;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading.Tasks;

// Opens the fixed protected native operator. The WebView supplies no device IDs,
// policy bytes, owner identity, approval decision or privileged command arguments.
internal static class UsbAdmissionControl {
 static readonly string tabSession="sentinel-usb-tab-"+Guid.NewGuid().ToString("N");
 static Process panel;static string tabPipe;static bool tabBusy;static readonly System.Threading.SemaphoreSlim tabLock=new System.Threading.SemaphoreSlim(1,1);
 internal static bool IsOpen{get{var current=panel;try{return current!=null&&!current.HasExited&&(tabPipe==null||tabBusy);}catch{return false;}}}
 internal static bool HasBrokerProcess{get{try{return panel!=null&&!panel.HasExited;}catch{return false;}}}
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544";}
 static void Check(FileSystemSecurity acl){
  if(!Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value))throw new IOException("USB operator owner unavailable.");
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!Trusted(rule.IdentityReference.Value)&&(rule.FileSystemRights&(FileSystemRights.Write|FileSystemRights.Delete|FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership))!=0)throw new IOException("USB operator location is writable.");
 }
 internal static Task<string> Open(IntPtr owner){return Launch(owner,false);}
 static Task<string> Launch(IntPtr owner,bool tab){return Task.Run(()=>{
  try{
   string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelUsbAdmission"),exe=Path.Combine(directory,"Sentinel.UsbGuard.exe");
   using(var pin=new SentinelPolicyDirectory(directory)){
    Check(Directory.GetAccessControl(directory));
    if((File.GetAttributes(exe)&FileAttributes.ReparsePoint)!=0)return "operator_unavailable";
    using(var file=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read)){
     Check(file.GetAccessControl());
     string physical=VaultApproval.ResolveExecutable(exe);if(!physical.Equals(Path.GetFullPath(exe),StringComparison.OrdinalIgnoreCase))return "operator_unavailable";
     string nextPipe=tab?tabSession:null;
     var process=Process.Start(new ProcessStartInfo(physical,"--console "+Process.GetCurrentProcess().Id+" "+owner.ToInt64()+" "+Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks+(tab?" "+nextPipe:"")){UseShellExecute=true,Verb="runas",WorkingDirectory=directory,WindowStyle=ProcessWindowStyle.Normal});if(process==null)return "operator_unavailable";panel=process;tabPipe=nextPipe;process.Exited+=delegate{if(object.ReferenceEquals(panel,process))panel=null;process.Dispose();};process.EnableRaisingEvents=true;
    }
   }
   return null;
  }catch(System.ComponentModel.Win32Exception error){return error.NativeErrorCode==1223?"approval_cancelled":"operator_unavailable";}catch{return "operator_unavailable";}
 });}
 // Read-only browsing never launches an elevated process. A missing broker is
 // not a missing device inventory and is not evidence of an inactive rule.
 internal static async Task<string> ReadTabSnapshot(){
  if(!await tabLock.WaitAsync(0))return "{\"error\":\"action_busy\"}";
  try{
   bool ready=false;try{ready=panel!=null&&!panel.HasExited&&tabPipe!=null;}catch{}
   if(ready)try{string reply=await UsbAdmissionTabPipe.Exchange(tabPipe,panel.Id,panel.StartTime.ToUniversalTime().Ticks,"{\"action\":\"snapshot\"}");var value=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(reply);if(value!=null&&!value.ContainsKey("error"))return reply;}catch{}
   return await Task.Run(()=>new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(UsbAdmissionTabModel.Snapshot(UsbAdmissionInventory.Collect(null),tabSession,UsbExactBlockCapability.IsInstalled())));
  }catch{return "{\"error\":\"inventory_unavailable\"}";}finally{tabLock.Release();}
 }
 internal static async Task<string> TabRequest(IntPtr owner,string request){
  if(!await tabLock.WaitAsync(0))return "{\"error\":\"action_busy\"}";
  tabBusy=true;try{
   bool ready=false;try{ready=panel!=null&&!panel.HasExited&&tabPipe!=null;}catch{}
   if(!ready){string error=await Launch(owner,true);if(error!=null)return "{\"error\":\""+error+"\"}";}
   var current=panel;if(current==null||current.HasExited||tabPipe==null)return "{\"error\":\"operator_unavailable\"}";
   return await UsbAdmissionTabPipe.Exchange(tabPipe,current.Id,current.StartTime.ToUniversalTime().Ticks,request);
  }catch{return "{\"error\":\"operator_connection_lost\"}";}finally{tabBusy=false;tabLock.Release();}
 }
}
