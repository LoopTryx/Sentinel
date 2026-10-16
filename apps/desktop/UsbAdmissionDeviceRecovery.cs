using System;using System.IO;using System.Linq;using System.Diagnostics;using System.Threading;using System.Threading.Tasks;
// Operator-only, explicit owner-bound release recovery. Never a block provider.
internal static class UsbAdmissionDeviceRecovery {
 internal sealed class Plan {
  readonly string topology;readonly string[] instances,safety;
  internal string Topology{get{return topology;}}internal string[] Instances{get{return (string[])instances.Clone();}}
  internal string[] Safety{get{return (string[])safety.Clone();}}
  internal Plan(string token,string[] ids,string[] exclusions){topology=token;instances=(string[])ids.Clone();safety=(string[])exclusions.Clone();}
 }
 internal sealed class Result {internal string State;internal string[] Outcomes;internal bool InputVerified{get{return false;}}}
 static UsbAdmissionPreflight.Input[] Inputs(UsbAdmissionInventory.Result inventory){if(inventory==null||!inventory.Complete||inventory.Subjects==null)return null;return inventory.Subjects.Select(s=>s==null?null:s.Input).ToArray();}
 internal static Plan Prepare(UsbAdmissionInventory.Result freshInventory,string[] protectedSafety,string[] requestedIDs){
  if(freshInventory==null||freshInventory.Preflight==null||requestedIDs==null||requestedIDs.Length<1||requestedIDs.Length>8)throw new InvalidOperationException("Input recovery selection refused");
  var selected=UsbAdmissionRestartSelection.Select(Inputs(freshInventory),freshInventory.Complete,freshInventory.Preflight.TopologyToken,requestedIDs,protectedSafety);
  if(selected.State!="restart_selection_ready")throw new InvalidOperationException("Input recovery selection refused");return new Plan(freshInventory.Preflight.TopologyToken,selected.Instances,protectedSafety);
 }
 internal static string ClassifyExit(int exitCode){return exitCode==0?"restart_completed_input_unverified":exitCode==3010?"restart_requires_windows_restart":"restart_declined";}
 internal static string Arguments(string id){if(string.IsNullOrEmpty(id)||id.Length>200||!id.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)||id.IndexOf('"')>=0||id.IndexOf('\r')>=0||id.IndexOf('\n')>=0||id.IndexOf('\0')>=0||id.EndsWith("\\",StringComparison.Ordinal))throw new InvalidOperationException("Input recovery argument refused");return "/restart-device \""+id+"\"";}
 sealed class Drain {
  readonly Thread thread;internal bool Valid=true;
  internal Drain(Stream stream){thread=new Thread(()=>{try{int count,total=0;var buffer=new byte[512];while((count=stream.Read(buffer,0,buffer.Length))>0){total+=count;if(total>65536){Valid=false;stream.Close();return;}}}catch{Valid=false;}});thread.IsBackground=true;thread.Start();}
  internal bool Finished(int milliseconds){return thread.Join(milliseconds)&&Valid;}
 }
 static int Remaining(Stopwatch timer){return Math.Max(0,30000-(int)timer.ElapsedMilliseconds);}
 static string Restart(string id,Stopwatch timer,Func<bool> released){
  string arguments=Arguments(id);if(Remaining(timer)<1)return "recovery_budget_expired";if(!released())return "policy_release_not_verified";
  using(var process=new Process()){process.StartInfo=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"pnputil.exe"),arguments){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
   try{if(!process.Start())return "restart_start_failed";var output=new Drain(process.StandardOutput.BaseStream);var error=new Drain(process.StandardError.BaseStream);if(!process.WaitForExit(Remaining(timer))){try{process.Kill();}catch{}return "restart_timeout_outcome_unknown";}int code=process.ExitCode;if(!output.Finished(Math.Min(100,Remaining(timer)))||!error.Finished(Math.Min(100,Remaining(timer))))return "restart_output_unavailable";return ClassifyExit(code);}catch{return "restart_failed_outcome_unknown";}finally{try{if(!process.HasExited)process.Kill();}catch{}}
  }
 }
 // Recovery is opt-in for an exact target set. Missing selection never means all inputs.
 internal static string[] SelectRequested(UsbAdmissionPreflight.Result preflight,string[] requested){
  if(preflight==null||preflight.State!="review_required"||preflight.Candidates==null||requested==null||requested.Length<1||requested.Length>8)return new string[0];
  var allowed=new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var candidate in preflight.Candidates)if(candidate.Category=="external_approval_required")allowed.Add(candidate.Instance);
  var seen=new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(string id in requested)if(string.IsNullOrEmpty(id)||!allowed.Contains(id)||!seen.Add(id))return new string[0];
  return (string[])requested.Clone();
 }
 internal static Result Execute(Plan plan,Func<bool> isPolicyReleased){
  if(plan==null||isPolicyReleased==null)throw new ArgumentException("Input recovery plan required");var ids=plan.Instances;if(ids.Length<1||ids.Length>8)throw new InvalidOperationException("Input recovery plan refused");
  var outcomes=new string[ids.Length];var timer=Stopwatch.StartNew();bool stopped=false;for(int i=0;i<ids.Length;i++){
   if(stopped){outcomes[i]="not_attempted";continue;}if(Remaining(timer)<1){outcomes[i]="recovery_budget_expired";stopped=true;continue;}
   try{if(!isPolicyReleased()){outcomes[i]="policy_release_not_verified";stopped=true;continue;}
    var inventoryTask=Task.Factory.StartNew(()=>UsbAdmissionInventory.Collect(plan.Topology),CancellationToken.None,TaskCreationOptions.DenyChildAttach,TaskScheduler.Default);if(!inventoryTask.Wait(Remaining(timer))){outcomes[i]="inventory_timeout_no_restart";stopped=true;continue;}
    var fresh=inventoryTask.Result;var selection=UsbAdmissionRestartSelection.Select(Inputs(fresh),fresh.Complete,plan.Topology,new[]{ids[i]},plan.Safety);
    if(selection.State!="restart_selection_ready"){outcomes[i]="topology_changed_no_restart";stopped=true;continue;}outcomes[i]=Restart(selection.Instances[0],timer,isPolicyReleased);
    if(outcomes[i]!="restart_completed_input_unverified"&&outcomes[i]!="restart_requires_windows_restart")stopped=true;
   }catch{outcomes[i]="recovery_refused";stopped=true;}
  }
  return new Result{State=stopped?"recovery_partial":"recovery_attempted_input_unverified",Outcomes=outcomes};
 }
}
