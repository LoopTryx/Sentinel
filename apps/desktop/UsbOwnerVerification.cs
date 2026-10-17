using System;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;

// Windows desktop interop, no credential collection or administrator-consent substitution.
internal static class UsbOwnerVerification {
 [ComImport,Guid("39E050C3-4E74-441A-8DC0-B81104DF949C"),InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
 interface IConsentInterop {[return:MarshalAs(UnmanagedType.IInspectable)]object RequestVerificationForWindowAsync(IntPtr window,[MarshalAs(UnmanagedType.HString)]string message,ref Guid iid);}
 [ComImport,Guid("00000036-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
 interface IAsyncInfo {uint Id{get;}int Status{get;}int ErrorCode{get;}void Cancel();void Close();}
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 static int pending;
 internal static bool HasPending {get{return System.Threading.Volatile.Read(ref pending)!=0;}}
 internal static async Task<bool> Verify(IntPtr window,string message){
  uint process;if(window==IntPtr.Zero||!IsWindow(window)||GetWindowThreadProcessId(window,out process)==0||process!=(uint)Process.GetCurrentProcess().Id||GetForegroundWindow()!=window||string.IsNullOrEmpty(message)||message.Length>160||message.IndexOf('\0')>=0)return false;
  if(Interlocked.CompareExchange(ref pending,1,0)!=0)return false;
  Task task=null;object operation=null;bool release=true;
  try{
   var verifier=Type.GetType("Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime",true);
   var result=Type.GetType("Windows.Security.Credentials.UI.UserConsentVerificationResult,Windows.Security.Credentials.UI,ContentType=WindowsRuntime",true);
   var asyncType=Type.GetType("Windows.Foundation.IAsyncOperation`1,Windows.Foundation,ContentType=WindowsRuntime",true).MakeGenericType(result);
   var factory=(IConsentInterop)WindowsRuntimeMarshal.GetActivationFactory(verifier);var iid=asyncType.GUID;
   operation=factory.RequestVerificationForWindowAsync(window,message,ref iid);
   foreach(var method in typeof(System.WindowsRuntimeSystemExtensions).GetMethods())if(method.Name=="AsTask"&&method.IsGenericMethodDefinition&&method.GetParameters().Length==1&&method.GetParameters()[0].ParameterType.Name=="IAsyncOperation`1") {task=(Task)method.MakeGenericMethod(result).Invoke(null,new[]{operation});break;}
   if(task==null)return false;
   if(await Task.WhenAny(task,Task.Delay(60000))!=task){
    try{((IAsyncInfo)operation).Cancel();}catch{}
    release=false;var heldOperation=operation;ObserveUntilTerminal(task,heldOperation);return false;
   }
   await task;return Convert.ToInt32(task.GetType().GetProperty("Result").GetValue(task,null))==0;
  }catch{return false;}finally{if(release){if(operation!=null){release=TryFinish(task!=null&&task.IsCompleted,()=>((IAsyncInfo)operation).Cancel(),()=>((IAsyncInfo)operation).Status,()=>((IAsyncInfo)operation).Close());}if(release)Interlocked.Exchange(ref pending,0);}}
 }
 static void ObserveUntilTerminal(Task task,object operation){task.ContinueWith(t=>{try{var observed=t.Exception;((IAsyncInfo)operation).Close();}catch{}finally{Interlocked.Exchange(ref pending,0);}},TaskScheduler.Default);}
 // Projection failure cannot admit a second prompt while the first may still run.
 internal static bool TryFinish(bool completed,System.Action cancel,Func<int> status,System.Action close){
  bool terminal=completed;if(!terminal){try{cancel();}catch{}try{int value=status();terminal=value>=1&&value<=3;}catch{}}
  if(!terminal)return false;try{close();}catch{}return true;
 }}
