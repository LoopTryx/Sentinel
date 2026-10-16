using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
public static class AppLauncher {
    [STAThread] public static void Main() {
        string root=AppDomain.CurrentDomain.BaseDirectory;
        string executable=Path.Combine(root,"apps/desktop/console-build/Sentinel.Glass.exe");
        try { Process.Start(new ProcessStartInfo(executable,"--app") {UseShellExecute=false,WorkingDirectory=root}); }
        catch { MessageBox.Show("Keep Sentinel.exe with the complete app folder.","Sentinel"); }
    }
}
