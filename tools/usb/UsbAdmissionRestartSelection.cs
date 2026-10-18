using System;using System.Collections.Generic;
// Pure scope selector, not authorization or evidence of restored input. Native
// caller must separately prove released policy, fresh topology and owner intent.
internal static class UsbAdmissionRestartSelection {
 internal sealed class Result {internal string State;internal string[] Instances;}
 static Result Refused(){return new Result{State="restart_selection_refused",Instances=new string[0]};}
 internal static Result Select(UsbAdmissionPreflight.Input[] inputs,bool complete,string expectedTopology,string[] requested,string[] protectedSafety){
  if(string.IsNullOrEmpty(expectedTopology)||requested==null||requested.Length<1||requested.Length>32||protectedSafety==null||protectedSafety.Length>32)return Refused();
  var current=UsbAdmissionPreflight.EvaluateUsbHid(inputs,complete,expectedTopology);if(current.State!="review_required"||current.TopologyToken!=expectedTopology||current.Unresolved!=0)return Refused();
  var safety=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(string id in protectedSafety)if(string.IsNullOrEmpty(id)||!safety.Add(id))return Refused();
  var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var selected=new List<string>();foreach(string id in requested){if(string.IsNullOrEmpty(id)||id.Length>200||!id.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)||id.IndexOf('"')>=0||id.IndexOf('\r')>=0||id.IndexOf('\n')>=0||id.IndexOf('\0')>=0||!seen.Add(id)||safety.Contains(id))return Refused();UsbAdmissionPreflight.Candidate match=null;foreach(var candidate in current.Candidates)if(string.Equals(candidate.Instance,id,StringComparison.OrdinalIgnoreCase)){if(match!=null)return Refused();match=candidate;}if(match==null||match.Category!="external_approval_required")return Refused();selected.Add(match.Instance);}
  return new Result{State="restart_selection_ready",Instances=selected.ToArray()};
 }
}
