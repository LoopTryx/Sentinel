using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

// Read-only evidence, not enrollment or an authorization decision.
public static class UsbAdmissionPreflight {
 public sealed class Input {
  public string Instance,DeviceClass,TransportService,ConnectorState;
  public string[] ParentChain,LocationPaths,CompatibleIds;
  public bool Complete,TouchpadUsage,ConnectorPartial;
  public int ConnectorMatches;
 }
 public sealed class Candidate {
  public string Instance,Category;
  public bool UserApprovalRequired=true,ExemptionVerified=false;
 }
 public sealed class Result {
  public string State,TopologyToken;
  public Candidate[] Candidates;
  public bool CanActivate=false,UserApprovalRequired=true;
  public int SafetyCandidates,ExternalCandidates,Unresolved;
 }
 static bool Valid(string value) {return !string.IsNullOrEmpty(value)&&value.Length<=512&&value.IndexOf('\0')<0;}
  public static Result Evaluate(Input[] inputs,bool enumerationComplete,string expectedTopologyToken) {
  return EvaluateCore(inputs,enumerationComplete,expectedTopologyToken,false);
 }
 public static Result EvaluateUsbHid(Input[] inputs,bool enumerationComplete,string expectedTopologyToken) {
  if(!enumerationComplete||inputs==null||inputs.Length>256)return EvaluateCore(null,false,expectedTopologyToken,true);
  var selected=new List<Input>();
  foreach(var input in inputs){
   if(input==null)return EvaluateCore(null,false,expectedTopologyToken,true);
   bool matches=false;
   if(input.CompatibleIds!=null){if(input.CompatibleIds.Length>64)return EvaluateCore(null,false,expectedTopologyToken,true);foreach(string id in input.CompatibleIds){if(!Valid(id))return EvaluateCore(null,false,expectedTopologyToken,true);if(id.Equals(@"USB\Class_03",StringComparison.OrdinalIgnoreCase))matches=true;}}
   if(!matches)continue;
   // The matching USB devnode itself is the policy subject, never its HID child.
   if(!Valid(input.Instance)||!input.Instance.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase))return EvaluateCore(null,false,expectedTopologyToken,true);
   selected.Add(input);
  }
  if(selected.Count==0)return new Result{State="refused_no_usb_hid",Candidates=new Candidate[0]};
  return EvaluateCore(selected.ToArray(),enumerationComplete,expectedTopologyToken,true);
 }
 static Result EvaluateCore(Input[] inputs,bool enumerationComplete,string expectedTopologyToken,bool usbHidScope) {
  var result=new Result{State="refused_incomplete",Candidates=new Candidate[0]};
  if(!enumerationComplete||inputs==null||inputs.Length==0||inputs.Length>256)return result;
  var candidates=new List<Candidate>();var ids=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var topology=new List<string>();
  foreach(var input in inputs) {
   if(input==null||!Valid(input.Instance)||!ids.Add(input.Instance)||input.ParentChain==null||input.ParentChain.Length<2||input.ParentChain.Length>12||!input.Complete)return result;
   if(!usbHidScope&&input.DeviceClass!="Keyboard"&&input.DeviceClass!="Mouse"&&!(input.DeviceClass=="HIDClass"&&input.TouchpadUsage))return result;
   if(!string.Equals(input.ParentChain[0],input.Instance,StringComparison.OrdinalIgnoreCase))return result;
   var chainIds=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var enumerators=new List<string>();
   foreach(string id in input.ParentChain){if(!Valid(id)||!chainIds.Add(id))return result;int slash=id.IndexOf('\\');if(slash<1)return result;enumerators.Add(id.Substring(0,slash));}
   if(!enumerators[enumerators.Count-1].Equals("HTREE",StringComparison.OrdinalIgnoreCase))return result;
   var detected=UsbInternalDetection.Classify(enumerators.ToArray(),input.TransportService??"",input.DeviceClass,input.TouchpadUsage,true);
   string category="unresolved";
   if(detected.State=="internal_candidate")category="required_safety_candidate";
   else if(detected.State=="external_bluetooth")category="external_approval_required";
   else if(detected.State=="unresolved_usb"&&input.LocationPaths!=null&&input.LocationPaths.Length>0&&!input.ConnectorPartial&&input.ConnectorMatches==1){
    if(input.ConnectorState=="internal_port_candidate")category="required_safety_candidate";
    else if(input.ConnectorState=="user_connectable")category="external_approval_required";
   }
   if(category=="required_safety_candidate")result.SafetyCandidates++;else if(category=="external_approval_required")result.ExternalCandidates++;else result.Unresolved++;
   if(input.LocationPaths!=null){if(input.LocationPaths.Length>32)return result;foreach(string location in input.LocationPaths)if(!Valid(location))return result;}
   candidates.Add(new Candidate{Instance=input.Instance,Category=category});
   topology.Add(string.Join("\n",input.ParentChain).ToUpperInvariant()+"\n"+input.DeviceClass+"\n"+input.TransportService+"\n"+input.ConnectorState+"\n"+input.ConnectorPartial+"\n"+input.ConnectorMatches+"\n"+input.TouchpadUsage+"\n"+string.Join("\n",input.CompatibleIds??new string[0])+"\n"+string.Join("\n",input.LocationPaths??new string[0]));
  }
  topology.Sort(StringComparer.Ordinal);using(var hash=SHA256.Create())result.TopologyToken=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(string.Join("\n--\n",topology.ToArray())))).Replace("-","").ToLowerInvariant();
  result.Candidates=candidates.ToArray();
  result.State=!string.IsNullOrEmpty(expectedTopologyToken)&&!string.Equals(expectedTopologyToken,result.TopologyToken,StringComparison.Ordinal)?"refused_topology_changed":result.Unresolved>0?"refused_ambiguous":"review_required";
  return result;
 }
}
