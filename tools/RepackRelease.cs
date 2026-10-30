// Historical embedded-ZIP repacker. Do not use with current appended-payload installers.
using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
// Reuse verified immutable engines/models without expanding a second large staging tree.
public static class RepackRelease {
 public static void Build(string prior,string output,string mapping) {
  var json=new JavaScriptSerializer{MaxJsonLength=4194304};
  var changes=json.Deserialize<Dictionary<string,string>>(File.ReadAllText(mapping));
  var rows=new List<Dictionary<string,string>>();var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  using(var source=Assembly.LoadFile(Path.GetFullPath(prior)).GetManifestResourceStream("Sentinel.Payload.zip"))
  using(var old=new ZipArchive(source,ZipArchiveMode.Read))
  using(var file=new FileStream(output,FileMode.CreateNew))
  using(var zip=new ZipArchive(file,ZipArchiveMode.Create)) {
   foreach(var entry in old.Entries){string name=entry.FullName.Replace('\\','/');
    if(name.EndsWith("/")||name=="manifest-sha256.json"||changes.ContainsKey(name)||name.StartsWith("apps/ui/dist/")||name.StartsWith("apps/extension/dist/")||name.StartsWith("apps/extension/src/")||name.StartsWith("apps/extension/data/")||name.StartsWith("apps/demo-runtime/"))continue;
    bool immutable=name.StartsWith("artifacts/local-ai/")||name.StartsWith("apps/desktop/console-build/scan-engine/")||System.Text.RegularExpressions.Regex.IsMatch(name,@"^apps/desktop/console-build/(sentinel-(inspect|sweep)\.exe|inspection-engine\.json|signature-runtime\.manifest|Microsoft\.Web\.WebView2\.(Core|Wpf)\.dll|WebView2Loader\.dll|Sentinel\.(exe|PasswordApproval\.exe|UsbBootstrap\.exe|UsbBroker\.exe|UsbRecovery\.dll|DuckyPolicy\.exe))$")||name=="tools/runtime/node.exe"||name=="tools/runtime/NODE-LICENSE.txt"||name=="tools/runtime/MicrosoftEdgeWebview2Setup.exe";
    if(!immutable)continue;
    using(var input=entry.Open())Add(zip,name,input,rows,seen);
   }
   foreach(var change in changes){using(var input=File.OpenRead(change.Value))Add(zip,change.Key,input,rows,seen);}
   using(var writer=new StreamWriter(zip.CreateEntry("manifest-sha256.json").Open()))writer.Write(json.Serialize(rows));
  }
  File.WriteAllText(output+".manifest.json",json.Serialize(rows));
 }
 static void Add(ZipArchive zip,string name,Stream input,List<Dictionary<string,string>> rows,HashSet<string> seen){
  if(System.Text.RegularExpressions.Regex.IsMatch(name,@"(?i)(^|/)(demo-runtime\.json|native-host\.json|chats\.dat|vault\.json|windows-key[^/]*|.*\.env|.*\.log|.*\.pdb)$")||name.IndexOf("PrivateHistory",StringComparison.OrdinalIgnoreCase)>=0||name.IndexOf("RecoveryBackups",StringComparison.OrdinalIgnoreCase)>=0)throw new IOException("Private state forbidden in package.");
  if(name.StartsWith("/")||name.Contains("..")||name.Contains(":")||!seen.Add(name))throw new IOException("Invalid or duplicate package path.");
  using(var sha=SHA256.Create())using(var output=zip.CreateEntry(name,CompressionLevel.Optimal).Open()){
   byte[] bytes=new byte[1048576];int count;while((count=input.Read(bytes,0,bytes.Length))>0){sha.TransformBlock(bytes,0,count,null,0);output.Write(bytes,0,count);}sha.TransformFinalBlock(bytes,0,0);
   rows.Add(new Dictionary<string,string>{{"path",name},{"sha256",BitConverter.ToString(sha.Hash).Replace("-","").ToLowerInvariant()}});
  }
 }
}
