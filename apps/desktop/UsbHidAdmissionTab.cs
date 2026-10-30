using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed partial class UsbAdmissionWindow {
#if SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED
 async Task<string> HidTabRequest(Dictionary<string,object> request,string action,JavaScriptSerializer json){
  if(action=="snapshot"){
   if(request.Count!=1)return "{\"error\":\"invalid_request\"}";
   var state=await UsbHidAdmissionOperations.ReadVerified();inventory=await Task.Run(()=>UsbAdmissionInventory.Collect(null));return json.Serialize(HidTabSnapshot(state));
  }
  bool activate=action=="activate",deactivate=action=="deactivate";
  if((!activate&&!deactivate&&action!="allow"&&action!="block")||request.Count!=(deactivate?1:activate?2:3))return "{\"error\":\"invalid_request\"}";
  object rawTopology=null,rawRef=null;if(!deactivate&&(!request.TryGetValue("topology",out rawTopology)||!HexTab(rawTopology as string)||!activate&&(!request.TryGetValue("ref",out rawRef)||!HexTab(rawRef as string))))return "{\"error\":\"invalid_request\"}";
  try{
   Opacity=1;ShowInTaskbar=false;Text="Sentinel · Confirm USB access";heading.Text=deactivate?"Restore mouse and keyboard":activate?"Enable USB Guard":action=="allow"?"Allow USB device":"Block USB device";
   cards.Visible=false;devices.Visible=false;arm.Visible=false;release.Visible=false;refresh.Visible=false;back.Visible=false;
   ClientSize=new Size(660,330);StartPosition=FormStartPosition.CenterScreen;Show();Activate();BringToFront();SetBusy(true);
   summary.Text=deactivate?"Restore access using your saved Windows policy.":activate?"New external USB input devices require your approval.":action=="allow"?"Allow and reconnect only this device. Keep it connected.":"Keep the selected device connected.";
   message.Text="Verify with Windows Hello to continue…";
   UsbAdmissionDeviceRecovery.Result reconnected=null;
   var state=await UsbHidAdmissionOperations.ChangeAndReconnect(Handle,action,rawRef as string,tabPipeName??tabSalt,(string)rawTopology,name=>summary.Text=(action=="allow"?"Allow and reconnect: ":"")+name,action=="allow"?(Action<UsbAdmissionDeviceRecovery.Result>)(value=>reconnected=value):null);
   message.Text=deactivate?"USB Guard is off. Reconnect external devices and check input.":"Windows policy verified. Physical input must be checked separately.";
   if(reconnected!=null){bool restart=false,completed=reconnected.Outcomes!=null&&reconnected.Outcomes.Length>0;foreach(string outcome in reconnected.Outcomes??new string[0]){restart|=outcome=="restart_requires_windows_restart";completed&=outcome=="restart_completed_input_unverified";}message.Text=restart?"Device allowed. Windows requires a restart to finish reconnecting it.":completed?"Device allowed. Windows restarted its input functions. Test input now.":"Device allowed. Unplug it, wait a few seconds, and reconnect it. Windows could not restart every input function.";}
   inventory=await Task.Run(()=>UsbAdmissionInventory.Collect(null));return json.Serialize(HidTabSnapshot(state));
  }catch(UsbHidAdmissionOperations.OperationFailure error){message.Text="USB action stopped at "+error.Stage+" ("+error.NativeHResult.ToString("X8")+"). No successful change is confirmed.";throw;}finally{SetBusy(false);Hide();Opacity=0;FinishClose();}
 }
 object HidTabSnapshot(UsbHidAdmissionPolicy.Snapshot state){
  bool complete=inventory!=null&&inventory.Complete&&inventory.Preflight!=null&&inventory.Preflight.State=="review_required";
  var approved=new HashSet<string>(state.ExternalApprovals,StringComparer.OrdinalIgnoreCase);var rows=new List<object>();
  if(complete)foreach(var group in ExternalGroups()){
   string name="USB input device";foreach(var subject in inventory.Subjects)if(group.Value.Contains(subject.Input.Instance)){name=subject.DisplayName;break;}
   bool all=group.Value.TrueForAll(id=>approved.Contains(id));bool none=group.Value.TrueForAll(id=>!approved.Contains(id));
   rows.Add(new{ @ref=TabReference(group.Key),name=UsbAdmissionInventory.Display(name),access=!state.Active?"off":all?"allowed":none?"policy_only":"unverified",canChange=state.Active,canBlock=state.Active&&!none,canScan=false});
  }
  return new{schemaVersion=1,verified=true,topology=complete?inventory.Preflight.TopologyToken:null,active=state.Active,persistent=true,deadline=(string)null,canActivate=complete&&!state.Active,canDeactivate=state.Active,devices=rows,message=message.Text??""};
 }
#endif
}
