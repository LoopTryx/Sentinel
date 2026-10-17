using System;
using System.IO;
internal static class UsbExactReadDiagnostic {
 static void Failure(Exception error){foreach(var current in error is AggregateException?(System.Collections.Generic.IEnumerable<Exception>)((AggregateException)error).Flatten().InnerExceptions:new System.Collections.Generic.List<Exception>{error})for(Exception nested=current;nested!=null;nested=nested.InnerException)Console.WriteLine("FAIL "+nested.GetType().Name+" HRESULT="+nested.HResult.ToString("X8")+" method="+(nested.TargetSite==null?"unknown":nested.TargetSite.Name)+" context="+(nested.Message.Length<180?nested.Message:"bounded"));}
 [STAThread]static int Main(string[] args){try{
 if(args.Length>1||args.Length==1&&args[0]!="--recover")return 2;
 string hash=UsbExactBlockCapability.ReadWorkerHash();using(var store=new UsbExactBlockFileStore(Path.Combine(UsbExactBlockCapability.Root,"State"))){var state=store.ReadCommitted();var pending=store.ReadPending();Console.WriteLine("STATE committed="+(state!=null)+" blocks="+(state==null?0:state.Blocked.Length)+" pending="+(pending!=null));if(pending!=null){Console.WriteLine("PENDING phase="+pending.Phase+" action="+pending.Request.Action+" targets="+pending.Request.Targets.Length+" before_decision="+UsbExactBlockState.Same(state,pending.Request.Before)+" after_decision="+UsbExactBlockState.Same(state,pending.Request.After));using(var backend=new UsbExactBlockBackend(store,hash)){try{backend.VerifyPolicy(pending.Request.Before);Console.WriteLine("BEFORE_POLICY verified");}catch(Exception error){Failure(error);}try{backend.VerifyPolicy(pending.Request.After);Console.WriteLine("AFTER_POLICY verified");}catch(Exception error){Failure(error);}}}}
 if(args.Length==1){UsbExactBlockOperations.RecoverPending().GetAwaiter().GetResult();Console.WriteLine("RECOVERY verified");}
 var verified=UsbExactBlockOperations.ReadVerified().GetAwaiter().GetResult();Console.WriteLine("PASS production bridge authenticates original baseline, legacy retirement, protected store and actual saved/effective exact policy; committed="+(verified!=null));return 0;
 }catch(Exception error){Failure(error);return 1;}}
}
