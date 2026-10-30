using System;using System.Collections.Generic;using System.Diagnostics;using System.IO;using System.Linq;using System.Security.AccessControl;using System.Security.Principal;using System.Text;using System.Threading;using System.Threading.Tasks;using System.Web.Script.Serialization;
// Owns the persistent signature worker and its pinned native dependencies.
// Only fixed native configuration enters this class. Never a renderer path.
internal sealed class NativeProtectionRuntime:IDisposable {
 readonly object gate=new object();readonly List<NativeScanLease> leases=new List<NativeScanLease>();readonly Action<Dictionary<string,object>> receive;readonly Action<string> failed;readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=65536};
 readonly string downloads,vaultRoot;readonly string directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"scan-engine");string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".sentinel","SignatureData");
 Process process,updateProcess;volatile bool disposed;bool ready;Timer startupDeadline;internal string UpdateError="";
 internal NativeProtectionRuntime(string downloads,string vaultRoot,Action<Dictionary<string,object>> receive,Action<string> failed){this.downloads=downloads;this.vaultRoot=vaultRoot;this.receive=receive;this.failed=failed;}
 static string Quote(string value){return "\""+value.Replace("\"","\\\"")+"\"";}
 static void PrivateDirectory(string path){
  if(!Directory.Exists(path)){var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);foreach(var sid in new[]{WindowsIdentity.GetCurrent().User,new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null)})acl.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));Directory.CreateDirectory(path,acl);}
  if(!NativeScanPolicy.NoLinks(path))throw new IOException("Linked signature storage refused.");
  var allowed=new HashSet<string>(new[]{WindowsIdentity.GetCurrent().User.Value,"S-1-5-18","S-1-5-32-544"});
  foreach(FileSystemAccessRule rule in Directory.GetAccessControl(path).GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!allowed.Contains(rule.IdentityReference.Value))throw new IOException("Signature storage permissions are not private.");
 }
 static void Trace(string stage){
#if SENTINEL_PROTECTION_QUALIFICATION
 Console.Error.WriteLine("Scanner stage: "+stage);
#endif
 }
 void PinRuntime(){Trace("pinning");
  var assembly=System.Reflection.Assembly.GetExecutingAssembly();using(var resource=assembly.GetManifestResourceStream("Sentinel.Signatures.Manifest")){if(resource==null)throw new IOException("Signature runtime manifest missing.");using(var reader=new StreamReader(resource)){string line;int count=0;while((line=reader.ReadLine())!=null){if(++count>96)throw new IOException();var parts=line.Split('|');if(parts.Length!=2||parts[0].Contains("..")||Path.IsPathRooted(parts[0])||parts[0].IndexOfAny(new[]{'\r','\n',':'})>=0)throw new IOException();string path=Path.GetFullPath(Path.Combine(directory,parts[0]));if(!path.StartsWith(directory+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException();leases.Add(NativeScanLease.Open(path));using(var sha=System.Security.Cryptography.SHA256.Create())using(var stream=File.OpenRead(path)){string digest=BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","");if(!string.Equals(digest,parts[1],StringComparison.OrdinalIgnoreCase))throw new IOException("Signature runtime integrity check failed.");}}if(count<4)throw new IOException("Signature runtime incomplete.");}}
  var known=new HashSet<string>();using(var resource=assembly.GetManifestResourceStream("Sentinel.Signatures.Manifest"))using(var reader=new StreamReader(resource)){string line;while((line=reader.ReadLine())!=null)known.Add(Path.GetFullPath(Path.Combine(directory,line.Split('|')[0])));}
  foreach(string dll in Directory.GetFiles(directory,"*.dll"))if(!known.Contains(dll))throw new IOException("Unexpected signature dependency refused.");
 }
 void PrepareDefinitions(){Trace("definitions");
  Directory.CreateDirectory(Path.GetDirectoryName(data));PrivateDirectory(data);data=NativeScanLease.PhysicalDirectory(data);PrivateDirectory(data);
  string source=Path.Combine(directory,"definitions");
  foreach(string name in new[]{"main.cvd","daily.cvd"})if(!File.Exists(Path.Combine(data,name))){string original=Path.Combine(source,name);if(!File.Exists(original)||!NativeScanPolicy.NoLinks(original))throw new IOException("Bundled definitions missing.");File.Copy(original,Path.Combine(data,name),false);}
  foreach(string signature in Directory.GetFiles(source,"*.sign")){string target=Path.Combine(data,Path.GetFileName(signature));if(!File.Exists(target))File.Copy(signature,target,false);}
  string stamp=Path.Combine(data,"last-update-attempt.txt");bool due=!File.Exists(stamp)||(DateTime.UtcNow-File.GetLastWriteTimeUtc(stamp)).TotalHours>=12;
  if(due){Trace("updating definitions");
   // Written before launching to avoid CDN retry storms on an offline machine.
   File.WriteAllText(stamp,DateTime.UtcNow.ToString("o"));
   string config=Path.Combine(data,"freshclam.conf");File.WriteAllLines(config,new[]{"DatabaseMirror database.clamav.net","ScriptedUpdates no","Bytecode no","TestDatabases yes","ConnectTimeout 15","ReceiveTimeout 120","MaxAttempts 1","DatabaseDirectory "+Quote(data)});
   var start=new ProcessStartInfo(Path.Combine(directory,"freshclam.exe"),"--quiet --config-file="+Quote(config)){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=directory,RedirectStandardOutput=true,RedirectStandardError=true};
   start.EnvironmentVariables["PATH"]=directory+";"+Environment.GetFolderPath(Environment.SpecialFolder.System);
   try{using(var update=Process.Start(start)){lock(gate){if(disposed){if(update!=null)update.Kill();return;}updateProcess=update;}if(update==null)throw new IOException();var output=Drain(update.StandardOutput);var errors=Drain(update.StandardError);if(!update.WaitForExit(180000)){update.Kill();throw new IOException();}Task.WaitAll(new Task[]{output,errors},3000);if(update.ExitCode!=0)UpdateError="Definitions could not update. The last verified set is still checked before use.";}}
   catch{UpdateError="Definitions could not update. The last verified set is still checked before use.";}
  }
  lock(gate){if(disposed)return;foreach(string file in Directory.GetFiles(data).Where(p=>p.EndsWith(".cvd",StringComparison.OrdinalIgnoreCase)||p.EndsWith(".sign",StringComparison.OrdinalIgnoreCase)))leases.Add(NativeScanLease.Open(file));}
 }
 internal void Start(){startupDeadline=new Timer(_=>{lock(gate){if(disposed||ready)return;}failed("The scanner took too long to initialize. It will retry safely.");Dispose();},null,300000,Timeout.Infinite);Task.Run(()=>{try{
  lock(gate){if(disposed)return;PinRuntime();}PrepareDefinitions();
  Trace("starting worker");string scratch=Path.Combine(Path.GetDirectoryName(data),"ScanScratch");PrivateDirectory(scratch);
  Process child;lock(gate){if(disposed)return;var start=new ProcessStartInfo(Path.Combine(directory,"sentinel-protection.exe")){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=directory,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=new UTF8Encoding(false,true),StandardErrorEncoding=new UTF8Encoding(false,true)};start.EnvironmentVariables["PATH"]=directory+";"+Environment.GetFolderPath(Environment.SpecialFolder.System);start.EnvironmentVariables["TEMP"]=scratch;start.EnvironmentVariables["TMP"]=scratch;child=Process.Start(start);process=child;if(child==null)throw new IOException();Write(new{engineDirectory=directory,databases=data,vaultRoot,downloads});}
  var stderr=Drain(child.StandardError);string line;bool sawReady=false;while((line=BoundedLine(child.StandardOutput))!=null){var value=json.Deserialize<Dictionary<string,object>>(line);if(value==null||!value.ContainsKey("type"))throw new IOException();if((string)value["type"]=="ready"){if(sawReady)throw new IOException();sawReady=true;lock(gate){if(disposed)break;ready=true;if(startupDeadline!=null)startupDeadline.Dispose();}}else if(!sawReady)throw new IOException();if(disposed)break;receive(value);}
  child.WaitForExit(3000);if(!disposed)throw new IOException("Signature worker stopped.");
 }catch(Exception ex){Trace(ex.GetType().Name+": "+ex.Message);if(!disposed)failed("The Sentinel scanner stopped or could not initialize. Your files were not marked clean.");}finally{Stop();}});}
 static string BoundedLine(StreamReader reader){var text=new StringBuilder();for(int i=0;i<65536;i++){int next=reader.Read();if(next<0){if(text.Length==0)return null;throw new IOException();}if(next=='\n')return text.ToString();text.Append((char)next);}throw new IOException("Worker output bound exceeded.");}
 internal void Write(object value){lock(gate){if(disposed||process==null||process.HasExited)throw new IOException("Scanner is not ready.");byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(value)+"\n");if(bytes.Length>32768)throw new IOException();process.StandardInput.BaseStream.Write(bytes,0,bytes.Length);process.StandardInput.BaseStream.Flush();}}
 static async Task Drain(StreamReader reader){char[] buffer=new char[2048];while(await reader.ReadAsync(buffer,0,buffer.Length)>0){}}
 void Stop(){lock(gate){if(startupDeadline!=null)startupDeadline.Dispose();try{if(updateProcess!=null&&!updateProcess.HasExited)updateProcess.Kill();}catch{}updateProcess=null;try{if(process!=null){if(!process.HasExited){process.Kill();process.WaitForExit(2000);}process.Dispose();}}catch{}process=null;foreach(var lease in leases)lease.Dispose();leases.Clear();}}
 public void Dispose(){lock(gate){disposed=true;if(startupDeadline!=null)startupDeadline.Dispose();}Stop();}
}
