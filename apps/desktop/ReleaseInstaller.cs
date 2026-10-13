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
 static string Extract(string root){
  if(Directory.Exists(root)||File.Exists(root))throw new IOException("Choose a new staging directory.");
  Directory.CreateDirectory(root);root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
  using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Sentinel.Payload.zip"))using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)){
   if(zip.Entries.Count>4096)throw new IOException("Package has too many files.");long total=0;
   foreach(var entry in zip.Entries){
    string name=entry.FullName.Replace('/',Path.DirectorySeparatorChar);if(Path.IsPathRooted(name)||name.IndexOf(':')>=0||Array.Exists(name.Split(Path.DirectorySeparatorChar),p=>p==".."||p=="."))throw new IOException("Invalid package path.");
    if(((entry.ExternalAttributes>>16)&0xF000)==0xA000)throw new IOException("Links are not supported.");
    string target=Path.GetFullPath(Path.Combine(root,name));if(!target.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid package destination.");
    total+=entry.Length;if(total>536870912||entry.Length>268435456)throw new IOException("Package exceeds size limits.");
    if(entry.FullName.EndsWith("/")){Directory.CreateDirectory(target);continue;}
    Directory.CreateDirectory(Path.GetDirectoryName(target));using(var input=entry.Open())using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write))input.CopyTo(output);
   }
  }
  var json=new JavaScriptSerializer{MaxJsonLength=4194304};var manifest=json.Deserialize<List<Dictionary<string,string>>>(File.ReadAllText(Path.Combine(root,"manifest-sha256.json")));
  if(manifest.Count>4096)throw new IOException("Invalid package manifest.");var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var file in manifest){string target=Path.GetFullPath(Path.Combine(root,file["path"]));if(!target.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!seen.Add(target))throw new IOException("Invalid manifest path.");using(var sha=SHA256.Create())using(var input=File.OpenRead(target)){string actual=BitConverter.ToString(sha.ComputeHash(input)).Replace("-","").ToLowerInvariant();if(actual!=file["sha256"])throw new IOException("Package integrity check failed.");}}
  if(Directory.GetFiles(root,"*",SearchOption.AllDirectories).Length!=manifest.Count+1)throw new IOException("Package contains unlisted files.");return root;
 }
 [STAThread]public static int Main(string[] args){
  bool test=args.Length==2&&args[0]=="--extract-only";
  try{
   if(!test&&args.Length!=0)throw new ArgumentException("Unsupported setup arguments.");
   if(!test&&MessageBox.Show("Install Sentinel v2 for this Windows user? Chrome will need one-time approval to load the included extension.","Sentinel v2 Setup",MessageBoxButtons.OKCancel,MessageBoxIcon.Information)!=DialogResult.OK)return 1;
   string root=Extract(test?args[1]:Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","InstallerCache",Guid.NewGuid().ToString("N")));
   if(test)return 0;
   string script=Path.Combine(root,"tools","install-desktop.ps1");
   var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\""){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root,RedirectStandardOutput=true,RedirectStandardError=true};
   using(var p=Process.Start(info)){var output=p.StandardOutput.ReadToEndAsync();var errors=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(120000)){try{p.Kill();}catch{}throw new IOException("Setup timed out.");}if(p.ExitCode!=0)throw new IOException(errors.Result);}
   string extension=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","ChromeExtension");
   MessageBox.Show("Sentinel is installed. In Chrome, enable Developer mode, choose Load unpacked and select:\n\n"+extension+"\n\nThe desktop connection is already registered.","Sentinel v2 Setup");
   Process.Start(new ProcessStartInfo("explorer.exe","\""+extension+"\""){UseShellExecute=true});
   string chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe");
   if(!File.Exists(chrome))chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Google","Chrome","Application","chrome.exe");
   if(File.Exists(chrome))Process.Start(new ProcessStartInfo(chrome,"chrome://extensions"){UseShellExecute=true});
   Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","Desktop","Sentinel.exe")){UseShellExecute=true});return 0;
  }catch(Exception e){if(!test)MessageBox.Show(e.Message,"Sentinel setup could not finish",MessageBoxButtons.OK,MessageBoxIcon.Error);return 2;}
 }
}
