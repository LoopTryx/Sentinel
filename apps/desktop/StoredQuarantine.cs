using System;using System.Linq;using System.Collections.Generic;using System.Diagnostics;using System.IO;using System.Text;using System.Threading.Tasks;using System.Web.Script.Serialization;using System.Windows;
// Fixed native store/worker only. Renderer refs are not paths or approval.
internal static class StoredQuarantine {
 static readonly string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel-School-Demo","inspection-vault");
 static readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=65536};
 static string Quote(string value){return "\""+value.Replace("\"","\\\"")+"\"";}
 static Process Start(string mode,string reference){
  string exe=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"sentinel-inspect.exe");
  var info=new ProcessStartInfo(exe,mode+" "+Quote(root)+(reference==null?"":" "+reference)){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=new UTF8Encoding(false,true),WorkingDirectory=AppDomain.CurrentDomain.BaseDirectory};
  var process=Process.Start(info);if(process==null)throw new InvalidOperationException("vault_unavailable");return process;
 }
 static async Task<string> ReadLine(Process process){var text=new StringBuilder();var one=new char[1];for(int i=0;i<65536;i++){int count=await process.StandardOutput.ReadAsync(one,0,1);if(count==0)throw new InvalidOperationException("vault_unavailable");if(one[0]=='\n')return text.ToString();text.Append(one[0]);}throw new InvalidOperationException("vault_unavailable");}
 static async Task<Dictionary<string,object>> Read(Process process){
  var line=ReadLine(process);if(await Task.WhenAny(line,Task.Delay(10000))!=line)throw new InvalidOperationException("vault_unavailable");
  string text=await line;if(text==null||text.Length>65536)throw new InvalidOperationException("vault_unavailable");
  var value=json.Deserialize<Dictionary<string,object>>(text);if(value==null||value.ContainsKey("error"))throw new InvalidOperationException("vault_recovery_required");return value;
 }
 static void Stop(Process process){try{if(!process.HasExited)process.Kill();}catch{}process.Dispose();}
 static bool Reference(string value){return value!=null&&value.Length==36&&System.Text.RegularExpressions.Regex.IsMatch(value,"^[a-f0-9]{32}\\.qtn\\z");}
 static void ValidateItem(object raw){
  var item=raw as Dictionary<string,object>;string[] keys={"reference","fileName","bytes","sha256","addedAt","state","canRestore","canDestroy"};
  if(item==null||item.Count!=8||keys.Any(key=>!item.ContainsKey(key)))throw new InvalidOperationException("vault_unavailable");
  foreach(string key in keys.Take(6))if(!(item[key] is string))throw new InvalidOperationException("vault_unavailable");
  string name=(string)item["fileName"],bytes=(string)item["bytes"],digest=(string)item["sha256"],added=(string)item["addedAt"],state=(string)item["state"];
  if(!Reference((string)item["reference"])||name.Length<1||name.Length>320||name.Any(c=>char.IsControl(c)||c=='\\'||c=='/')||bytes.Length>8||!System.Text.RegularExpressions.Regex.IsMatch(bytes,"^[0-9]{1,8}\\z")||long.Parse(bytes)>67108864||digest.Length!=64||!System.Text.RegularExpressions.Regex.IsMatch(digest,"^[a-f0-9]{64}\\z")||added.Length>12||!System.Text.RegularExpressions.Regex.IsMatch(added,"^[0-9]*\\z")||!(new[]{"quarantined","original_retained","recovery_required"}).Contains(state)||!(item["canRestore"] is bool)||!(item["canDestroy"] is bool)||(state!="quarantined"&&(bool)item["canDestroy"]))throw new InvalidOperationException("vault_unavailable");
 }
 internal static async Task<object> List(){var process=Start("--vault-list",null);try{process.StandardInput.Close();var value=await Read(process);if(value.Count!=1||!value.ContainsKey("items")||!(value["items"] is System.Collections.ICollection)||((System.Collections.ICollection)value["items"]).Count>64)throw new InvalidOperationException("vault_unavailable");var seen=new HashSet<string>();foreach(object item in (System.Collections.ICollection)value["items"]){ValidateItem(item);if(!seen.Add((string)((Dictionary<string,object>)item)["reference"]))throw new InvalidOperationException("vault_unavailable");}return value;}finally{Stop(process);}}

 internal static async Task<object> Action(Window owner,string reference,bool destroy){
  if(!Reference(reference))throw new InvalidOperationException("invalid_request");
  var process=Start(destroy?"--vault-destroy":"--vault-restore",reference);
  try{
   var preview=await Read(process);
   if(preview.Count!=6||(preview["type"] as string)!="stored_preview"||(preview["reference"] as string)!=reference||(preview["action"] as string)!=(destroy?"destroy":"restore"))throw new InvalidOperationException("vault_unavailable");
   string source=preview["source"] as string,digest=preview["sha256"] as string;
   if(string.IsNullOrEmpty(source)||source.Length>1024||digest==null||digest.Length!=64||!System.Text.RegularExpressions.Regex.IsMatch(digest,"^[a-f0-9]{64}$"))throw new InvalidOperationException("vault_unavailable");
   bool approved=owner.IsActive&&owner.IsVisible&&MessageBox.Show(owner,(destroy?"Delete this encrypted quarantined copy? Sentinel cannot undo this action.":"Restore the saved bytes to the recorded location? Existing files will not be overwritten. Do not run an untrusted restored file.")+"\n\nRecorded location: "+source+"\nSHA-256: "+digest+"\nApproval expires after 30 seconds.","Sentinel native "+(destroy?"destroy":"restore")+" confirmation",MessageBoxButton.YesNo,MessageBoxImage.Warning,MessageBoxResult.No)==MessageBoxResult.Yes;
   if(process.HasExited)throw new InvalidOperationException("action_expired");
   await process.StandardInput.WriteAsync(approved?"confirm\n":"decline\n");process.StandardInput.Close();
   var result=await Read(process);if(result.Count!=2||(result["reference"] as string)!=reference||!(new[]{"declined",destroy?"destroyed":"restored"}).Contains(result["state"] as string))throw new InvalidOperationException("vault_unavailable");
   return result;
  }finally{Stop(process);}
 }
}
