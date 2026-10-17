using System;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

// Desktop-only signing adapter. Opens an existing owner key; never silently
// creates/replaces a key, collects credentials, or returns a consent Boolean.
internal static class UsbHelloSignature {
 [ComImport,Guid("00000036-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]interface IAsyncInfo{uint Id{get;}int Status{get;}int ErrorCode{get;}void Cancel();void Close();}
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 internal sealed class Result{internal readonly string State;internal readonly byte[] PublicKey,Signature;internal Result(string state,byte[] key,byte[] signature){State=state;PublicKey=key;Signature=signature;}}
 static int pending;
 const string Alias="Sentinel.UsbGuard.Owner.v1";
 internal static readonly string PublicKeyBlobTypeName="Windows.Security.Cryptography.Core.CryptographicPublicKeyBlobType";
 internal static bool ProjectionAvailable(){try{var blob=Win(PublicKeyBlobTypeName);var credential=Win("Windows.Security.Credentials.KeyCredential");return Enum.IsDefined(blob,"Capi1PublicKey")&&credential.GetMethod("RetrievePublicKey",new[]{blob})!=null;}catch{return false;}}
 internal static bool ValidPayload(byte[] payload){return payload!=null&&payload.Length>0&&payload.Length<=1024;}
 internal static Result Finish(string state,byte[] key,byte[] signature){if(state!="signed")return new Result(state=="cancelled"?"cancelled":"unavailable",null,null);if(key==null||key.Length<20||key.Length>1024||key[0]!=6||signature==null||(signature.Length!=256&&signature.Length!=384&&signature.Length!=512))return new Result("unavailable",null,null);return new Result("signed",(byte[])key.Clone(),(byte[])signature.Clone());}
 static bool Window(IntPtr window){uint process;return window!=IntPtr.Zero&&IsWindow(window)&&GetWindowThreadProcessId(window,out process)!=0&&process==(uint)Process.GetCurrentProcess().Id&&GetForegroundWindow()==window;}
 static Type Win(string name){return Type.GetType(name+", "+name.Substring(0,name.LastIndexOf('.'))+", ContentType=WindowsRuntime",true);}
 static Task TaskFor(object operation,Type result){foreach(var method in typeof(System.WindowsRuntimeSystemExtensions).GetMethods())if(method.Name=="AsTask"&&method.IsGenericMethodDefinition&&method.GetParameters().Length==1&&method.GetParameters()[0].ParameterType.Name=="IAsyncOperation`1")return (Task)method.MakeGenericMethod(result).Invoke(null,new[]{operation});throw new NotSupportedException();}
 static object Buffer(byte[] bytes){var type=typeof(System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions);return type.GetMethod("AsBuffer",new[]{typeof(byte[])}).Invoke(null,new object[]{bytes});}
 static byte[] Bytes(object buffer){if(buffer==null)throw new NotSupportedException();uint size=Convert.ToUInt32(buffer.GetType().GetProperty("Length").GetValue(buffer,null));if(size==0||size>1024)throw new NotSupportedException();var type=typeof(System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions);foreach(var method in type.GetMethods())if(method.Name=="ToArray"&&method.GetParameters().Length==1)return (byte[])method.Invoke(null,new[]{buffer});throw new NotSupportedException();}
 internal static async Task<Result> SignExisting(IntPtr window,byte[] servicePayload){
  if(!ValidPayload(servicePayload)||!Window(window)||Interlocked.CompareExchange(ref pending,1,0)!=0)return Finish("unavailable",null,null);
  var payload=(byte[])servicePayload.Clone();object operation=null;Task task=null;bool release=true;var elapsed=Stopwatch.StartNew();
  try{
   var manager=Win("Windows.Security.Credentials.KeyCredentialManager");var credentialResult=Win("Windows.Security.Credentials.KeyCredentialRetrievalResult");
   operation=manager.GetMethod("OpenAsync",new[]{typeof(string)}).Invoke(null,new object[]{Alias});task=TaskFor(operation,credentialResult);
   if(await Task.WhenAny(task,Task.Delay(60000))!=task){release=false;Hold(task,operation);return Finish("unavailable",null,null);}await task;
   object opened=task.GetType().GetProperty("Result").GetValue(task,null);((IAsyncInfo)operation).Close();operation=null;task=null;
   if(Convert.ToInt32(opened.GetType().GetProperty("Status").GetValue(opened,null))!=0||!Window(window))return Finish("unavailable",null,null);
   object credential=opened.GetType().GetProperty("Credential").GetValue(opened,null);var blobType=Win(PublicKeyBlobTypeName);
   byte[] key=Bytes(credential.GetType().GetMethod("RetrievePublicKey",new[]{blobType}).Invoke(credential,new[]{Enum.Parse(blobType,"Capi1PublicKey")}));
   var signResult=Win("Windows.Security.Credentials.KeyCredentialOperationResult");operation=credential.GetType().GetMethod("RequestSignAsync").Invoke(credential,new[]{Buffer(payload)});task=TaskFor(operation,signResult);
   int remaining=(int)Math.Max(0,60000-elapsed.ElapsedMilliseconds);if(await Task.WhenAny(task,Task.Delay(remaining))!=task){release=false;Hold(task,operation);return Finish("unavailable",null,null);}await task;
   object signed=task.GetType().GetProperty("Result").GetValue(task,null);if(Convert.ToInt32(signed.GetType().GetProperty("Status").GetValue(signed,null))!=0)return Finish("cancelled",null,null);
   return Finish("signed",key,Bytes(signed.GetType().GetProperty("Result").GetValue(signed,null)));
  }catch{return Finish("unavailable",null,null);}finally{Array.Clear(payload,0,payload.Length);if(release){if(operation!=null){try{if(task==null||!task.IsCompleted){((IAsyncInfo)operation).Cancel();if(((IAsyncInfo)operation).Status==0)release=false;}if(release)((IAsyncInfo)operation).Close();}catch{release=false;}}if(release)Interlocked.Exchange(ref pending,0);}}
 }
 static void Hold(Task task,object operation){try{((IAsyncInfo)operation).Cancel();}catch{}task.ContinueWith(t=>{try{var ignored=t.Exception;((IAsyncInfo)operation).Close();}catch{}finally{Interlocked.Exchange(ref pending,0);}},TaskScheduler.Default);}
}
