using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Reflection;
using System.Security.Principal;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// Fixed native operator. Device IDs come only from native enumeration and the
// protected enrollment file. No renderer payload or command-line device selector.
internal sealed partial class UsbAdmissionWindow : Form {
 // Shared class-wide apply is withheld from every UI entrypoint after the cross-device regression.
 static readonly bool DeviceScopeQualified=false;
 static readonly string CodeRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelUsbAdmission");
 static readonly string StateRoot=Path.Combine(CodeRoot,"State");
 readonly UsbAdmissionConsoleOwner consoleOwner; readonly System.Windows.Forms.Timer ownerPoll=new System.Windows.Forms.Timer(); readonly ProgressBar activity=new ProgressBar(); readonly Button back=new Button();
 readonly Label heading=new Label(),summary=new Label(),message=new Label(),footer=new Label();
 readonly FlowLayoutPanel cards=new FlowLayoutPanel(); readonly ListView devices=new ListView();readonly Button refresh=new Button(),arm=new Button(),release=new Button();
 readonly System.Windows.Forms.Timer poll=new System.Windows.Forms.Timer();readonly List<IDisposable> pins;
 UsbAdmissionWorkerBackend backend;UsbAdmissionNativeStores stores;UsbAdmissionInventory.Result inventory;UsbEnrollmentConfig.Snapshot config;
 UsbAdmissionJournal.Record active;bool busy,binding,closing,finished,staged;string verifiedNonce;DateTime verifiedAt;string recoveryStatus;bool verifiedOff;
 sealed class Row {internal string Id,Category;internal bool Present;}
 sealed class NativeClock : UsbAdmissionTransaction.IClock {public DateTime UtcNow {get{return DateTime.UtcNow;}}}
 sealed class RecoveryAuthority : UsbAdmissionTransaction.INativeAuthority {
  public void ConsumeOwnerProof(UsbAdmissionTransaction.Request request){throw new InvalidOperationException("Recovery cannot grant input access.");}
  public void VerifyCurrentTopology(UsbAdmissionTransaction.Request request){throw new InvalidOperationException("Recovery cannot grant input access.");}
 }
 sealed class View {internal UsbAdmissionInventory.Result Inventory;internal UsbEnrollmentConfig.Snapshot Config;internal UsbAdmissionJournal.Record Active;internal bool Verified,Staged;}
 UsbAdmissionWindow(List<IDisposable> ancestry,UsbAdmissionConsoleOwner owner=null,string tabPipe=null){
  tabPipeName=tabPipe;
  consoleOwner=owner;
  pins=ancestry;Text="Sentinel · USB Guard";ClientSize=new Size(1020,660);MinimumSize=owner==null?Size:new Size(640,430);MaximumSize=owner==null?Size:Size.Empty;FormBorderStyle=FormBorderStyle.FixedSingle;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;
  BackColor=Color.FromArgb(19,27,46);ForeColor=Color.FromArgb(224,234,248);Font=new Font("Segoe UI",10);
  heading.Text=owner==null?"USB Guard":"Input access";heading.Font=new Font("Segoe UI Semibold",24);heading.SetBounds(28,22,500,45);
  summary.SetBounds(30,77,950,30);summary.ForeColor=Color.FromArgb(106,187,255);summary.Text="Checking connected input devices…";
  devices.SetBounds(28,120,964,390);devices.View=System.Windows.Forms.View.Details;devices.CheckBoxes=true;devices.Visible=false;devices.FullRowSelect=true;devices.HideSelection=false;devices.MultiSelect=false;devices.BackColor=Color.FromArgb(24,35,57);devices.ForeColor=ForeColor;devices.BorderStyle=BorderStyle.None;
  devices.Columns.Add("Device",470);devices.Columns.Add("Connection",210);devices.Columns.Add("Access",255);
  devices.ItemCheck+=delegate(object sender,ItemCheckEventArgs e){if(binding)return;var row=devices.Items[e.Index].Tag as Row;if(busy||row==null||row.Category=="required_safety_candidate"){e.NewValue=e.CurrentValue;return;}BeginInvoke(new Action(UpdateButtons));};
  Style(refresh,"Refresh",28,531,120);Style(arm,"Block unapproved devices",160,531,230);Style(release,"Release input",402,531,155);
  refresh.Click+=async delegate{await RefreshView(true,false);};arm.Click+=async delegate{await ApplySelection();};release.Click+=async delegate{await ManualRelease();};
  message.SetBounds(30,581,945,43);message.ForeColor=Color.FromArgb(255,199,118);footer.SetBounds(30,628,950,22);footer.Font=new Font("Segoe UI",9);footer.ForeColor=Color.FromArgb(142,164,194);footer.Text="USB keyboard and mouse access · Windows Hello approval · five-minute automatic release";
  activity.Style=ProgressBarStyle.Marquee;activity.MarqueeAnimationSpeed=28;activity.Visible=false;
  back.Text="×";back.FlatStyle=FlatStyle.Flat;back.FlatAppearance.BorderSize=0;back.BackColor=BackColor;back.ForeColor=ForeColor;back.Click+=delegate{Close();};back.Visible=owner!=null;
  cards.AutoScroll=true;cards.FlowDirection=FlowDirection.TopDown;cards.WrapContents=false;cards.BackColor=BackColor;
  Controls.AddRange(new Control[]{heading,summary,cards,devices,refresh,arm,release,message,footer,activity,back});
  Resize+=delegate{ArrangePanel();};ArrangePanel();
  devices.OwnerDraw=true;devices.DrawColumnHeader+=delegate(object sender,DrawListViewColumnHeaderEventArgs e){using(var brush=new SolidBrush(Color.FromArgb(33,48,73)))e.Graphics.FillRectangle(brush,e.Bounds);TextRenderer.DrawText(e.Graphics,e.Header.Text,Font,e.Bounds,ForeColor,TextFormatFlags.Left|TextFormatFlags.VerticalCenter);};devices.DrawItem+=delegate(object sender,DrawListViewItemEventArgs e){e.DrawDefault=true;};devices.DrawSubItem+=delegate(object sender,DrawListViewSubItemEventArgs e){e.DrawDefault=true;};
  Shown+=async delegate{
   if(tabPipeName!=null){Opacity=0;ShowInTaskbar=false;ownerPoll.Interval=1000;ownerPoll.Tick+=delegate{if(!consoleOwner.Alive&&!busy)Close();};ownerPoll.Start();
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
if(UsbExactBlockCapability.IsInstalled()){try{await UsbExactBlockOperations.RecoverPending();}catch{message.Text="Previous USB operation requires authenticated recovery.";}inventory=await Task.Run(()=>UsbAdmissionInventory.Collect(null));Hide();StartTabServer();return;}
#endif
await RefreshView(true,false);Hide();StartTabServer();return;}
   if(consoleOwner!=null){consoleOwner.Attach(this);ArrangePanel();ownerPoll.Interval=300;ownerPoll.Tick+=delegate{if(!consoleOwner.Position(this)&&!busy)Close();};ownerPoll.Start();}await RefreshView(true,false);
  };
  Deactivate+=delegate{if(tabPipeName==null&&consoleOwner!=null&&!busy)BeginInvoke(new Action(()=>{if(!busy&&consoleOwner.OwnsForeground)Close();}));};
  poll.Interval=10000;poll.Tick+=async delegate{if(closing){FinishClose();return;}if(tabPipeName==null&&!busy)await RefreshView(true,true);};poll.Start();
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(finished)return;if(busy||UsbOwnerVerification.HasPending){e.Cancel=true;closing=true;Hide();return;}finished=true;};
 }
 void ArrangePanel(){int width=ClientSize.Width,height=ClientSize.Height;heading.SetBounds(24,20,width-90,42);back.SetBounds(width-55,18,32,32);summary.SetBounds(26,70,width-52,30);devices.SetBounds(24,110,width-48,Math.Max(100,height-290));cards.SetBounds(24,110,width-48,Math.Max(100,height-290));foreach(Control card in cards.Controls)card.Width=Math.Max(450,cards.ClientSize.Width-24);devices.Columns[0].Width=(int)((width-52)*.45);devices.Columns[1].Width=(int)((width-52)*.24);devices.Columns[2].Width=(int)((width-52)*.30);int y=height-158;refresh.SetBounds(24,y,110,36);arm.SetBounds(144,y,210,36);release.SetBounds(364,y,150,36);activity.SetBounds(24,y+47,width-48,4);message.SetBounds(26,y+63,width-52,42);footer.SetBounds(26,height-33,width-52,24);}
 void Style(Button button,string text,int x,int y,int width){button.Text=text;button.SetBounds(x,y,width,36);button.FlatStyle=FlatStyle.Flat;button.FlatAppearance.BorderColor=Color.FromArgb(65,130,192);button.BackColor=Color.FromArgb(30,65,101);button.ForeColor=ForeColor;button.Cursor=Cursors.Hand;}
 void SetBusy(bool value){busy=value;activity.Visible=value;devices.Enabled=!value;cards.Enabled=!value;UpdateButtons();}
 void UpdateButtons(){bool idle=!busy&&!UsbOwnerVerification.HasPending;refresh.Enabled=idle;arm.Enabled=DeviceScopeQualified&&idle&&!staged&&stores!=null&&inventory!=null&&inventory.Complete&&inventory.Preflight!=null&&inventory.Preflight.State=="review_required";release.Enabled=idle&&stores!=null&&(active!=null||(config!=null&&inventory!=null&&inventory.Complete));release.Text=active==null?"Reconnect inputs":"Release input";arm.Text=active==null?"Block unapproved devices":"Apply device access";}
 HashSet<string> SelectedExternal(){var result=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(ListViewItem item in devices.Items){var row=item.Tag as Row;if(row!=null&&row.Category!="required_safety_candidate"&&item.Checked)result.Add(row.Id);}return result;}
 void Bind(View view,bool preserveSelection){
  var selected=preserveSelection?SelectedExternal():new HashSet<string>(view.Config==null?new string[0]:view.Config.ApprovedExternal,StringComparer.OrdinalIgnoreCase);
  inventory=view.Inventory;config=view.Config;active=view.Active;verifiedOff=view.Verified&&active==null;staged=view.Staged;if(view.Verified&&active!=null){verifiedNonce=active.Nonce;verifiedAt=DateTime.UtcNow;}if(active==null)verifiedNonce=null;
  var names=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);if(inventory.Subjects!=null)foreach(var subject in inventory.Subjects)if(subject!=null&&subject.Input!=null)names[subject.Input.Instance]=subject.DisplayName;
  var approved=new HashSet<string>(config==null?new string[0]:config.ApprovedExternal,StringComparer.OrdinalIgnoreCase);var present=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  binding=true;devices.BeginUpdate();try{
   devices.Items.Clear();devices.Groups.Clear();var safetyGroup=new ListViewGroup("Built-in controls");var externalGroup=new ListViewGroup("USB devices");var absentGroup=new ListViewGroup("Saved devices — disconnected");devices.Groups.AddRange(new[]{safetyGroup,externalGroup,absentGroup});
   if(inventory.Preflight!=null&&inventory.Preflight.Candidates!=null)foreach(var candidate in inventory.Preflight.Candidates){
    present.Add(candidate.Instance);bool safety=candidate.Category=="required_safety_candidate";string name;if(!names.TryGetValue(candidate.Instance,out name))name="USB input device";
    var item=new ListViewItem(name,safety?safetyGroup:externalGroup);item.SubItems.Add(safety?"Built-in USB input":"External USB input");item.SubItems.Add(safety?"Safety exception":approved.Contains(candidate.Instance)?"Approved":"Pending approval");item.Tag=new Row{Id=candidate.Instance,Category=candidate.Category,Present=true};item.Checked=safety||selected.Contains(candidate.Instance);if(safety)item.ForeColor=Color.FromArgb(155,210,248);devices.Items.Add(item);
   }
   int missing=0;foreach(string id in approved)if(!present.Contains(id)){var item=new ListViewItem("Saved USB device "+(++missing),absentGroup);item.SubItems.Add("Disconnected");item.SubItems.Add("Approved");item.Tag=new Row{Id=id,Category="external_approval_required",Present=false};item.Checked=selected.Contains(id);devices.Items.Add(item);}
  }finally{devices.EndUpdate();binding=false;}
  if(active==null)summary.Text="USB Guard is off · "+(inventory.Preflight==null?0:inventory.Preflight.ExternalCandidates)+" external input devices found";
  else if(DateTime.UtcNow>=active.DeadlineUtc)summary.Text="Automatic release is due · checking recovery";
  else if(verifiedNonce==active.Nonce&&(DateTime.UtcNow-verifiedAt).TotalSeconds<30)summary.Text="Windows input rule verified · releases at "+active.DeadlineUtc.ToLocalTime().ToString("HH:mm:ss");
  else summary.Text="An input rule is recorded · refresh to verify Windows state";
  if(!inventory.Complete||inventory.Preflight==null||inventory.Preflight.State!="review_required")message.Text="Some device connections could not be verified. Reconnect them and refresh before starting.";
  else if(view.Staged)message.Text="Saved changes need recovery before another rule can start.";
  BuildDeviceCards(active!=null&&verifiedNonce==active.Nonce&&(DateTime.UtcNow-verifiedAt).TotalSeconds<30&&DateTime.UtcNow<active.DeadlineUtc);UpdateButtons();
 }
 void BuildDeviceCards(bool verifiedRule){
  verifiedRule=verifiedRule&&config!=null&&active!=null&&Convert.ToBase64String(Policy(config))==Convert.ToBase64String(active.Policy);
  var committed=new HashSet<string>(config==null?new string[0]:config.ApprovedExternal,StringComparer.OrdinalIgnoreCase);
  while(cards.Controls.Count>0){var old=cards.Controls[0];cards.Controls.RemoveAt(0);old.Dispose();}
  foreach(ListViewItem item in devices.Items){
   var row=item.Tag as Row;if(row==null)continue;bool builtIn=row.Category=="required_safety_candidate";
   var card=new Panel{Width=Math.Max(450,cards.ClientSize.Width-24),Height=builtIn?78:112,BackColor=Color.FromArgb(25,38,61),Margin=new Padding(0,0,0,10)};
   var name=new Label{Text=item.Text,AutoEllipsis=true,ForeColor=ForeColor,Font=new Font("Segoe UI Semibold",11),Location=new Point(16,12),Size=new Size(card.Width-32,25),Anchor=AnchorStyles.Top|AnchorStyles.Left|AnchorStyles.Right};
   var status=new Label{Text=!row.Present?"Disconnected":UsbAdmissionDeviceActions.Status(builtIn,verifiedRule,committed.Contains(row.Id),verifiedOff),ForeColor=builtIn?Color.LightSteelBlue:verifiedRule&&!committed.Contains(row.Id)?Color.FromArgb(255,195,117):Color.FromArgb(144,199,245),Location=new Point(16,42),Size=new Size(card.Width-32,24),Anchor=AnchorStyles.Top|AnchorStyles.Left|AnchorStyles.Right};card.Controls.Add(name);card.Controls.Add(status);
   if(!builtIn){var block=new Button();var allow=new Button();Style(block,"Block",16,73,95);Style(allow,"Allow",121,73,95);block.Enabled=row.Present&&!busy;allow.Enabled=row.Present&&!busy;block.Click+=async delegate{await ChangeDevice(row.Id,false);};allow.Click+=async delegate{await ChangeDevice(row.Id,true);};card.Controls.Add(block);card.Controls.Add(allow);}
   cards.Controls.Add(card);
  }
 }
 async Task ChangeDevice(string id,bool allow){
  if(busy||inventory==null||!inventory.Complete||staged)return;
  bool found=false;foreach(ListViewItem item in devices.Items){var row=item.Tag as Row;if(row!=null&&row.Id.Equals(id,StringComparison.OrdinalIgnoreCase)&&row.Present&&row.Category=="external_approval_required")found=true;}if(!found)return;
  var selected=new HashSet<string>(UsbAdmissionDeviceActions.Change(new List<string>(SelectedExternal()).ToArray(),id,allow),StringComparer.OrdinalIgnoreCase);
  binding=true;try{foreach(ListViewItem item in devices.Items){var row=item.Tag as Row;if(row!=null&&row.Category!="required_safety_candidate")item.Checked=selected.Contains(row.Id);}}finally{binding=false;}
  message.Text=allow?"Allowing selected device · Windows Hello required…":"Blocking selected device · Windows Hello required…";
  await ApplySelection(allow);
 }
 async Task RefreshView(bool verifyPolicy,bool preserveSelection){
  if(busy||closing)return;SetBusy(true);
  try{
   var view=await Task.Run(()=>{
    if(backend==null)backend=UsbAdmissionWorkerBackend.CreateFromEmbeddedResources();if(stores==null)stores=new UsbAdmissionNativeStores(StateRoot);
    var value=new View{Inventory=UsbAdmissionInventory.Collect(null),Config=stores.ReadCommitted(),Active=stores.Read()};
    using(var pending=new UsbEnrollmentConfig(StateRoot))value.Staged=pending.ReadPending()!=null;
    if(verifyPolicy){if(value.Active==null){backend.DemandEmptyPolicyAndNoUnownedOperations();value.Verified=true;}else if(DateTime.UtcNow<value.Active.DeadlineUtc){backend.VerifyApplied(value.Active);value.Verified=true;}}
    return value;
   });Bind(view,preserveSelection);if(message.Text=="Reading devices and checking Windows…")message.Text="Check devices to allow on connection. Changes require Windows Hello.";
  }catch{inventory=null;verifiedNonce=null;verifiedOff=false;while(cards.Controls.Count>0){var old=cards.Controls[0];cards.Controls.RemoveAt(0);old.Dispose();}summary.Text="Windows input state could not be verified";message.Text="A previous rule or recovery operation needs attention. Release the recorded rule before starting again.";try{if(stores!=null)active=stores.Read();}catch{} }
  finally{SetBusy(false);FinishClose();}
 }
 static byte[] Policy(UsbEnrollmentConfig.Snapshot selected){
  using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){
   var safety=selected.InternalSafety;var external=selected.ApprovedExternal;writer.Write(Encoding.ASCII.GetBytes("SNTINP03"));writer.Write((byte)(safety.Length+external.Length));foreach(var group in new[]{safety,external})foreach(string id in group){byte[] bytes=Encoding.ASCII.GetBytes(id);writer.Write((byte)bytes.Length);writer.Write(bytes);}writer.Flush();return memory.ToArray();
  }
 }
 static string ConfiguredOwner(UsbEnrollmentConfig.Snapshot snapshot){if(snapshot!=null)return snapshot.OwnerSid;using(var identity=WindowsIdentity.GetCurrent())return identity.User.Value;}
 async Task<bool> ReleaseWithHello(bool reconnect=false,string[] reconnectOnly=null){
  recoveryStatus=null;var record=await Task.Run(()=>stores.Read());
  var enrolled=await Task.Run(()=>UsbEnrollmentConfig.ReadCommittedForRecovery(StateRoot));
  UsbAdmissionDeviceRecovery.Plan recovery=null;
  try{
   if(!reconnect)throw new InvalidOperationException("No device restart requested");var fresh=await Task.Run(()=>UsbAdmissionInventory.Collect(null));var requested=new List<string>();
   if(fresh.Complete)requested.AddRange(UsbAdmissionDeviceRecovery.SelectRequested(fresh.Preflight,reconnectOnly));
   if(requested.Count>0&&requested.Count<=8)recovery=UsbAdmissionDeviceRecovery.Prepare(fresh,enrolled==null?new string[0]:enrolled.InternalSafety,requested.ToArray());
  }catch{} // An unavailable restart plan must never prevent policy restoration.
  if(record==null&&recovery==null){await Task.Run(()=>backend.DemandEmptyPolicyAndNoUnownedOperations());recoveryStatus="No active rule. Reconnect the input device to try again.";return true;}
  string digest;using(var sha=SHA256.Create())using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.UTF8)){
   writer.Write("SNT-USB-RELEASE-RECOVER-v2");writer.Write(record!=null);if(record!=null){writer.Write(record.Nonce);writer.Write(record.TopologyHash);writer.Write(record.IssuedUtc.Ticks);writer.Write(record.DeadlineUtc.Ticks);writer.Write(record.Policy);}
   writer.Write(recovery!=null);if(recovery!=null){writer.Write(recovery.Topology);writer.Write(recovery.Instances.Length);foreach(string id in recovery.Instances)writer.Write(id);writer.Write(recovery.Safety.Length);foreach(string id in recovery.Safety)writer.Write(id);}writer.Flush();digest=BitConverter.ToString(sha.ComputeHash(memory.ToArray())).Replace("-","").ToLowerInvariant();
  }
  var binding=new UsbAdmissionAuthorization.Request(ConfiguredOwner(enrolled),enrolled==null?0:enrolled.Generation,record==null?(recovery==null?new string('0',64):recovery.Topology):record.TopologyHash,"release",digest);
  message.Text=recovery==null?"Verify Windows Hello to release the input rule.":"Verify Windows Hello to release the rule and reconnect "+recovery.Instances.Length+" external input interfaces.";
  if(tabIntentSummary!=null)summary.Text=tabIntentSummary+". First release the current restrictions.";
  var proof=await UsbAdmissionAuthorization.Verify(Handle,binding);if(proof==null){message.Text="Windows Hello did not approve this change.";return false;}proof.Consume(binding);
  message.Text="Removing the Windows input rule and verifying recovery…";
  await Task.Run(()=>{
   var current=stores.Read();var currentConfig=UsbEnrollmentConfig.ReadCommittedForRecovery(StateRoot);if((currentConfig==null?0:currentConfig.Generation)!=(enrolled==null?0:enrolled.Generation)||ConfiguredOwner(currentConfig)!=ConfiguredOwner(enrolled))throw new InvalidOperationException("Protected enrollment changed.");
   if(current!=null&&(record==null||current.Nonce!=record.Nonce||current.TopologyHash!=record.TopologyHash||current.IssuedUtc!=record.IssuedUtc||current.DeadlineUtc!=record.DeadlineUtc||Convert.ToBase64String(current.Policy)!=Convert.ToBase64String(record.Policy)))throw new InvalidOperationException("Protected operation changed.");
   new UsbAdmissionTransaction(stores,stores,backend,new RecoveryAuthority(),new NativeClock()).Recover();
  });verifiedNonce=null;active=null;summary.Text="USB Guard is off · Windows rule removed";
  if(recovery==null){recoveryStatus="Rule removed. Reconnect your input devices; their input has not been verified.";return true;}
  message.Text="Reconnecting external input drivers. Built-in controls are excluded…";
  var result=await Task.Run(()=>UsbAdmissionDeviceRecovery.Execute(recovery,()=>{if(stores.Read()!=null)return false;backend.DemandEmptyPolicyAndNoUnownedOperations();return true;}));
  bool completed=Array.TrueForAll(result.Outcomes,value=>value=="restart_completed_input_unverified");bool reboot=Array.Exists(result.Outcomes,value=>value=="restart_requires_windows_restart");
  recoveryStatus=completed?"Rule removed. Windows restarted the selected input interfaces. Test the keyboard and reconnect the Ducky.":reboot?"Rule removed. Windows requires a restart to finish reconnecting an input device.":"Rule removed. Windows could not reconnect every input interface. Reconnect the device; a Windows restart may be needed.";
  return true;
 }
 async Task ManualRelease(){if(busy||stores==null)return;SetBusy(true);try{if(await ReleaseWithHello()){active=null;message.Text=recoveryStatus??"Windows rule removed. Test your input devices.";}}catch{message.Text="Release could not be verified. Recovery information has been retained.";}finally{SetBusy(false);FinishClose();}if(!closing)await RefreshView(true,false);}
 async Task ApplySelection(bool reconnect=false){
  if(!DeviceScopeQualified){message.Text="Device blocking is paused while isolation is repaired. No input rule was applied.";return;}
  if(busy||stores==null)return;var selected=SelectedExternal();SetBusy(true);bool released=false;
  try{
   // Every active-rule edit is a visible release followed by a new owner proof
   // and new lease. It is never an in-place approval update or silent renewal.
   if(reconnect||await Task.Run(()=>stores.Read())!=null){if(!await ReleaseWithHello(reconnect))return;released=true;active=null;}
   var fresh=await Task.Run(()=>UsbAdmissionInventory.Collect(null));if(!fresh.Complete||fresh.Preflight==null||fresh.Preflight.State!="review_required")throw new InvalidOperationException("Fresh native inventory required.");
   var current=await Task.Run(()=>stores.ReadCommitted());var safety=new List<string>();var present=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(var item in fresh.Preflight.Candidates){present.Add(item.Instance);if(item.Category=="required_safety_candidate")safety.Add(item.Instance);else if(item.Category!="external_approval_required")throw new InvalidOperationException("Unresolved device.");}
   foreach(string id in selected)if(!present.Contains(id))throw new InvalidOperationException("Reconnect selected device.");
   safety.Sort(StringComparer.Ordinal);var approved=new List<string>(selected);approved.Sort(StringComparer.Ordinal);
   var candidate=new UsbEnrollmentConfig.Snapshot(checked((current==null?0:current.Generation)+1),ConfiguredOwner(current),safety.ToArray(),approved.ToArray());
   DateTime issued=DateTime.UtcNow,deadline=issued.AddMinutes(5);var earlier=backend.OutstandingRecoveryDeadlineUtc;if(earlier.HasValue&&earlier.Value<deadline)deadline=earlier.Value;
   var request=new UsbAdmissionTransaction.Request(current==null?0:current.Generation,candidate,fresh.Preflight.TopologyToken,Guid.NewGuid().ToString("N"),issued,deadline,Policy(candidate));
   message.Text="Verify Windows Hello to apply your device selection.";if(tabIntentSummary!=null)summary.Text=tabIntentSummary+". Reapply protection with "+approved.Count+" allowed input interfaces.";var authority=await UsbAdmissionNativeAuthority.Verify(Handle,request);if(authority==null){message.Text=released?"Previous rule released. New changes were not approved.":"Windows Hello did not approve this change.";return;}
   message.Text="Applying your selection in Windows. Keep devices connected…";
   await Task.Run(()=>new UsbAdmissionTransaction(stores,stores,backend,authority,new NativeClock()).ApplyInitial(request));
   active=request.JournalRecord();verifiedNonce=active.Nonce;verifiedAt=DateTime.UtcNow;message.Text="Windows input rule applied. New unapproved USB inputs are restricted until automatic release."+(reconnect?" "+(recoveryStatus??"Input restoration still needs testing."):"");
  }catch{message.Text="The rule could not be verified. Reconnect selected devices and refresh; any recovery information is retained.";}
  finally{SetBusy(false);FinishClose();}
  if(!closing)await RefreshView(true,false);
 }
 void FinishClose(){if(closing&&!busy&&!UsbOwnerVerification.HasPending){finished=true;Close();}}
 protected override void Dispose(bool disposing){if(disposing){tabCancellation.Cancel();tabCancellation.Dispose();poll.Dispose();ownerPoll.Dispose();if(consoleOwner!=null)consoleOwner.Dispose();if(stores!=null)stores.Dispose();if(backend!=null)backend.Dispose();for(int i=pins.Count-1;i>=0;i--)pins[i].Dispose();}base.Dispose(disposing);}
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544"||sid=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";}
 static List<IDisposable> PinAncestry(){var held=new List<IDisposable>();try{
  var paths=new List<string>();for(var cursor=new DirectoryInfo(StateRoot);cursor!=null;cursor=cursor.Parent)paths.Insert(0,cursor.FullName);
  foreach(string path in paths){held.Add(new SentinelPolicyDirectory(path));var acl=Directory.GetAccessControl(path);if(!Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value))throw new InvalidOperationException();if(path==StateRoot&&!acl.AreAccessRulesProtected)throw new InvalidOperationException();foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow||Trusted(rule.IdentityReference.Value)||(rule.PropagationFlags&PropagationFlags.InheritOnly)!=0)continue;if(path==StateRoot||(rule.FileSystemRights&(FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership|FileSystemRights.Delete))!=0)throw new InvalidOperationException();}}
  return held;
 }catch{for(int i=held.Count-1;i>=0;i--)held[i].Dispose();throw;}}
 [STAThread]static int Main(string[] args){
  string pipeName=null;if(args.Length==5){if(!System.Text.RegularExpressions.Regex.IsMatch(args[4],"^sentinel-usb-tab-[a-f0-9]{32}$"))return 2;pipeName=args[4];Array.Resize(ref args,4);}if(args.Length!=0&&args.Length!=4)return 2;UsbAdmissionConsoleOwner owner=null;if(args.Length!=0)try{owner=UsbAdmissionConsoleOwner.Open(args);}catch{return 2;}using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  if(!string.Equals(Assembly.GetExecutingAssembly().Location,Path.Combine(CodeRoot,"Sentinel.UsbGuard.exe"),StringComparison.OrdinalIgnoreCase))return 4;
  bool created;using(var singleton=new Mutex(true,@"Global\SentinelUsbAdmissionOperator",out created)){if(!created)return 5;
   try{Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);using(var window=new UsbAdmissionWindow(PinAncestry(),owner,pipeName))Application.Run(window);return 0;}
   catch{MessageBox.Show("USB Guard could not open its protected settings.","Sentinel",MessageBoxButtons.OK,MessageBoxIcon.Warning);return 1;}
   finally{singleton.ReleaseMutex();}
  }
 }
}
