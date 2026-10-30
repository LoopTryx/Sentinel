using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Diagnostics;
using System.Windows.Forms;
public static class ReleaseInstaller {
 static string ReleaseVersion(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Sentinel.Version.txt")){if(stream==null)return "v1.0.0";using(var reader=new StreamReader(stream)){string version=reader.ReadToEnd().Trim();if(!System.Text.RegularExpressions.Regex.IsMatch(version,@"\Av(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\z"))throw new IOException("Invalid release version.");return version;}}}
 static Stream Payload(){
  var assembly=Assembly.GetExecutingAssembly();var embedded=assembly.GetManifestResourceStream("Sentinel.Payload.zip");if(embedded!=null)return embedded;
  string expected;using(var resource=assembly.GetManifestResourceStream("Sentinel.Payload.sha256")){if(resource==null)throw new IOException("Missing payload verification.");using(var reader=new StreamReader(resource))expected=reader.ReadToEnd().Trim();}
  return InstallerPayload.Open(assembly.Location,expected);
 }
 static void CheckStorage(string destination,bool test){
  long total=0;using(var stream=Payload())using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)){foreach(var entry in zip.Entries){total=checked(total+entry.Length);if(total>3221225472L)throw new IOException("Package exceeds size limits.");}}
  long needed=checked(total*(test?1:2)+536870912L);var drive=new DriveInfo(Path.GetPathRoot(Path.GetFullPath(destination)));
  if(drive.AvailableFreeSpace<needed)throw new IOException("Sentinel Setup needs at least "+Math.Ceiling(needed/1073741824.0)+" GB of free space on "+drive.Name+". Free space, then run Setup again.");
 }
 static string Extract(string root,Action<string> progress){
  if(Directory.Exists(root)||File.Exists(root))throw new IOException("Choose a new staging directory.");
  Directory.CreateDirectory(root);root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
  using(var stream=Payload())using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)){
   if(zip.Entries.Count>4096)throw new IOException("Package has too many files.");long total=0;
   int completed=0;foreach(var entry in zip.Entries){
    progress("Installing app files — "+(++completed)+" of "+zip.Entries.Count);
    string name=entry.FullName.Replace('/',Path.DirectorySeparatorChar);if(Path.IsPathRooted(name)||name.IndexOf(':')>=0||Array.Exists(name.Split(Path.DirectorySeparatorChar),p=>p==".."||p=="."))throw new IOException("Invalid package path.");
    if(((entry.ExternalAttributes>>16)&0xF000)==0xA000)throw new IOException("Links are not supported.");
    string target=Path.GetFullPath(Path.Combine(root,name));if(!target.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid package destination.");
    total+=entry.Length;if(total>3221225472L||entry.Length>1610612736L)throw new IOException("Package exceeds size limits.");
    if(entry.FullName.EndsWith("/")){Directory.CreateDirectory(target);continue;}
    Directory.CreateDirectory(Path.GetDirectoryName(target));using(var input=entry.Open())using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write))input.CopyTo(output);
   }
  }
  var json=new JavaScriptSerializer{MaxJsonLength=4194304};var manifest=json.Deserialize<List<Dictionary<string,string>>>(File.ReadAllText(Path.Combine(root,"manifest-sha256.json")));
  if(manifest.Count>4096)throw new IOException("Invalid package manifest.");var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var file in manifest){string target=Path.GetFullPath(Path.Combine(root,file["path"]));if(!target.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!seen.Add(target))throw new IOException("Invalid manifest path.");using(var sha=SHA256.Create())using(var input=File.OpenRead(target)){string actual=BitConverter.ToString(sha.ComputeHash(input)).Replace("-","").ToLowerInvariant();if(actual!=file["sha256"])throw new IOException("Package integrity check failed.");}}
  if(Directory.GetFiles(root,"*",SearchOption.AllDirectories).Length!=manifest.Count+1)throw new IOException("Package contains unlisted files.");return root;
 }
 internal static void Install(Action<string> progress){
   string destination=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","InstallerCache",Guid.NewGuid().ToString("N"));
   progress("Checking installer integrity and available space…");CheckStorage(destination,false);string root=Extract(destination,progress);
   progress("Setting up Sentinel and checking Microsoft WebView2…");
   string script=Path.Combine(root,"tools","install-desktop.ps1");
   var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\""){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root,RedirectStandardOutput=true,RedirectStandardError=true};
   using(var p=Process.Start(info)){var output=p.StandardOutput.ReadToEndAsync();var errors=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(600000)){try{p.Kill();}catch{}throw new IOException("Setup timed out.");}if(p.ExitCode!=0)throw new IOException(errors.Result);}
   // Remove only this generated extraction directory after successful installation.
   try{bool redirected=false;var pending=new Stack<string>();pending.Push(root);while(pending.Count>0){string directory=pending.Pop();if((File.GetAttributes(directory)&FileAttributes.ReparsePoint)!=0){redirected=true;break;}foreach(string child in Directory.GetDirectories(directory))pending.Push(child);}
    if(!redirected)Directory.Delete(root,true);
   }catch{} // Cache cleanup must never turn a completed installation into failure.
 }
 internal static string ChromePath(){
   string chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe");
   if(!File.Exists(chrome))chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Google","Chrome","Application","chrome.exe");
   if(!File.Exists(chrome))chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Google","Chrome","Application","chrome.exe");
   return File.Exists(chrome)?chrome:null;
 }
 [STAThread]public static int Main(string[] args){
  bool test=args.Length==2&&args[0]=="--extract-only";bool verify=args.Length==1&&args[0]=="--verify-only";
  try{
   if(verify){using(var payload=Payload())using(var archive=new ZipArchive(payload,ZipArchiveMode.Read)){if(archive.GetEntry("manifest-sha256.json")==null)throw new IOException("Missing package manifest.");}return 0;}
   if(test){CheckStorage(args[1],true);Extract(args[1],delegate{});return 0;}
   if(args.Length!=0)throw new ArgumentException("Unsupported setup arguments.");
   new System.Windows.Application().Run(new InstallerWizard(ReleaseVersion()));return 0;
  }catch(Exception e){if(test){try{File.WriteAllText(args[1]+".error.txt",e.Message);}catch{}}if(!test&&!verify)MessageBox.Show(e.Message,"Sentinel setup could not finish",MessageBoxButtons.OK,MessageBoxIcon.Error);return 2;}
 }
}
