using System;
internal static class UsbExactReadDiagnostic {
 [STAThread]static int Main(){try{var state=UsbExactBlockOperations.ReadVerified().GetAwaiter().GetResult();Console.WriteLine("PASS production bridge authenticates original baseline, legacy retirement, protected store and actual saved/effective exact policy; committed="+(state!=null));return 0;}catch(Exception error){for(Exception current=error;current!=null;current=current.InnerException)Console.WriteLine("FAIL "+current.GetType().Name+" HRESULT="+current.HResult.ToString("X8")+" method="+(current.TargetSite==null?"unknown":current.TargetSite.Name)+" context="+(current.Message.Length<180?current.Message:"bounded"));return 1;}}
}
