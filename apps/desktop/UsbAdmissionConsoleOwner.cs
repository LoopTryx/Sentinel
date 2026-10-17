using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Presentation-only owner binding. This never supplies enrollment, policy or
// authorization. The protected operator still owns its Hello window/proof.
internal sealed class UsbAdmissionConsoleOwner:IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out Rect rectangle);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW",SetLastError=true)]static extern IntPtr SetWindowLongPtr(IntPtr window,int index,IntPtr value);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
 readonly Process process;readonly IntPtr window;
 UsbAdmissionConsoleOwner(Process parent,IntPtr handle){process=parent;window=handle;}
 internal static bool Parse(string[] args,out int pid,out long handle,out long started){pid=0;handle=0;started=0;return args!=null&&args.Length==4&&args[0]=="--console"&&int.TryParse(args[1],out pid)&&pid>0&&long.TryParse(args[2],out handle)&&handle>0&&long.TryParse(args[3],out started)&&started>0;}
 internal static UsbAdmissionConsoleOwner Open(string[] args){
  int pid;long handle,started;if(!Parse(args,out pid,out handle,out started))throw new ArgumentException("Console owner refused");
  var parent=Process.GetProcessById(pid);try{uint actual;IntPtr hwnd=new IntPtr(handle);
   if(parent.SessionId!=Process.GetCurrentProcess().SessionId||parent.StartTime.ToUniversalTime().Ticks!=started||GetWindowThreadProcessId(hwnd,out actual)==0||actual!=(uint)pid||!IsWindowVisible(hwnd)||!string.Equals(Path.GetFileName(parent.MainModule.FileName),"Sentinel.Glass.exe",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Console owner unavailable");
   return new UsbAdmissionConsoleOwner(parent,hwnd);
  }catch{parent.Dispose();throw;}
 }
 internal int ProcessId{get{return process.Id;}}
 internal long ProcessStartTicks{get{return process.StartTime.ToUniversalTime().Ticks;}}
 internal bool Alive{get{try{return !process.HasExited;}catch{return false;}}}
 internal bool OwnsForeground{get{return GetForegroundWindow()==window;}}
 internal bool Position(Form form){
  if(process.HasExited||!IsWindowVisible(window))return false;uint pid;Rect r;if(GetWindowThreadProcessId(window,out pid)==0||pid!=(uint)process.Id||!GetWindowRect(window,out r))return false;
  int width=r.Right-r.Left,height=r.Bottom-r.Top;if(width<600||height<400||width>8192||height>8192)return false;
  int sidebar=(int)Math.Round(width*0.178);var target=new Rectangle(r.Left+sidebar+8,r.Top+64,width-sidebar-18,height-76);if(form.Bounds!=target)form.Bounds=target;return true;
 }
 internal void Attach(Form form){form.ShowInTaskbar=false;form.FormBorderStyle=FormBorderStyle.None;SetWindowLongPtr(form.Handle,-8,window);if(GetWindowLongPtr(form.Handle,-8)!=window)throw new InvalidOperationException("Console panel attachment refused");if(!Position(form))throw new InvalidOperationException("Console owner unavailable");}
 public void Dispose(){process.Dispose();}
}
