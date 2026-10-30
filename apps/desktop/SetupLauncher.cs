using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
public static class SetupLauncher {
 [STAThread] public static void Main() {
  string root=AppDomain.CurrentDomain.BaseDirectory;
  var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell/v1.0/powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+Path.Combine(root,"tools/install-desktop.ps1")+"\"") {UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
  try {using(var process=Process.Start(info)){string output=process.StandardOutput.ReadToEnd();string errors=process.StandardError.ReadToEnd();process.WaitForExit();MessageBox.Show(process.ExitCode==0?output:errors,"Sentinel Setup");}}catch {MessageBox.Show("Setup could not start. Keep the complete package together.","Sentinel Setup");}
 }
}
