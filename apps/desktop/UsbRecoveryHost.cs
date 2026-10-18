using System;
using System.IO;
using System.Globalization;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

// Fixed native recovery-only child. No policy application or arbitrary IPC methods.
internal static class UsbRecoveryHost {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr LoadLibraryExW(string path,IntPtr file,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi,ExactSpelling=true,SetLastError=true)]static extern IntPtr GetProcAddress(IntPtr module,string name);
 [DllImport("kernel32.dll")]static extern bool FreeLibrary(IntPtr module);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetEvent(IntPtr handle);
 [UnmanagedFunctionPointer(CallingConvention.Winapi)]delegate uint Recover(IntPtr handle);
 [STAThread]static int Main(string[] args){
  if(args.Length!=3||args[0]!="--recover-inherited")return 2;
  try{
   string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Sentinel","Usb");
   if(!string.Equals(System.Reflection.Assembly.GetEntryAssembly().Location,Path.Combine(root,"Sentinel.UsbBroker.exe"),StringComparison.OrdinalIgnoreCase))return 2;
   long ready;if(!long.TryParse(args[2],NumberStyles.None,CultureInfo.InvariantCulture,out ready)||ready<=0)return 2;
   using(var journal=ProtectedUsbJournal.ImportMachine(args[1])){
    string library=Path.Combine(root,"Sentinel.UsbRecovery.dll");var held=ProtectedUsbJournal.HoldMachineExecutable(library);
    try{
     IntPtr module=LoadLibraryExW(library,IntPtr.Zero,0x1100);if(module==IntPtr.Zero)return 1;
     try{
      IntPtr function=GetProcAddress(module,"sentinel_usb_recover");if(function==IntPtr.Zero)return 1;
      var recover=(Recover)Marshal.GetDelegateForFunctionPointer(function,typeof(Recover));
      using(var copy=UsbJournalTransport.Duplicate(journal.Stream.SafeFileHandle,false)){
       IntPtr native=copy.DangerousGetHandle();copy.SetHandleAsInvalid(); // Rust consumes this duplicate even on a recovery error.
       if(recover(native)!=0)return 1;
      }
     }finally{FreeLibrary(module);}
    }finally{foreach(var handle in held)handle.Dispose();}
    // Recovery-only completion; there is no subsequent apply action.
    return SetEvent(new IntPtr(ready))?0:1;
   }
  }catch{return 1;}
 }
}
