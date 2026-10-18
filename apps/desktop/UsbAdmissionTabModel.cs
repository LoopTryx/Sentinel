using System;using System.Collections.Generic;using System.Security.Cryptography;using System.Text;
// Redacted presentation only. These rows are never authorization or policy proof.
internal static class UsbAdmissionTabModel {
 internal static Dictionary<string,List<string>> Groups(UsbAdmissionInventory.Result inventory){
  var groups=new Dictionary<string,List<string>>(StringComparer.OrdinalIgnoreCase);if(inventory==null||inventory.Preflight==null||inventory.Preflight.Candidates==null||inventory.Subjects==null)return groups;
  foreach(var candidate in inventory.Preflight.Candidates){if(candidate==null||candidate.Category!="external_approval_required"||string.IsNullOrEmpty(candidate.Instance))continue;string key=candidate.Instance;
   foreach(var subject in inventory.Subjects){if(subject==null||subject.Input==null||!string.Equals(subject.Input.Instance,candidate.Instance,StringComparison.OrdinalIgnoreCase))continue;
    if(subject.Input.ParentChain!=null)foreach(string parent in subject.Input.ParentChain)if(parent!=null&&parent.StartsWith(@"USB\VID_",StringComparison.OrdinalIgnoreCase)&&parent.IndexOf("&MI_",StringComparison.OrdinalIgnoreCase)<0){key=parent;break;}break;
   }
   List<string> members;if(!groups.TryGetValue(key,out members)){members=new List<string>();groups.Add(key,members);}if(!members.Exists(id=>string.Equals(id,candidate.Instance,StringComparison.OrdinalIgnoreCase)))members.Add(candidate.Instance);
  }return groups;
 }
 internal static string Reference(string sessionSalt,string nativeGroupKey){if(string.IsNullOrEmpty(sessionSalt)||sessionSalt.Length>128||string.IsNullOrEmpty(nativeGroupKey)||nativeGroupKey.Length>512||sessionSalt.IndexOf('\0')>=0||nativeGroupKey.IndexOf('\0')>=0)throw new ArgumentException("USB tab reference refused");using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(sessionSalt+"\n"+nativeGroupKey))).Replace("-","").ToLowerInvariant();}
 internal static object Snapshot(UsbAdmissionInventory.Result inventory,string sessionSalt,bool exactAvailable=false){
  bool complete=inventory!=null&&inventory.Complete&&inventory.Preflight!=null&&inventory.Preflight.State=="review_required";var rows=new List<object>();
  foreach(var group in Groups(inventory)){string name="USB input device";foreach(var subject in inventory.Subjects){if(subject!=null&&subject.Input!=null&&group.Value.Exists(id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){name=subject.DisplayName;break;}}
   rows.Add(new Dictionary<string,object>{{"ref",Reference(sessionSalt,group.Key)},{"name",UsbAdmissionInventory.Display(name)},{"access","unverified"},{"canChange",complete},{"canBlock",exactAvailable&&complete},{"canScan",false}});
  }
  return new{schemaVersion=1,verified=false,canConnect=true,active=false,deadline=(string)null,topology=complete?inventory.Preflight.TopologyToken:null,devices=rows,message=""};
 }
}
