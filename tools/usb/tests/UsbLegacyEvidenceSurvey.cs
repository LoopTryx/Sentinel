using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Microsoft.Win32;

// Read-only legacy ownership survey. Never starts, disables or deletes a task,
// never executes/compiles decoded PowerShell, and never changes device policy.
internal static class UsbLegacyEvidenceSurvey {
 const string ReceiptPath=@"SOFTWARE\Sentinel\UsbLegacyEvidenceSurvey";
 const string Policy=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 static readonly Dictionary<string,object> result=new Dictionary<string,object>();
 static string target,nonce;static int stage;
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544"||sid=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";}
 static void Require(bool value){if(!value)throw new InvalidOperationException("Legacy evidence unavailable.");}
 static void DirectoryAcl(string path,bool final){
  var acl=Directory.GetAccessControl(path,AccessControlSections.Owner|AccessControlSections.Access);Require(Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value));if(final)Require(acl.AreAccessRulesProtected);
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow||Trusted(rule.IdentityReference.Value)||(rule.PropagationFlags&PropagationFlags.InheritOnly)!=0)continue;
   Require(!final&&(rule.FileSystemRights&(FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership|FileSystemRights.Delete))==0);
  }
 }
 static void FileAcl(FileStream stream){var acl=stream.GetAccessControl();Require(Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value));foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!Trusted(rule.IdentityReference.Value))Require((rule.FileSystemRights&(FileSystemRights.Write|FileSystemRights.Delete|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership))==0);}
 static Dictionary<string,object> ReadReceipt(string path,List<IDisposable> held){
  if(!File.Exists(path))return null;Require((File.GetAttributes(path)&FileAttributes.ReparsePoint)==0);
  var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);held.Add(file);FileAcl(file);Require(file.Length>0&&file.Length<=8192);
  var bytes=new byte[(int)file.Length];int offset=0;while(offset<bytes.Length){int count=file.Read(bytes,offset,bytes.Length-offset);Require(count>0);offset+=count;}
  string json=new UTF8Encoding(false,true).GetString(bytes);return new JavaScriptSerializer{MaxJsonLength=8192,RecursionLimit=8}.Deserialize<Dictionary<string,object>>(json);
 }
 static bool Fields(Dictionary<string,object> receipt,string[] fields){if(receipt==null||receipt.Count!=fields.Length)return false;foreach(string field in fields)if(!receipt.ContainsKey(field))return false;return true;}
 static bool MatchesProfile(Dictionary<string,object> receipt){return receipt!=null&&receipt["target"] as string==target&&receipt["nonce"] as string==nonce;}
 static bool Deadline(Dictionary<string,object> receipt){DateTime parsed;return DateTime.TryParse(receipt["deadline"] as string,System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.RoundtripKind,out parsed)&&parsed.Kind==DateTimeKind.Utc&&parsed<DateTime.UtcNow;}
 static string Hash(string value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
 static List<string> Sources(){
  var sources=new List<string>();foreach(string name in Assembly.GetExecutingAssembly().GetManifestResourceNames())if(name.StartsWith("Sentinel.LegacySource.",StringComparison.Ordinal))using(var reader=new StreamReader(Assembly.GetExecutingAssembly().GetManifestResourceStream(name),Encoding.UTF8,true)){
   string body=reader.ReadToEnd();string lf=body.Replace("\r\n","\n");foreach(string variant in new[]{body,lf,lf.Replace("\n","\r\n")}){string source="#define SENTINEL_DUCKY_POLICY_LAB\n"+variant;if(!sources.Contains(source))sources.Add(source);}
  }return sources;
 }
 static string B64(string text){return Convert.ToBase64String(Encoding.UTF8.GetBytes(text));}
 static string DesktopArguments(string source){
  string data=new JavaScriptSerializer().Serialize(new{path=Policy,target=target,nonce=nonce});
  string script="try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+B64(source)+"')));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+B64(data)+"'))|ConvertFrom-Json;[SentinelDuckyEntry]::Restore($p.path,$p.target,$p.nonce,$true); & (Join-Path ([Environment]::GetFolderPath('System')) 'gpupdate.exe') /target:computer /force /wait:30 *> $null;if($LASTEXITCODE -ne 0){exit 19};exit 0}catch{exit 18}";
  string compressed;using(var memory=new MemoryStream()){using(var gzip=new GZipStream(memory,CompressionMode.Compress,true)){byte[] bytes=Encoding.UTF8.GetBytes(script);gzip.Write(bytes,0,bytes.Length);}compressed=Convert.ToBase64String(memory.ToArray());}
  string loader="$ErrorActionPreference='Stop';$m=New-Object IO.MemoryStream(,[Convert]::FromBase64String('"+compressed+"'));$z=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($z,[Text.Encoding]::UTF8);try{& ([scriptblock]::Create($r.ReadToEnd()))}finally{$r.Dispose();$z.Dispose();$m.Dispose()}";
  return "-NoProfile -NonInteractive -WindowStyle Hidden -Command \""+loader+"\"";
 }
 // Safely decode ONLY a fixed historical template. This is data inspection;
 // neither ScriptBlock/Create nor Add-Type is invoked by this executable.
 static bool InitialActionMatches(string arguments,string sourceHash){
  const string prefix="-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ";if(arguments==null||!arguments.StartsWith(prefix,StringComparison.Ordinal)||arguments.Length>32000)return false;
  byte[] bytes;try{bytes=Convert.FromBase64String(arguments.Substring(prefix.Length));}catch{return false;}if(bytes.Length>64000||bytes.Length%2!=0)return false;
  string script=new UnicodeEncoding(false,false,true).GetString(bytes);
  string pattern="\\Atry\\{Add-Type -TypeDefinition \\(\\[Text.Encoding\\]::UTF8.GetString\\(\\[Convert\\]::FromBase64String\\(\"(?<source>[A-Za-z0-9+/=]+)\"\\)\\)\\);\\$p=\\[Text.Encoding\\]::UTF8.GetString\\(\\[Convert\\]::FromBase64String\\(\"(?<data>[A-Za-z0-9+/=]+)\"\\)\\)\\|ConvertFrom-Json;\\[SentinelDuckyEntry\\]::Restore\\(\\$p.path,\\$p.target,\\$p.nonce,\\$true\\);exit 0\\}catch\\{exit 18\\}\\z";
  var match=Regex.Match(script,pattern,RegexOptions.CultureInvariant,TimeSpan.FromSeconds(1));if(!match.Success)return false;
  byte[] rawSource=Convert.FromBase64String(match.Groups["source"].Value),rawData=Convert.FromBase64String(match.Groups["data"].Value);if(rawSource.Length>65536||rawData.Length>2048)return false;
  string source=new UTF8Encoding(false,true).GetString(rawSource);if(Hash(source)!=sourceHash)return false;
  var data=new JavaScriptSerializer{MaxJsonLength=2048,RecursionLimit=4}.Deserialize<Dictionary<string,object>>(new UTF8Encoding(false,true).GetString(rawData));
  return Fields(data,new[]{"path","target","nonce"})&&data["path"] as string==Policy&&data["target"] as string==target&&data["nonce"] as string==nonce;
 }
 internal static void TestActionParser(){
  target=@"USB\VID_0001&PID_0001\SYNTHETIC";nonce=new string('a',32);string source="private harmless source data";
  string data=new JavaScriptSerializer().Serialize(new{target=target,nonce=nonce,path=Policy});
  string script="try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(\""+B64(source)+"\")));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(\""+B64(data)+"\"))|ConvertFrom-Json;[SentinelDuckyEntry]::Restore($p.path,$p.target,$p.nonce,$true);exit 0}catch{exit 18}";
  string prefix="-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ";
  string arguments=prefix+Convert.ToBase64String(Encoding.Unicode.GetBytes(script));Require(InitialActionMatches(arguments,Hash(source)));
  Require(!InitialActionMatches(arguments,Hash(source+"changed")));
  Require(!InitialActionMatches(prefix+Convert.ToBase64String(Encoding.Unicode.GetBytes(script+";exit 0")),Hash(source)));
  Require(!InitialActionMatches(prefix+"not base64",Hash(source)));
  nonce=new string('b',32);Require(!InitialActionMatches(arguments,Hash(source)));
  Require(!InitialActionMatches(new string('x',32001),Hash(source)));
 }
 static void TaskMetadata(dynamic folder,string name,string sourceHash,List<string> trustedSources,bool desktop){
  result["ReceiptBoundTaskCount"]=(int)result["ReceiptBoundTaskCount"]+1;
  try{
   dynamic task=folder.GetTask(name),definition=task.Definition;
   bool principal=(definition.Principal.UserId as string=="SYSTEM"||definition.Principal.UserId as string=="S-1-5-18")&&(int)definition.Principal.LogonType==5&&(int)definition.Principal.RunLevel==1;
   bool metadata=principal&&(int)definition.Actions.Count==1;
   bool full=false;if(metadata){dynamic action=definition.Actions[1];metadata=(int)action.Type==0&&string.Equals(action.Path as string,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),StringComparison.OrdinalIgnoreCase)&&string.IsNullOrEmpty(action.WorkingDirectory as string);
    if(metadata){string arguments=action.Arguments as string;if(arguments!=null&&arguments.Length<=32000){if(desktop){foreach(string source in trustedSources)if(Hash(source)==sourceHash&&arguments==DesktopArguments(source)){full=true;break;}}else full=InitialActionMatches(arguments,sourceHash);}}
   }
   if(metadata)result["TaskMetadataMatches"]=(int)result["TaskMetadataMatches"]+1;
   if(full)result["CompleteActionMatches"]=(int)result["CompleteActionMatches"]+1;else result["UnknownTaskOwnership"]=(int)result["UnknownTaskOwnership"]+1;
   if((int)task.State==4)result["RunningReceiptTasks"]=(int)result["RunningReceiptTasks"]+1;
   if((bool)task.Enabled)result["EnabledReceiptTasks"]=(int)result["EnabledReceiptTasks"]+1;
  }catch(System.Runtime.InteropServices.COMException e){if(e.ErrorCode==unchecked((int)0x80070002))result["AbsentReceiptTasks"]=(int)result["AbsentReceiptTasks"]+1;else result["UnknownTaskOwnership"]=(int)result["UnknownTaskOwnership"]+1;}
  catch{result["UnknownTaskOwnership"]=(int)result["UnknownTaskOwnership"]+1;}
 }
 static void Publish(string state){using(var receipt=Registry.LocalMachine.CreateSubKey(ReceiptPath)){receipt.SetValue("State",state);receipt.SetValue("Stage",stage,RegistryValueKind.DWord);foreach(var pair in result)receipt.SetValue(pair.Key,pair.Value,pair.Value is int?RegistryValueKind.DWord:RegistryValueKind.String);}}
 [STAThread]static int Main(string[] args){
  if(args.Length!=0)return 2;using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  var held=new List<IDisposable>();
  foreach(string key in new[]{"ProfileVerified","LegacyLockHeld","TrialPresent","TrialAuthenticated","DesktopPresent","DesktopAuthenticated","ProtectedSourceMatchesEmbedded","ReceiptBoundTaskCount","TaskMetadataMatches","CompleteActionMatches","UnknownTaskOwnership","RunningReceiptTasks","EnabledReceiptTasks","AbsentReceiptTasks","FullOwnershipProven"})result[key]=0;
  // A quiet scheduler snapshot cannot prove absence of previously spawned
  // descendants or that an enabled task will not run later. Never imply cleanup permission.
  result["ProducerQuiescence"]="unverified";
  try{
   stage=1;Publish("running");Require(DuckyPolicyEnrollment.Read(out target,out nonce));result["ProfileVerified"]=1;
   string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy");var ancestry=new List<string>();for(var cursor=new DirectoryInfo(directory);cursor!=null;cursor=cursor.Parent)ancestry.Insert(0,cursor.FullName);
   stage=2;foreach(string path in ancestry){held.Add(new SentinelPolicyDirectory(path));DirectoryAcl(path,path==directory);}
   stage=3;string lockPath=Path.Combine(directory,".lock");Require(File.Exists(lockPath)&&(File.GetAttributes(lockPath)&FileAttributes.ReparsePoint)==0);var operationLock=new FileStream(lockPath,FileMode.Open,FileAccess.ReadWrite,FileShare.None);held.Add(operationLock);FileAcl(operationLock);result["LegacyLockHeld"]=1;
   stage=4;var trial=ReadReceipt(Path.Combine(directory,"trial.json"),held);var desktop=ReadReceipt(Path.Combine(directory,"desktop-trial.json"),held);result["TrialPresent"]=trial==null?0:1;result["DesktopPresent"]=desktop==null?0:1;
   bool trialValid=Fields(trial,new[]{"target","nonce","deadline","task","priorState","sourceHash"})&&MatchesProfile(trial)&&Deadline(trial)&&trial["priorState"] as string=="namespace_absent"&&Regex.IsMatch(trial["sourceHash"] as string??"",@"\A[0-9a-f]{64}\z")&&trial["task"] as string=="Sentinel-Ducky-Policy-Recovery-"+nonce;
   result["TrialAuthenticated"]=trialValid?1:0;
   bool desktopValid=Fields(desktop,new[]{"target","nonce","task","retiringTask","deadline","engine"})&&MatchesProfile(desktop)&&Deadline(desktop)&&desktop["engine"] as string=="profiled-ducky-v1"&&Regex.IsMatch(desktop["task"] as string??"",@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z")&&(desktop["retiringTask"]==null||Regex.IsMatch(desktop["retiringTask"] as string??"",@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z"));
   result["DesktopAuthenticated"]=desktopValid?1:0;
   stage=5;var sources=Sources();string sourceHash=trialValid?trial["sourceHash"] as string:null;foreach(string source in sources)if(Hash(source)==sourceHash)result["ProtectedSourceMatchesEmbedded"]=1;
   stage=6;dynamic scheduler=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service",true));scheduler.Connect();dynamic folder=scheduler.GetFolder("\\");
   var visited=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   if(trialValid){string task=trial["task"] as string;visited.Add(task);TaskMetadata(folder,task,sourceHash,sources,false);}
   if(desktopValid)foreach(string key in new[]{"task","retiringTask"}){string task=desktop[key] as string;if(task!=null&&visited.Add(task))TaskMetadata(folder,task,sourceHash,sources,true);}
   stage=0;Publish("complete");return 0;
  }catch{try{Publish("unavailable");}catch{}return 1;}
  finally{for(int i=held.Count-1;i>=0;i--)held[i].Dispose();}
 }
}
internal static class UsbLegacyEvidenceSurveyPureTest {
 static int Main(){try{UsbLegacyEvidenceSurvey.TestActionParser();Console.WriteLine("Legacy action data parser PASS: exact template/hash/target binding, trailing code and malformed refusal; no execution");return 0;}catch{return 1;}}
}
