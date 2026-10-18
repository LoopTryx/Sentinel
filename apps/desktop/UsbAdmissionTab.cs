using System;
using System.Collections.Generic;
using System.Text;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;
internal sealed partial class UsbAdmissionWindow {
 readonly string tabPipeName; readonly CancellationTokenSource tabCancellation=new CancellationTokenSource();
 string tabIntentSummary;
 readonly string tabSalt=Guid.NewGuid().ToString("N");
 string TabReference(string id){return UsbAdmissionTabModel.Reference(tabPipeName??tabSalt,id);}
 void StartTabServer(){
  Task.Run(async()=>{try{await UsbAdmissionTabPipe.Serve(tabPipeName,consoleOwner.ProcessId,consoleOwner.ProcessStartTicks,DispatchTab,tabCancellation.Token);}catch{}finally{if(!IsDisposed)try{BeginInvoke(new Action(()=>{if(!busy)Close();else closing=true;}));}catch{}}});
 }
 Task<string> DispatchTab(string raw){
  var completion=new TaskCompletionSource<string>();
  try{BeginInvoke(new Action(async()=>{try{completion.SetResult(await TabRequest(raw));}
#if SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED
catch(UsbHidAdmissionOperations.OperationFailure error){if(error.RecoveryRequired){completion.SetResult("{\"error\":\"usb_recovery_required\"}");return;}completion.SetResult("{\"error\":\"usb_failed_"+error.Stage+"_"+error.NativeHResult.ToString("X8")+"\",\"hresult\":\""+error.NativeHResult.ToString("X8")+"\"}");}
#endif
catch(InvalidOperationException error){completion.SetResult(error.Message=="An interrupted USB decision requires recovery"?"{\"error\":\"usb_recovery_required\"}":"{\"error\":\"usb_action_unverified\"}");}catch{completion.SetResult("{\"error\":\"usb_action_unverified\"}");}}));}catch{completion.TrySetResult("{\"error\":\"operator_unavailable\"}");}return completion.Task;
 }
 async Task<string> TabRequest(string raw){
  if(raw==null||raw.Length>4096||busy||UsbOwnerVerification.HasPending)return "{\"error\":\"action_busy\"}";
  var json=new JavaScriptSerializer{MaxJsonLength=32768,RecursionLimit=8};var request=json.Deserialize<Dictionary<string,object>>(raw);
  object operation; if(request==null||!request.TryGetValue("action",out operation)||!(operation is string))return "{\"error\":\"invalid_request\"}";
  string action=(string)operation;
  if(action=="connect"){if(request.Count!=1)return "{\"error\":\"invalid_request\"}";action="snapshot";request["action"]="snapshot";}
#if SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED
  if(UsbHidAdmissionCapability.IsInstalled())return await HidTabRequest(request,action,json);
#endif
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
  if(UsbExactBlockCapability.IsInstalled())return await ExactTabRequest(request,action,json);
#endif
  if(action=="snapshot"){if(request.Count!=1)return "{\"error\":\"invalid_request\"}";await RefreshView(true,false);return json.Serialize(TabSnapshot());}
  if((action!="allow"&&action!="block")||request.Count!=3||!request.ContainsKey("ref")||!request.ContainsKey("topology"))return "{\"error\":\"invalid_request\"}";
  string reference=request["ref"] as string,topology=request["topology"] as string;
  if(!HexTab(reference)||!HexTab(topology))return "{\"error\":\"invalid_request\"}";
  if(action=="block")return "{\"error\":\"device_scope_repair_required\"}";
  await RefreshView(true,false);
  if(active!=null)return "{\"error\":\"shared_rule_release_required\"}";
  if(inventory==null||!inventory.Complete||inventory.Preflight==null||inventory.Preflight.State!="review_required"||inventory.Preflight.TopologyToken!=topology)return "{\"error\":\"device_list_changed\"}";
  List<string> selected=null;foreach(var group in ExternalGroups())if(TabReference(group.Key)==reference)selected=group.Value;
  if(selected==null)return "{\"error\":\"device_unavailable\"}";
  string targetName="USB input device";foreach(var subject in inventory.Subjects)if(selected.Contains(subject.Input.Instance)){targetName=UsbAdmissionInventory.Display(subject.DisplayName);break;}
  tabIntentSummary=(action=="allow"?"Allow ":"Block ")+targetName+" · "+selected.Count+" input interfaces";
  // Only the protected operator owns the Hello foreground window. Renderer input is never a proof.
  try{
   Opacity=1;ShowInTaskbar=false;Text="Sentinel · Confirm USB access";heading.Text=action=="allow"?"Allow USB device":"Block USB device";cards.Visible=false;devices.Visible=false;arm.Visible=false;release.Visible=false;refresh.Visible=false;back.Visible=false;
   ClientSize=new Size(660,330);StartPosition=FormStartPosition.CenterScreen;Show();Activate();BringToFront();
   // Allow must never arm a class-wide deny or restart unrelated interfaces.
   // With an active shared rule the request is refused above, before mutation.
   SetBusy(true);try{if(await ReleaseWithHello(true,selected.ToArray()))message.Text=recoveryStatus??"Input recovery attempted. Test the selected device.";}finally{SetBusy(false);FinishClose();}
  }finally{Hide();Opacity=0;tabIntentSummary=null;}
  await RefreshView(true,false);return json.Serialize(TabSnapshot());
 }
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
 async Task<string> ExactTabRequest(Dictionary<string,object> request,string action,JavaScriptSerializer json){
  if(action=="snapshot"){
   if(request.Count!=1)return "{\"error\":\"invalid_request\"}";
   inventory=await Task.Run(()=>UsbAdmissionInventory.Collect(null));
   var state=await UsbExactBlockOperations.ReadVerified();return json.Serialize(ExactTabSnapshot(state));
  }
  if((action!="allow"&&action!="block")||request.Count!=3)return "{\"error\":\"invalid_request\"}";
  object rawRef,rawTopology;if(!request.TryGetValue("ref",out rawRef)||!request.TryGetValue("topology",out rawTopology)||!HexTab(rawRef as string)||!HexTab(rawTopology as string))return "{\"error\":\"invalid_request\"}";
  try{
   Opacity=1;ShowInTaskbar=false;Text="Sentinel · Confirm USB access";heading.Text=action=="allow"?"Allow USB device":"Block USB device";cards.Visible=false;devices.Visible=false;arm.Visible=false;release.Visible=false;refresh.Visible=false;back.Visible=false;
   ClientSize=new Size(660,330);StartPosition=FormStartPosition.CenterScreen;Show();Activate();BringToFront();SetBusy(true);
   message.Text="Verify Windows Hello. Keep the selected device connected…";
   var result=await UsbExactBlockOperations.Change(Handle,action,(string)rawRef,tabPipeName??tabSalt,(string)rawTopology,true,false,name=>{summary.Text=(action=="allow"?"Allow ":"Block ")+name;});
   message.Text=result.RestartRequired?"Windows requires a restart to finish this change.":action=="allow"?"Selected rule removed. Reconnect this device and test its input; Windows may require a restart.":"Selected Windows rule verified. Reconnect this device and test that input is stopped.";
   inventory=await Task.Run(()=>UsbAdmissionInventory.Collect(null));return json.Serialize(ExactTabSnapshot(result.State));
  }finally{SetBusy(false);Hide();Opacity=0;FinishClose();}
 }
 object ExactTabSnapshot(UsbExactBlockState.Snapshot state){
  bool complete=inventory!=null&&inventory.Complete&&inventory.Preflight!=null&&inventory.Preflight.State=="review_required";
  var blocked=new HashSet<string>(state==null?new string[0]:state.Blocked,StringComparer.OrdinalIgnoreCase);var result=new List<object>();
  if(complete)foreach(var group in ExternalGroups()){
   string name="USB input device";foreach(var subject in inventory.Subjects)if(subject!=null&&subject.Input!=null&&group.Value.Exists(id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){name=subject.DisplayName;break;}
   bool allBlocked=group.Value.TrueForAll(id=>blocked.Contains(id)),noneBlocked=group.Value.TrueForAll(id=>!blocked.Contains(id));
   result.Add(new Dictionary<string,object>{{"ref",TabReference(group.Key)},{"name",UsbAdmissionInventory.Display(name)},{"access",allBlocked?(group.Value.TrueForAll(id=>UsbExactBlockDeviceStatus.Stopped(id))?"restricted":"policy_only"):noneBlocked?"allowed":"unverified"},{"canChange",complete},{"canBlock",!allBlocked},{"canScan",false}});
  }
  var represented=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var group in ExternalGroups())foreach(string id in group.Value)represented.Add(id);
  foreach(string id in blocked)if(!represented.Contains(id))result.Add(new Dictionary<string,object>{{"ref",TabReference(id)},{"name","Disconnected blocked input"},{"access","policy_only"},{"canChange",complete},{"canBlock",false},{"canScan",false}});
  return new{schemaVersion=1,verified=true,topology=complete?inventory.Preflight.TopologyToken:null,active=blocked.Count>0,persistent=true,deadline=(string)null,devices=result,message=message.Text??""};
 }
#endif
 static bool HexTab(string text){return text!=null&&System.Text.RegularExpressions.Regex.IsMatch(text,"^[a-f0-9]{64}$");}
 Dictionary<string,List<string>> ExternalGroups(){return UsbAdmissionTabModel.Groups(inventory);}
 object TabSnapshot(){
  bool complete=inventory!=null&&inventory.Complete&&inventory.Preflight!=null&&inventory.Preflight.State=="review_required";
  bool verified=active!=null&&config!=null&&verifiedNonce==active.Nonce&&(DateTime.UtcNow-verifiedAt).TotalSeconds<30&&DateTime.UtcNow<active.DeadlineUtc&&Convert.ToBase64String(Policy(config))==Convert.ToBase64String(active.Policy);
  var approved=new HashSet<string>(config==null?new string[0]:config.ApprovedExternal,StringComparer.OrdinalIgnoreCase);var result=new List<object>();
  if(complete)foreach(var group in ExternalGroups()){
   string name="USB input device";foreach(var subject in inventory.Subjects)if(group.Value.Contains(subject.Input.Instance)){name=subject.DisplayName;break;}
   bool allAllowed=group.Value.TrueForAll(id=>approved.Contains(id));bool noneAllowed=group.Value.TrueForAll(id=>!approved.Contains(id));
   result.Add(new Dictionary<string,object>{{"ref",TabReference(group.Key)},{"name",UsbAdmissionInventory.Display(name)},{"access",verified?(allAllowed?"allowed":noneAllowed?"restricted":"unverified"):verifiedOff?"off":"unverified"},{"canChange",!staged&&active==null},{"canBlock",false},{"canScan",false}});
  }
  return new{schemaVersion=1,verified=verified||verifiedOff,topology=complete?inventory.Preflight.TopologyToken:null,active=verified,deadline=active==null?null:active.DeadlineUtc.ToString("o"),devices=result,message=message.Text??""};
 }
}
