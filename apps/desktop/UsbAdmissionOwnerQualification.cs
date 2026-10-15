using System;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

// Interactive platform qualification only. Its receipt is never an approval,
// enrollment, authenticated caller token, or permission to release a device.
internal sealed class UsbAdmissionOwnerQualification : Form {
 readonly Button verify=new Button(),cancel=new Button();
 readonly Label status=new Label();
 readonly System.Windows.Forms.Timer clock=new System.Windows.Forms.Timer();
 readonly System.Diagnostics.Stopwatch elapsed=System.Diagnostics.Stopwatch.StartNew();
 bool requested,ending,finished;Task<bool> operation;
 static void Receipt(string state){using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Sentinel\UsbAdmissionOwnerQualification")){key.SetValue("State",state);}}
 UsbAdmissionOwnerQualification(){
  Text="Sentinel — Windows Hello verification";Width=530;Height=220;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;MinimizeBox=false;
  status.SetBounds(20,20,470,78);status.Text="Verify your identity with Windows Hello. This checks device-approval verification only; no USB settings will change.";
  verify.Text="Verify with Windows Hello";verify.SetBounds(20,112,245,35);verify.Click+=async delegate{await Verify();};
  cancel.Text="Cancel";cancel.SetBounds(280,112,130,35);cancel.Click+=delegate{End("cancelled");};
  Controls.AddRange(new Control[]{status,verify,cancel});
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!finished){e.Cancel=true;End("cancelled");}};
  clock.Interval=200;clock.Tick+=delegate{
   if(!ending&&elapsed.ElapsedMilliseconds>=120000)End("unavailable");
   if(ending&&(operation==null||operation.IsCompleted)&&!UsbOwnerVerification.HasPending){finished=true;clock.Stop();Close();}
  };clock.Start();
 }
 async Task Verify(){
  if(requested||ending)return;requested=true;verify.Enabled=false;status.Text="Complete Windows Hello verification.";
  try{
   // Same-process foreground HWND validation occurs inside the existing verifier.
   operation=UsbOwnerVerification.Verify(Handle,"Sentinel: verify your identity for USB device approval.");
   bool verified=await operation;
   if(!ending)End(verified?"verified":"unavailable");
  }catch{if(!ending)End("unavailable");}
 }
 void End(string state){
  if(ending)return;ending=true;verify.Enabled=false;cancel.Enabled=false;
  try{Receipt(state);}catch{}
  Hide();
  // Never kill an outstanding native prompt. Verify owns its cancellation and
  // completion latch; retain this message pump until that latch is terminal.
 }
 protected override void Dispose(bool disposing){if(disposing)clock.Dispose();base.Dispose(disposing);}
 [STAThread]static int Main(string[] args){
  if(args.Length!=0)return 2;
  using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  bool created;using(var singleton=new Mutex(true,@"Local\SentinelUsbAdmissionOwnerQualification",out created)){
   if(!created)return 4;
   try{Receipt("pending");Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new UsbAdmissionOwnerQualification());return 0;}
   catch{try{Receipt("unavailable");}catch{}return 1;}
   finally{singleton.ReleaseMutex();}
  }
 }
}
