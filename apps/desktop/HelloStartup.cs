using System;
using System.Diagnostics;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class HelloStartup {
 internal static async Task<string> Availability(){
  try{
   var verifier=Type.GetType("Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime",true);
   var result=Type.GetType("Windows.Security.Credentials.UI.UserConsentVerifierAvailability,Windows.Security.Credentials.UI,ContentType=WindowsRuntime",true);
   object operation=verifier.GetMethod("CheckAvailabilityAsync",BindingFlags.Public|BindingFlags.Static).Invoke(null,null);Task task=null;
   foreach(var method in typeof(System.WindowsRuntimeSystemExtensions).GetMethods())if(method.Name=="AsTask"&&method.IsGenericMethodDefinition&&method.GetParameters().Length==1&&method.GetParameters()[0].ParameterType.Name=="IAsyncOperation`1"){task=(Task)method.MakeGenericMethod(result).Invoke(null,new[]{operation});break;}
   if(task==null||await Task.WhenAny(task,Task.Delay(10000))!=task)return "Unavailable";
   await task;return task.GetType().GetProperty("Result").GetValue(task,null).ToString();
  }catch{return "Unavailable";}
 }
 internal static bool Require(){
  for(;;){string state=Availability().GetAwaiter().GetResult();if(state=="Available")return true;
   var text="Set up Windows Hello before opening Sentinel. It protects device approvals.\n\n1. Open Settings > Accounts > Sign-in options.\n2. Under PIN (Windows Hello), select Set up or Add.\n3. Follow Windows' instructions to create your PIN. Fingerprint or face recognition is optional.\n4. Return here and choose Retry.\n\nIf your organization disables Hello, contact its administrator. If it is temporarily busy, finish the other verification and retry.\n\nStatus: "+state+"\n\nRetry checks again. Cancel exits Sentinel.";
   using(var dialog=new Form{Text="Sentinel — Windows Hello required",Width=570,Height=410,StartPosition=FormStartPosition.CenterScreen,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false}){
    var label=new Label{Text=text,Dock=DockStyle.Fill,Padding=new Padding(20),AutoSize=false};var buttons=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=55,Padding=new Padding(12),FlowDirection=FlowDirection.RightToLeft};
    var retry=new Button{Text="Retry",DialogResult=DialogResult.Retry};var cancel=new Button{Text="Cancel",DialogResult=DialogResult.Cancel};var settings=new Button{Text="Open Settings",AutoSize=true};settings.Click+=delegate{try{Process.Start(new ProcessStartInfo("ms-settings:signinoptions"){UseShellExecute=true});}catch{MessageBox.Show("Open Windows Settings > Accounts > Sign-in options.","Windows Hello");}};
    buttons.Controls.Add(retry);buttons.Controls.Add(cancel);buttons.Controls.Add(settings);dialog.Controls.Add(label);dialog.Controls.Add(buttons);dialog.AcceptButton=retry;dialog.CancelButton=cancel;if(dialog.ShowDialog()!=DialogResult.Retry)return false;
   }
  }
 }
}
