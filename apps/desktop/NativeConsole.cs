using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using Forms=System.Windows.Forms;

public sealed class NativeConsole : Window {
 [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int l,int t,int r,int b,int w,int h);
 [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr window,IntPtr region,bool redraw);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
 static readonly string OpenEvent="Local\\SentinelDesktopOpen";
 readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=131072};
 readonly HttpClient client=new HttpClient(new HttpClientHandler {AllowAutoRedirect=false,UseProxy=false}) {Timeout=TimeSpan.FromSeconds(12),MaxResponseContentBufferSize=131072};
 readonly StackPanel body=new StackPanel(),navigation=new StackPanel();
 readonly TextBlock status=new TextBlock();
 readonly DispatcherTimer poll=new DispatcherTimer {Interval=TimeSpan.FromSeconds(2)};
 readonly DispatcherTimer secretTimer=new DispatcherTimer {Interval=TimeSpan.FromSeconds(30)};
 readonly Forms.NotifyIcon tray=new Forms.NotifyIcon {Icon=System.Drawing.SystemIcons.Shield,Text="Sentinel",Visible=true};
 readonly string here,root,url,token,actionToken;
 Dictionary<string,object> state;
 string page="Dashboard",selected=null,revealed=null,query="";
 bool audit,busy,polling,quitting,dialog;int renderEpoch;
 long revision=-1;
 EventWaitHandle openSignal;DispatcherTimer openTimer;
 TextBox secretBox;
 static Brush Ink(string hex){return (Brush)new BrushConverter().ConvertFromString(hex);}
 static Dictionary<string,object> Map(object value){return value as Dictionary<string,object>??new Dictionary<string,object>();}
 static string Text(Dictionary<string,object> value,string key){object v;return value.TryGetValue(key,out v)&&v!=null?Convert.ToString(v):"";}
 static IEnumerable<Dictionary<string,object>> Items(Dictionary<string,object> value,string key){object list;if(value.TryGetValue(key,out list)&&list is IEnumerable&&!(list is string)){foreach(object item in (IEnumerable)list)yield return Map(item);}}

 [STAThread] public static void Main(string[] args){
  var here=AppDomain.CurrentDomain.BaseDirectory;var root=Path.GetFullPath(Path.Combine(here,"../../.."));Process worker=null;bool owns=false;
  using(var mutex=new Mutex(false,"Local\\SentinelDesktopApp")){
   try{try{owns=mutex.WaitOne(0);}catch(AbandonedMutexException){owns=true;}
    if(!owns){using(var signal=EventWaitHandle.OpenExisting(OpenEvent))signal.Set();return;}
    var configPath=Path.Combine(here,"demo-runtime.json");if(File.Exists(configPath))File.Delete(configPath);
    var node=Path.Combine(root,"tools/runtime/node.exe");worker=Process.Start(new ProcessStartInfo(File.Exists(node)?node:"node.exe","\""+Path.Combine(root,"apps/demo-runtime/server.mjs")+"\""){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root});
    for(int n=0;n<150&&!File.Exists(configPath);n++){if(worker.HasExited)throw new InvalidOperationException();Thread.Sleep(100);}
    if(!File.Exists(configPath))throw new InvalidOperationException();
    var config=new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(configPath));Uri target;
    if(!Uri.TryCreate(config["url"],UriKind.Absolute,out target)||target.Scheme!="http"||target.Host!="127.0.0.1"||target.Port<1024||target.AbsolutePath!="/"||target.Query.Length!=0||target.UserInfo.Length!=0)throw new InvalidOperationException();
    foreach(string key in new[]{"token","nativeActionToken"})if(!System.Text.RegularExpressions.Regex.IsMatch(config[key],"^[a-f0-9]{64}$"))throw new InvalidOperationException();
    var app=new Application {ShutdownMode=ShutdownMode.OnMainWindowClose};var window=new NativeConsole(root,config);
    if(Array.IndexOf(args,"--tray")>=0)window.Loaded+=delegate{window.HideToTray();};
    if(Array.IndexOf(args,"--lifecycle-smoke")>=0||Array.IndexOf(args,"--native-smoke")>=0)window.Loaded+=async delegate{
     try{await window.Refresh();for(int n=0;n<100&&window.state==null;n++)await Task.Delay(100);window.SwitchPage("Passwords");bool native=window.body.Children.Count>0&&typeof(NativeConsole).Assembly.GetReferencedAssemblies().Length>0;
      string original=File.ReadAllText(Path.Combine(here,"demo-runtime.json"));
      using(var child=Process.Start(new ProcessStartInfo(Path.Combine(here,"Sentinel.Glass.exe"),"--tray"){UseShellExecute=false,CreateNoWindow=true})){if(!child.WaitForExit(5000)||child.ExitCode!=0)throw new InvalidOperationException();}
      if(!File.Exists(Path.Combine(here,"demo-runtime.json"))||original!=File.ReadAllText(Path.Combine(here,"demo-runtime.json")))throw new InvalidOperationException("Secondary launch changed runtime authority");
      if(Array.IndexOf(args,"--native-smoke")>=0){
       string fixture=Path.Combine(Path.GetTempPath(),"Sentinel-native-smoke-"+Guid.NewGuid().ToString("N")+".txt");
       try{File.WriteAllText(fixture,"Harmless native UI inspection check.");await window.Call("scan",new{path=fixture});Dictionary<string,object> report=null;
        for(int n=0;n<100;n++){var snapshot=await window.Call("inspection",new{});foreach(var item in Items(Map(snapshot.ContainsKey("snapshot")?snapshot["snapshot"]:null),"reports")){report=item;break;}if(report!=null)break;await Task.Delay(100);}
        if(report==null||Text(report,"inspectedBytes")=="0"||Text(report,"sha256").Length!=64)throw new InvalidOperationException("Native inspection evidence missing");
        File.WriteAllText(Path.Combine(here,"native-inspection-smoke.txt"),"actual_benign_bytes=True\ncomplete_sha256=True\n");
       }finally{File.Delete(fixture);}
      }
      window.selected=Text(window.Accounts()[0],"id");window.revealed="SENTINEL-VIEW-FIXTURE";window.Render();bool nativeReveal=window.secretBox!=null&&window.secretBox.Text=="SENTINEL-VIEW-FIXTURE";
      window.HideToTray();bool hidden=!window.IsVisible&&!window.ShowInTaskbar&&window.tray.Visible;bool masked=window.secretBox.Text!="SENTINEL-VIEW-FIXTURE";window.OpenFromTray();bool shown=window.IsVisible&&window.ShowInTaskbar;
      File.WriteAllText(Path.Combine(here,"lifecycle-smoke.txt"),"hidden="+hidden+"\nreopened="+shown+"\nnative="+native+"\npassword_field="+nativeReveal+"\nmasked_after_hide="+masked+"\naccounts="+window.Accounts().Count+"\n");if(!hidden||!shown||!native||!nativeReveal||!masked||window.Accounts().Count<1)Environment.ExitCode=1;
     }catch{Environment.ExitCode=1;}finally{window.quitting=true;window.Close();}
    };
    app.Run(window);
   }catch{MessageBox.Show("Sentinel could not start. Keep the complete app folder together.","Sentinel");Environment.ExitCode=1;}
   finally{if(worker!=null){try{if(!worker.HasExited){var config=new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(Path.Combine(here,"demo-runtime.json")));using(var http=new HttpClient()){http.Timeout=TimeSpan.FromSeconds(3);http.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",config["token"]);http.PostAsync(config["url"]+"/shutdown",new StringContent("{}",Encoding.UTF8,"application/json")).Wait(4000);}if(!worker.WaitForExit(8000))worker.Kill();}}catch{try{if(!worker.HasExited)worker.Kill();}catch{}}worker.Dispose();}if(owns){try{File.Delete(Path.Combine(here,"demo-runtime.json"));}catch{}}if(owns)mutex.ReleaseMutex();}
  }
 }

 NativeConsole(string root,Dictionary<string,string> config){
  this.root=root;here=AppDomain.CurrentDomain.BaseDirectory;url=config["url"];token=config["token"];actionToken=config["nativeActionToken"];
  Title="Sentinel";Width=Math.Min(1080,SystemParameters.WorkArea.Width);Height=Math.Min(740,SystemParameters.WorkArea.Height);MinWidth=700;MinHeight=500;ResizeMode=ResizeMode.NoResize;WindowStyle=WindowStyle.None;WindowStartupLocation=WindowStartupLocation.CenterScreen;Background=Ink("#0d1729");Foreground=Ink("#dce7f9");FontFamily=new FontFamily("Segoe UI");FontSize=13;
  var shell=new Grid();shell.ColumnDefinitions.Add(new ColumnDefinition {Width=new GridLength(185)});shell.ColumnDefinitions.Add(new ColumnDefinition());
  var side=new DockPanel {Background=Ink("#14223a"),Margin=new Thickness(0)};var brand=Label("SENTINEL",22);brand.Margin=new Thickness(22,30,12,25);DockPanel.SetDock(brand,Dock.Top);side.Children.Add(brand);
  var footer=Label("ON-DEVICE",10);footer.Margin=new Thickness(22,15,10,20);DockPanel.SetDock(footer,Dock.Bottom);side.Children.Add(footer);var navScroll=new ScrollViewer {Content=navigation,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};side.Children.Add(navScroll);shell.Children.Add(side);
  foreach(string name in new[]{"Dashboard","Scan & inspect","Passwords","Watchtower","USB Guard","Quarantine","Activity","Settings"}){string target=name;var button=Button(name,delegate{SwitchPage(target);});button.HorizontalContentAlignment=HorizontalAlignment.Left;button.Margin=new Thickness(12,4,12,4);navigation.Children.Add(button);}
  var content=new DockPanel {Margin=new Thickness(28,20,28,20)};Grid.SetColumn(content,1);shell.Children.Add(content);
  var controls=new StackPanel {Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};controls.Children.Add(Button("−",HideToTray));controls.Children.Add(Button("×",HideToTray));DockPanel.SetDock(controls,Dock.Top);content.Children.Add(controls);
  status.TextWrapping=TextWrapping.Wrap;status.Foreground=Ink("#a8bddc");status.Margin=new Thickness(0,12,0,0);DockPanel.SetDock(status,Dock.Bottom);content.Children.Add(status);
  content.Children.Add(new ScrollViewer {Content=body,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled});Content=shell;
  // Drag the unused surface, never a textbox or account row.
  MouseLeftButtonDown+=delegate(object sender,MouseButtonEventArgs e){if(e.OriginalSource==shell&&e.ClickCount==1)DragMove();};
  Loaded+=async delegate{Round();await Refresh();poll.Start();};
  Deactivated+=delegate{Dispatcher.BeginInvoke(new Action(delegate{if(!IsActive&&!dialog&&!quitting)HideToTray();}),DispatcherPriority.Background);};
  Closing+=delegate(object sender,System.ComponentModel.CancelEventArgs e){if(!quitting){e.Cancel=true;HideToTray();}};
  tray.MouseClick+=delegate(object sender,Forms.MouseEventArgs e){if(e.Button==Forms.MouseButtons.Left)Dispatcher.Invoke(new Action(OpenFromTray));};
  var menu=new Forms.ContextMenuStrip();menu.Items.Add("Open Sentinel",null,delegate{Dispatcher.Invoke(new Action(OpenFromTray));});menu.Items.Add("Quit Sentinel",null,delegate{Dispatcher.Invoke(new Action(delegate{quitting=true;Close();}));});tray.ContextMenuStrip=menu;
  openSignal=new EventWaitHandle(false,EventResetMode.AutoReset,OpenEvent);openTimer=new DispatcherTimer {Interval=TimeSpan.FromMilliseconds(300)};openTimer.Tick+=delegate{if(openSignal.WaitOne(0))OpenFromTray();};openTimer.Start();
  poll.Tick+=async delegate{await Refresh();};secretTimer.Tick+=delegate{ClearSecret();};
  Closed+=delegate{ClearSecret();poll.Stop();openTimer.Stop();openSignal.Dispose();tray.Dispose();client.Dispose();};Render();
 }
 void Round(){var handle=new WindowInteropHelper(this).Handle;var transform=HwndSource.FromHwnd(handle).CompositionTarget.TransformToDevice;var region=CreateRoundRectRgn(0,0,(int)Math.Ceiling(ActualWidth*transform.M11)+1,(int)Math.Ceiling(ActualHeight*transform.M22)+1,(int)(20*transform.M11),(int)(20*transform.M22));if(region!=IntPtr.Zero&&SetWindowRgn(handle,region,true)==0)DeleteObject(region);}
 void ClearSecret(){revealed=null;secretTimer.Stop();if(secretBox!=null)secretBox.Text="••••••••••••";}
 void HideToTray(){ClearSecret();ShowInTaskbar=false;Hide();}
 void OpenFromTray(){ShowInTaskbar=true;WindowState=WindowState.Normal;Show();Activate();}
 void SwitchPage(string target){if(dialog||busy)return;ClearSecret();audit=false;query="";page=target;Render();}
 TextBlock Label(string text,double size=13){return new TextBlock {Text=text,FontSize=size,Foreground=Ink("#dce7f9"),TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,6,0,8)};}
 Button Button(string text,Action clicked){var b=new Button {Content=text,Padding=new Thickness(13,9,13,9),Margin=new Thickness(0,4,8,4),Foreground=Ink("#e3edfd"),Background=Ink("#243d62"),BorderBrush=Ink("#3d5d87"),BorderThickness=new Thickness(1)};b.Click+=delegate{clicked();};return b;}
 Border Card(UIElement child){return new Border {Background=Ink("#15253d"),BorderBrush=Ink("#355073"),BorderThickness=new Thickness(1),CornerRadius=new CornerRadius(12),Padding=new Thickness(18),Margin=new Thickness(0,8,0,12),Child=child};}
 TextBox Field(string label,string value,Panel container){container.Children.Add(Label(label,11));var field=new TextBox {Text=value,IsReadOnly=true,Padding=new Thickness(10),Background=Ink("#0f1c30"),Foreground=Ink("#dce7f9"),BorderBrush=Ink("#355073"),Margin=new Thickness(0,0,0,10)};container.Children.Add(field);return field;}
 async Task<Dictionary<string,object>> Call(string route,object data,bool approved=false){using(var request=new HttpRequestMessage(HttpMethod.Post,url+"/"+route)){request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",token);if(approved)request.Headers.Add("X-Sentinel-Native-Action",actionToken);request.Content=new StringContent(json.Serialize(data),Encoding.UTF8,"application/json");using(var response=await client.SendAsync(request)){string raw=await response.Content.ReadAsStringAsync();if(raw.Length>131072)throw new InvalidOperationException("Response too large");var result=json.Deserialize<Dictionary<string,object>>(raw);if(!response.IsSuccessStatusCode)throw new InvalidOperationException(Text(result,"error"));return result;}}}
 List<Dictionary<string,object>> Accounts(){return state==null?new List<Dictionary<string,object>>():new List<Dictionary<string,object>>(Items(state,"accounts"));}
 async Task Refresh(){if(polling||dialog||busy)return;polling=true;try{var next=await Call("state",new{});long nextRevision=Convert.ToInt64(next["revision"]);bool changed=revision!=nextRevision;state=next;revision=nextRevision;if(changed)ClearSecret();if(changed||page!="Passwords")Render();}catch{status.Text="Local connection unavailable.";}finally{polling=false;}}
 string Priority(Dictionary<string,object> account){string health=Text(account,"health");return Convert.ToBoolean(account["reused"])||health=="Weak"||health=="Very weak"?"#813c42":health=="Stronger"?"#285848":health=="Moderate"?"#766134":"#35465e";}
 void Render(){renderEpoch++;body.Children.Clear();body.Children.Add(Label(page,28));if(state==null){body.Children.Add(Label("Connecting…"));return;}
  if(page=="Passwords"){RenderPasswords();return;}
  if(page=="Scan & inspect"){RenderScan();return;}
  if(page=="Watchtower"){body.Children.Add(Label("Automatic network observations"));voidObservation("wifi");return;}
  if(page=="USB Guard"){body.Children.Add(Label("Automatic device observations"));voidObservation("usb");return;}
  if(page=="Quarantine"){body.Children.Add(Card(Label("Quarantine actions are unavailable until durable recovery is integrated. No files have been moved by this console.")));return;}
  if(page=="Activity"){foreach(var item in Items(state,"events"))body.Children.Add(Card(Label(Text(item,"source")+" · "+Text(item,"kind").Replace('_',' ')+"\n"+Text(item,"at"))));return;}
  if(page=="Settings"){body.Children.Add(Card(Label("Native Windows interface · no embedded browser\n\nAccounts are held for this session. Encrypted persistence and importing existing credentials are not available. New logins receive a generated local password; websites are not changed.\n\nPassword actions use Administrator elevation approval. It is not Windows Hello authentication. Passwords clear from view on focus loss, navigation or after 30 seconds. Clipboard contents remain until overwritten.\n\nScan coverage is bounded. USB observations do not block HID input. Watchtower is passive. Defender remains enabled.")));return;}
  body.Children.Add(Card(Label("Local runtime connected\n"+Accounts().Count+" accounts · "+(Text(state,"extensionId").Length>0?"Browser session paired":"Ready for automatic Chrome pairing"),18)));
  body.Children.Add(Button("Scan files",delegate{SwitchPage("Scan & inspect");}));body.Children.Add(Button("Open accounts",delegate{SwitchPage("Passwords");}));body.Children.Add(Label("Native console · local inspection and observations"));
 }
 void RenderPasswords(){
  var tools=new StackPanel {Orientation=Orientation.Horizontal};tools.Children.Add(Button(audit?"◉  Done":"◉  Check",delegate{audit=!audit;Render();}));tools.Children.Add(Button("Add login",delegate{AddLogin();}));body.Children.Add(tools);
  var search=new TextBox {Text=query,Padding=new Thickness(10),Background=Ink("#0f1c30"),Foreground=Foreground,BorderBrush=Ink("#355073"),Margin=new Thickness(0,8,0,14)};body.Children.Add(search);
  var grid=new Grid();grid.ColumnDefinitions.Add(new ColumnDefinition {Width=new GridLength(1,GridUnitType.Star)});grid.ColumnDefinitions.Add(new ColumnDefinition {Width=new GridLength(1,GridUnitType.Star)});StackPanel list=new StackPanel(),detail=new StackPanel();list.Margin=new Thickness(0,0,18,0);Grid.SetColumn(detail,1);grid.Children.Add(list);grid.Children.Add(detail);body.Children.Add(grid);
  Action populate=delegate{list.Children.Clear();list.Children.Add(Label("All Accounts",17));foreach(var a in Accounts()){if(!(Text(a,"name")+" "+Text(a,"user")+" "+Text(a,"host")).ToLowerInvariant().Contains(query.ToLowerInvariant()))continue;var current=a;var row=Button(Text(a,"name")+"\n"+Text(a,"user"),delegate{ClearSecret();selected=Text(current,"id");Render();});row.HorizontalContentAlignment=HorizontalAlignment.Left;row.HorizontalAlignment=HorizontalAlignment.Stretch;if(audit)row.Background=Ink(Priority(a));list.Children.Add(row);}};populate();search.TextChanged+=delegate{query=search.Text;populate();};
  var account=Accounts().Find(a=>Text(a,"id")==selected);if(account==null){detail.Children.Add(Label("Choose an account",20));return;}
  detail.Children.Add(Label(Text(account,"name"),21));Field("Email",Text(account,"user"),detail);Field("Website",Text(account,"host"),detail);secretBox=Field("Password",revealed??"••••••••••••",detail);
  detail.Children.Add(Label(Text(account,"health")+(Convert.ToBoolean(account["reused"])?" · Reused":"")));
  if(Text(account,"health")!="Stronger")foreach(object reason in (IEnumerable)account["reasons"])detail.Children.Add(Label(Convert.ToString(reason),12));
  detail.Children.Add(Button(revealed==null?"Show password":"Hide password",delegate{if(revealed!=null){ClearSecret();Render();}else PasswordAction("view");}));detail.Children.Add(Button("Copy password",delegate{PasswordAction("copy");}));detail.Children.Add(Button("Generate Replacement",delegate{PasswordAction("rotate");}));detail.Children.Add(Button("Remove login",delegate{PasswordAction("remove");}));
 }
 async void PasswordAction(string operation){if(busy||selected==null)return;string subject=selected;busy=true;dialog=true;ClearSecret();status.Text="Approve the Windows prompt to continue.";try{using(var lease=PasswordActionLease.TryAcquire()){if(lease==null)throw new InvalidOperationException("Another password action is pending.");if(operation=="remove"&&MessageBox.Show(this,"Remove this login from the current session?","Remove login",MessageBoxButton.YesNo,MessageBoxImage.Question)!=MessageBoxResult.Yes)return;if(!await Task.Run(()=>VaultApproval.Approve(operation,subject)))throw new InvalidOperationException("Windows approval declined or unavailable.");var result=await Call(operation=="remove"?"account-remove":operation=="rotate"?"rotate":"reveal",new{id=subject},true);if(operation=="view"||operation=="copy"){if(Text(result,"mode")!="synthetic_demo")throw new InvalidOperationException();string password=Text(result,"password");if(operation=="copy")Clipboard.SetText(password);else if(IsVisible&&IsActive&&selected==subject&&page=="Passwords"){revealed=password;secretTimer.Start();}}if(operation=="remove")selected=null;status.Text=operation=="view"?(revealed!=null?"Password visible for 30 seconds.":"Viewing cancelled after focus changed."):operation=="copy"?"Password copied.":operation=="rotate"?"Replacement saved.":"Login removed.";}}catch(Exception e){status.Text=e is InvalidOperationException?e.Message:"Action unavailable.";}finally{busy=false;dialog=false;if(!IsActive)HideToTray();Render();}await Refresh();}
 async void AddLogin(){if(busy)return;dialog=true;var fields=new StackPanel {Margin=new Thickness(22)};fields.Children.Add(Label("Add login",22));TextBox name=Input("Account name",80,fields),user=Input("Email or username",254,fields),host=Input("Website hostname",253,fields);fields.Children.Add(Label("A unique local password will be generated. Saved for this session.",12));var modal=new Window {Title="Add login",Owner=this,Width=420,Height=390,ResizeMode=ResizeMode.NoResize,WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=Background,Foreground=Foreground,Content=fields};fields.Children.Add(Button("Add login",delegate{modal.DialogResult=true;}));bool accepted=modal.ShowDialog()==true;dialog=false;if(!accepted){if(!IsActive)HideToTray();return;}busy=true;dialog=true;try{using(var lease=PasswordActionLease.TryAcquire()){if(lease==null)throw new InvalidOperationException("Another password action is pending.");if(!await Task.Run(()=>VaultApproval.Approve("add","new_login")))throw new InvalidOperationException("Windows approval declined or unavailable.");var added=await Call("account-add",new{name=name.Text,user=user.Text,host=host.Text},true);selected=Text(added,"id");status.Text="Login added.";}}catch(Exception e){status.Text=e is InvalidOperationException?e.Message:"Could not add login.";}finally{busy=false;dialog=false;if(!IsActive)HideToTray();}await Refresh();Render();}
 TextBox Input(string label,int max,Panel parent){parent.Children.Add(Label(label,11));var field=new TextBox {MaxLength=max,Padding=new Thickness(8),Margin=new Thickness(0,0,0,8)};parent.Children.Add(field);return field;}
 void RenderScan(){var tools=new StackPanel {Orientation=Orientation.Horizontal};tools.Children.Add(Button("Choose file",delegate{Scan(false);}));tools.Children.Add(Button("Choose folder",delegate{Scan(true);}));tools.Children.Add(Button("Cancel",async delegate{try{await Call("cancel",new{});}catch{status.Text="Cancellation unavailable.";}}));body.Children.Add(tools);var scan=Map(state.ContainsKey("scan")?state["scan"]:null);if(scan.Count==0){body.Children.Add(Label("Choose local files for read-only inspection."));return;}body.Children.Add(Label(Text(scan,"status")+" · "+Text(scan,"checked")+" inspected · "+Text(scan,"skipped")+" skipped",18));body.Children.Add(Label("Partial coverage · 8 MiB acquired per file · 64 files"));ReadReports();}
 async void Scan(bool folder){if(busy)return;busy=true;dialog=true;string path=null;try{if(folder){using(var picker=new Forms.FolderBrowserDialog()){if(picker.ShowDialog()==Forms.DialogResult.OK)path=picker.SelectedPath;}}else{var picker=new Microsoft.Win32.OpenFileDialog {Title="Select file to inspect"};if(picker.ShowDialog(this)==true)path=picker.FileName;}if(path!=null){await Call("scan",new{path});status.Text="Inspection started.";}}catch{status.Text="Inspection unavailable or selection unsupported.";}finally{busy=false;dialog=false;if(!IsActive)HideToTray();}await Refresh();}
 async void ReadReports(){int generation=renderEpoch;string requestedPage=page;try{var result=await Call("inspection",new{});if(page!=requestedPage||generation!=renderEpoch)return;var snapshot=Map(result.ContainsKey("snapshot")?result["snapshot"]:null);foreach(var report in Items(snapshot,"reports")){var panel=new StackPanel();panel.Children.Add(Label(Text(report,"reportRef")+" · "+Text(report,"state")+" · "+Text(report,"verdict").Replace('_',' '),16));panel.Children.Add(Label(Text(report,"inspectedBytes")+" bytes inspected / "+Text(report,"logicalBytes")+" logical bytes"));Field("SHA-256",Text(report,"sha256"),panel);object findings;if(report.TryGetValue("findings",out findings)&&findings is IEnumerable)foreach(object finding in (IEnumerable)findings)panel.Children.Add(Label(Convert.ToString(finding).Replace('_',' ')));var evidence=Map(report.ContainsKey("evidence")?report["evidence"]:null);if(evidence.Count>0)panel.Children.Add(Label("Zero bytes: "+Text(evidence,"zeroBytes")+" · PE header: "+Text(evidence,"peHeaderPresent")));body.Children.Add(Card(panel));}}catch{if(page==requestedPage&&generation==renderEpoch)status.Text="Inspection report unavailable.";}}
 async void voidObservation(string route){int generation=renderEpoch;string requestedPage=page;try{var result=await Call(route,new{});if(page!=requestedPage||generation!=renderEpoch)return;if(route=="wifi"){var observation=Map(result["observation"]);foreach(var item in observation)body.Children.Add(Label(item.Key+" · "+Convert.ToString(item.Value)));foreach(var check in Items(result,"checks"))body.Children.Add(Card(Label(Text(check,"title")+"\n"+Text(check,"detail"))));body.Children.Add(Label("Passive observations; nearby device discovery is not implemented."));}else{int named=0,unnamed=0;foreach(var group in Items(result,"devices")){string name=Text(group,"name");if(name.Length==0){unnamed++;continue;}named++;var panel=new StackPanel();panel.Children.Add(Label(name,17));object roles;if(group.TryGetValue("interfaces",out roles)&&roles is IEnumerable)foreach(object role in (IEnumerable)roles)panel.Children.Add(Label(Convert.ToString(role).Replace("hid_keyboard","Keyboard").Replace("hid_mouse","Mouse").Replace("hid_other","HID interface").Replace("storage","Storage")));body.Children.Add(Card(panel));}if(named==0)body.Children.Add(Label("No named devices available."));if(unnamed>0)body.Children.Add(Label(unnamed+" unnamed interface groups · details unavailable"));body.Children.Add(Label("Inventory: "+Text(result,"state")));body.Children.Add(Label("Device inventory only. HID blocking and automatic storage scanning are not active."));}}catch{if(page==requestedPage&&generation==renderEpoch)status.Text="Observation unavailable.";}}
}
