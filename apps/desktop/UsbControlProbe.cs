using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;
using System.Web.Script.Serialization;
using System.Diagnostics;

// Temporary observation instrument, not protection/enrollment or a product UI.
internal sealed class UsbControlProbe:Form {
 [StructLayout(LayoutKind.Sequential)]struct Registration{public ushort Page,Usage;public uint Flags;public IntPtr Target;}
 [DllImport("user32.dll",SetLastError=true)]static extern bool RegisterRawInputDevices(Registration[] items,uint count,uint size);
 [DllImport("user32.dll")]static extern uint GetRawInputData(IntPtr raw,uint command,IntPtr data,ref uint size,uint header);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 internal sealed class Counts {
  sealed class Row {internal string Reference,Kind,Placement,Connector;internal int Events;}
  readonly Dictionary<IntPtr,Row> rows=new Dictionary<IntPtr,Row>();internal int Stage,Unattributed,Omitted;
  internal void DeviceChanged(){rows.Clear();Stage=0;Unattributed=0;Omitted=0;}
  internal void Record(IntPtr source,string kind,string placement){Record(source,kind,placement,"unresolved");}
  internal void Record(IntPtr source,string kind,string placement,string connector){
   if((Stage!=1||kind!="keyboard")&&(Stage!=2||(kind!="mouse"&&kind!="touchpad")))return;
   if(source==IntPtr.Zero){Unattributed=Math.Min(1000000,Unattributed+1);return;}
   Row row;if(!rows.TryGetValue(source,out row)){if(rows.Count>=32){Omitted=Math.Min(1000000,Omitted+1);return;}row=new Row{Reference="source-"+(rows.Count+1),Kind=kind,Placement=placement=="platform_input"||placement=="non_usb"||placement=="usb_placement_unverified"?placement:"unverified",Connector=connector=="internal_port_candidate"||connector=="user_connectable"?connector:"unresolved"};rows.Add(source,row);}
   if(row.Kind!=kind)return;row.Events=Math.Min(1000000,row.Events+1);
  }
  internal object Snapshot(){var output=new List<object>();foreach(var row in rows.Values)output.Add(new{reference=row.Reference,kind=row.Kind,placement=row.Placement,connector=row.Connector,eventCount=row.Events});return new{mode="guided_observation",internalExemptionVerified=false,policyChanged=false,unattributed=Unattributed,omitted=Omitted,sources=output};}
 }
 readonly Counts counts=new Counts();readonly Label status=new Label();readonly Timer timer=new Timer();readonly Stopwatch elapsed=Stopwatch.StartNew();long arm;int pending;bool registered,saved;
 static string Output{get{return Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"usb-control-proof.json");}}
 UsbControlProbe(){
  Text="Sentinel — built-in input check";Width=660;Height=340;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;
  var instructions=new Label{Text="Keep the Ducky unplugged. Leave the external keyboard and mouse idle.\n1. Start keyboard check; press and release Ctrl on the LAPTOP keyboard three times.\n2. Start trackpad check; move your finger on the LAPTOP trackpad.\n3. Save and close. This only observes input; no blocking or trust changes.",Dock=DockStyle.Top,Height=105,Padding=new Padding(12)};
  var controls=new FlowLayoutPanel{Dock=DockStyle.Top,Height=45,Padding=new Padding(10)};
  foreach(var item in new[]{new{Text="1. Check built-in keyboard",Stage=1},new{Text="2. Check trackpad",Stage=2},new{Text="3. Save and close",Stage=0}}){int step=item.Stage;var button=new Button{Text=item.Text,AutoSize=true,Height=30};button.Click+=(s,e)=>{if(step==0){Close();return;}if(!registered)return;counts.Stage=0;pending=step;arm=elapsed.ElapsedMilliseconds+1000;status.Text="Starting in one second. Use only the built-in control.";};controls.Controls.Add(button);}
  status.Dock=DockStyle.Fill;status.Padding=new Padding(12);Controls.Add(status);Controls.Add(controls);Controls.Add(instructions);
  Shown+=(s,e)=>{registered=RegisterRawInputDevices(new[]{new Registration{Page=1,Usage=6,Flags=0x2000,Target=Handle},new Registration{Page=1,Usage=2,Flags=0x2000,Target=Handle},new Registration{Page=0x0D,Usage=5,Flags=0x2000,Target=Handle}},3,(uint)Marshal.SizeOf(typeof(Registration)));status.Text=registered?"Ready. Start the keyboard check.":"Raw Input registration unavailable. No proof can be collected.";};
  timer.Interval=250;timer.Tick+=(s,e)=>{if(elapsed.ElapsedMilliseconds>=120000){counts.Stage=0;pending=0;timer.Stop();status.Text="Observation time ended. Save and close to retain the result; reopen for another check.";return;}if(pending!=0&&elapsed.ElapsedMilliseconds>=arm){counts.Stage=pending;pending=0;}if(counts.Stage!=0)status.Text=(counts.Stage==1?"Keyboard check: press Ctrl on the built-in keyboard.":"Trackpad check: move the built-in trackpad.")+"\n\n"+new JavaScriptSerializer().Serialize(counts.Snapshot());};timer.Start();
  FormClosed+=(s,e)=>{timer.Stop();if(!saved){File.WriteAllText(Output,new JavaScriptSerializer().Serialize(new{capturedAtUtc=DateTime.UtcNow.ToString("o"),registered,sessionEnded=true,observation=counts.Snapshot()}));saved=true;}timer.Dispose();};
 }
 protected override void WndProc(ref Message message){if(message.Msg==0xfe){counts.DeviceChanged();pending=0;status.Text="Input devices changed. Previous observations discarded; restart both checks.";}if(message.Msg==0xff&&counts.Stage!=0&&GetForegroundWindow()==Handle)Receive(message.LParam);base.WndProc(ref message);}
 void Receive(IntPtr raw){
  uint size=0,header=(uint)(8+2*IntPtr.Size);if(GetRawInputData(raw,0x10000003,IntPtr.Zero,ref size,header)==uint.MaxValue||size<header||size>4096)return;
  IntPtr data=Marshal.AllocHGlobal((int)size);try{uint read=GetRawInputData(raw,0x10000003,data,ref size,header);if(read!=size||read<header)return;int type=Marshal.ReadInt32(data);IntPtr device=Marshal.ReadIntPtr(data,8);string kind=null;
   if(type==1&&read>=header+16&&counts.Stage==1&&(ushort)Marshal.ReadInt16(data,(int)header+6)==0x11&&(Marshal.ReadInt16(data,(int)header+2)&1)==0)kind="keyboard";
   if(type==0&&read>=header+24&&counts.Stage==2&&(Marshal.ReadInt32(data,(int)header+12)!=0||Marshal.ReadInt32(data,(int)header+16)!=0))kind="mouse";
   if(type==2&&counts.Stage==2&&read>=header+8&&device!=IntPtr.Zero){uint unit=(uint)Marshal.ReadInt32(data,(int)header),reports=(uint)Marshal.ReadInt32(data,(int)header+4);if(unit>0&&reports>0&&(ulong)unit*reports<=read-header-8){var metadata=UsbInternalDetection.ReadForInstance(UsbInputIdentity.ReadInstance(device),"HIDClass");if(metadata.State=="internal_candidate"&&metadata.Role=="touchpad")kind="touchpad";}}
   if(kind!=null){string connector=device==IntPtr.Zero?"unresolved":UsbConnectorEvidence.ForUsbParent(UsbInputIdentity.PrivateUsbGroup(device)).state;counts.Record(device,kind,device==IntPtr.Zero?"unverified":UsbInputIdentity.Placement(device),connector);}
  }finally{Marshal.FreeHGlobal(data);}
 }
 static int SelfTest(){var count=new Counts();count.Record(new IntPtr(123),"keyboard","PRIVATE-SECRET");string text=new JavaScriptSerializer().Serialize(count.Snapshot());if(text.Contains("source-"))return 1;count.Stage=1;count.Record(new IntPtr(123),"mouse","platform_input");count.Record(new IntPtr(123),"keyboard","PRIVATE-SECRET");count.Record(IntPtr.Zero,"keyboard","platform_input");text=new JavaScriptSerializer().Serialize(count.Snapshot());if(text.Contains("PRIVATE")||text.Contains("123")||!text.Contains("unverified")||!text.Contains("\"unattributed\":1")||!text.Contains("\"internalExemptionVerified\":false"))return 2;for(int i=1;i<=33;i++)count.Record(new IntPtr(i),"keyboard","platform_input");text=new JavaScriptSerializer().Serialize(count.Snapshot());if(text.Contains("source-33")||!text.Contains("\"omitted\":2"))return 3;count.DeviceChanged();count.Stage=2;count.Record(new IntPtr(444),"touchpad","platform_input");text=new JavaScriptSerializer().Serialize(count.Snapshot());if(!text.Contains("touchpad")||text.Contains("444"))return 4;count.DeviceChanged();if(new JavaScriptSerializer().Serialize(count.Snapshot()).Contains("source-"))return 5;return 0;}
 [STAThread]static int Main(string[] args){if(args.Length==1&&args[0]=="--self-test")return SelfTest();if(args.Length!=0)return 2;Application.EnableVisualStyles();Application.Run(new UsbControlProbe());return 0;}
}
