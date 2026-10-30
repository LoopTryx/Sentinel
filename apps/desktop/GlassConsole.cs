using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shell;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Net.Http;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

public sealed class SentinelGlassConsole : Window
{
    [StructLayout(LayoutKind.Sequential)]
    struct Margins { public int Left, Right, Top, Bottom; }
    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    [DllImport("dwmapi.dll")]
    static extern int DwmExtendFrameIntoClientArea(IntPtr window, ref Margins margins);
    [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int left,int top,int right,int bottom,int width,int height);
    [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr window,IntPtr region,bool redraw);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);

    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);
    bool dragging, nativeCorners;
    readonly UsbInputMonitor inputMonitor=new UsbInputMonitor();
    readonly SentinelAiNative sentinelAi=new SentinelAiNative();
    UsbGuardArrival usbArrival;
    NativeProtectionCoordinator security;
    readonly WebView2 view = new WebView2();
    readonly StackPanel loadingSurface=new StackPanel { HorizontalAlignment=HorizontalAlignment.Center, VerticalAlignment=VerticalAlignment.Center };
    readonly string assets, evidence;
    readonly bool smoke;
    readonly DispatcherTimer deadline = new DispatcherTimer();
    bool backdrop;
    bool closing;
    readonly bool demo;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 2200000, RecursionLimit = 16 };
    readonly HttpClient runtimeClient = new HttpClient { Timeout = TimeSpan.FromSeconds(12), MaxResponseContentBufferSize = 131072 };
    readonly HttpClient localAiClient = new HttpClient { Timeout = TimeSpan.FromSeconds(65), MaxResponseContentBufferSize = 8192 };
    string runtimeUrl, runtimeToken, runtimeActionToken;
    bool actionDialog;
    bool selectionRequest;
    readonly NativeSelectionBinding nativeSelection = new NativeSelectionBinding();
    readonly Dictionary<string, string> quarantinedPaths = new Dictionary<string, string>();
    int requests;
    System.Windows.Forms.NotifyIcon tray;
    readonly DispatcherTimer duckyPolicyTimer=new DispatcherTimer();
    string lastDuckyPolicyState;
    bool quitting;
    [DllImport("user32.dll",SetLastError=true)]static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
    bool fullscreen;
    void ToggleFullscreen(){
        fullscreen=!fullscreen;WindowState=WindowState.Normal;Topmost=fullscreen;
        double width=fullscreen?SystemParameters.PrimaryScreenWidth:Math.Min(1080,SystemParameters.WorkArea.Width),height=fullscreen?SystemParameters.PrimaryScreenHeight:Math.Min(740,SystemParameters.WorkArea.Height);
        double left=fullscreen?0:SystemParameters.WorkArea.Left+(SystemParameters.WorkArea.Width-width)/2,top=fullscreen?0:SystemParameters.WorkArea.Top+(SystemParameters.WorkArea.Height-height)/2;
        Width=width;Height=height;Left=left;Top=top;
        // WPF/WebView's resize notifications can retain the fullscreen HWND size.
        // Reconcile the real window after its layout pass, in device pixels.
        Dispatcher.BeginInvoke(new Action(delegate{
            var hwnd=new WindowInteropHelper(this).Handle;var source=HwndSource.FromHwnd(hwnd);if(source==null)return;var scale=source.CompositionTarget.TransformToDevice;
            SetWindowPos(hwnd,IntPtr.Zero,(int)Math.Round(left*scale.M11),(int)Math.Round(top*scale.M22),(int)Math.Round(width*scale.M11),(int)Math.Round(height*scale.M22),0x0014);
        }),DispatcherPriority.ApplicationIdle);
    }

    static readonly string AppEventName = "Local\\SentinelDesktopOpen";

    [STAThread]
    public static void Main(string[] args)
    {
        string here = AppDomain.CurrentDomain.BaseDirectory;
        string root = Path.GetFullPath(Path.Combine(here, "../../.."));
        RenderOptions.ProcessRenderMode = RenderMode.SoftwareOnly;
        bool standalone = args.Length == 0 || Array.IndexOf(args, "--app") >= 0 || Array.IndexOf(args,"--lifecycle-smoke")>=0;
        Process worker = null;
        Mutex instance = null;
        bool owns = false;
        string startupStage="instance";
        try {
            if (standalone) {
                instance = new Mutex(false, "Local\\SentinelDesktopApp");
                try { owns = instance.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
                if (!owns) { EventWaitHandle signal;if(EventWaitHandle.TryOpenExisting(AppEventName,out signal)){using(signal)signal.Set();}return; }
                startupStage="Windows Hello";if(!HelloStartup.Require())return;startupStage="runtime";
                string configPath = Path.Combine(here, "demo-runtime.json");
                if(File.Exists(configPath)) File.Delete(configPath);
                string bundled = Path.Combine(root, "tools/runtime/node.exe");
                worker = Process.Start(new ProcessStartInfo(File.Exists(bundled) ? bundled : "node.exe", "\"" + Path.Combine(root,"apps/demo-runtime/server.mjs") + "\"") { UseShellExecute=false, CreateNoWindow=true, WorkingDirectory=root });
                for(int i=0;i<150 && !File.Exists(configPath);i++) { if(worker.HasExited) throw new InvalidOperationException("Runtime did not start."); Thread.Sleep(100); }
                if(!File.Exists(configPath)) throw new InvalidOperationException("Runtime startup timed out.");
            }
            startupStage="window";var app = new Application();
            var console = new SentinelGlassConsole(Path.Combine(root, "apps/ui/dist"), Path.Combine(here, "glass-smoke.txt"), Array.IndexOf(args, "--smoke") >= 0, standalone || Array.IndexOf(args, "--demo") >= 0, Array.IndexOf(args,"--display-check")>=0);
            if(standalone&&Array.IndexOf(args,"--smoke")<0&&Array.IndexOf(args,"--fullscreen-smoke")<0&&Array.IndexOf(args,"--lifecycle-smoke")<0)console.security=new NativeProtectionCoordinator(text=>console.Dispatcher.BeginInvoke(new Action(()=>{console.NotifyScan(text);})));
            if(Array.IndexOf(args,"--usb-tab-smoke")>=0||Array.IndexOf(args,"--usb-browse-smoke")>=0)console.Loaded+=async delegate {
                await Task.Delay(800);
                try{bool browse=Array.IndexOf(args,"--usb-browse-smoke")>=0;string response=browse?await UsbAdmissionControl.ReadTabSnapshot():await UsbAdmissionControl.TabRequest(new WindowInteropHelper(console).Handle,"{\"action\":\"snapshot\"}");var result=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(response);bool ok=result.ContainsKey("schemaVersion")&&Convert.ToInt32(result["schemaVersion"])==1&&result.ContainsKey("devices")&&!result.ContainsKey("error");File.WriteAllText(Path.Combine(here,"usb-tab-smoke.txt"),(ok?"native_snapshot=passed\n":"native_snapshot=failed\n")+"no_device_action=True\nbroker_started="+UsbAdmissionControl.HasBrokerProcess+"\n");}catch{File.WriteAllText(Path.Combine(here,"usb-tab-smoke.txt"),"native_pipe_snapshot=failed\nno_device_action=True\n");}
            };
            if(Array.IndexOf(args,"--fullscreen-smoke")>=0) console.Loaded+=delegate {
                int phase=0;double bootWidth=0,bootHeight=0;var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(900)};
                timer.Tick+=delegate{if(phase==0){bootWidth=console.ActualWidth;bootHeight=console.ActualHeight;console.ToggleFullscreen();phase++;}else if(phase==1){console.ToggleFullscreen();phase++;}else{timer.Stop();bool restored=Math.Abs(console.ActualWidth-bootWidth)<1&&Math.Abs(console.ActualHeight-bootHeight)<1;File.WriteAllText(Path.Combine(here,"fullscreen-smoke.txt"),"boot="+bootWidth+"x"+bootHeight+"\nrestored="+console.ActualWidth+"x"+console.ActualHeight+"\npass="+restored+"\n");if(!restored)Environment.ExitCode=1;console.quitting=true;console.Close();}};timer.Start();
            };
            if(Array.IndexOf(args,"--tray")>=0) console.Loaded += delegate { console.HideToTray(); };
            if(Array.IndexOf(args,"--lifecycle-smoke")>=0) console.Loaded += delegate {
                var timer=new DispatcherTimer { Interval=TimeSpan.FromSeconds(8) };
                timer.Tick += delegate {
                    timer.Stop();
                    console.HideToTray();bool hidden=!console.IsVisible&&!console.ShowInTaskbar&&console.tray.Visible;
                    console.OpenFromTray();bool shown=console.IsVisible&&console.ShowInTaskbar&&console.ResizeMode==ResizeMode.NoResize&&console.WindowState==WindowState.Normal;
                    File.WriteAllText(Path.Combine(here,"lifecycle-smoke.txt"),"hidden="+hidden+"\nreopened="+shown+"\n");
                    if(!hidden||!shown)Environment.ExitCode=1;
                    console.quitting=true;console.Close();
                };timer.Start();
            };
            startupStage="console";app.Run(console);
        } catch(Exception error) { try{File.WriteAllText(Path.Combine(here,"startup-error.txt"),DateTime.UtcNow.ToString("O")+" stage="+startupStage+" type="+error.GetType().Name+" code="+error.HResult.ToString("X8"));}catch{}MessageBox.Show("Sentinel could not finish starting at "+startupStage+" ("+error.HResult.ToString("X8")+"). Please reopen Sentinel.", "Sentinel"); }
        finally {
            if(worker!=null) {
                try { if(!worker.HasExited) {
                    var config = new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(Path.Combine(here,"demo-runtime.json")));
                    using(var client=new HttpClient()) { client.Timeout=TimeSpan.FromSeconds(5); client.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",config["token"]); client.PostAsync(config["url"]+"/shutdown",new StringContent("{}",Encoding.UTF8,"application/json")).Wait(6000); }
                    if(!worker.WaitForExit(8000)) worker.Kill();
                }} catch { try { if(!worker.HasExited) worker.Kill(); } catch {} }
                worker.Dispose();
                if(owns)try { File.Delete(Path.Combine(here,"demo-runtime.json")); } catch {}
            }
            if(owns) instance.ReleaseMutex();
            if(instance!=null) instance.Dispose();
        }
    }

    public SentinelGlassConsole(string assets, string evidence, bool smoke, bool demo, bool displayCheck=false)
    {
        this.demo = demo;
        this.assets = assets; this.evidence = evidence; this.smoke = smoke;
        Title = "Sentinel";
        using(var iconStream=System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("Sentinel.Brand.ico"))
            Icon=System.Windows.Media.Imaging.BitmapFrame.Create(iconStream,System.Windows.Media.Imaging.BitmapCreateOptions.None,System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);
        Width = Math.Min(1080,SystemParameters.WorkArea.Width); Height = Math.Min(740,SystemParameters.WorkArea.Height);
        ResizeMode = ResizeMode.NoResize;
        PreviewKeyDown += delegate(object sender, System.Windows.Input.KeyEventArgs key){if(key.Key==System.Windows.Input.Key.F11&&!key.IsRepeat){key.Handled=true;ToggleFullscreen();}};
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        WindowStyle = WindowStyle.None;
        Background = new SolidColorBrush(Color.FromRgb(7, 11, 30));
        WindowChrome.SetWindowChrome(this, new WindowChrome {
            CaptionHeight = 0, ResizeBorderThickness = new Thickness(0),
            GlassFrameThickness = new Thickness(-1), CornerRadius = new CornerRadius(12), UseAeroCaptionButtons = false
        });
        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(0) });
        grid.RowDefinitions.Add(new RowDefinition());
        var header = new DockPanel { Background = new SolidColorBrush(Color.FromArgb(95, 13, 24, 48)), LastChildFill = true };
        var controls = new StackPanel { Orientation = Orientation.Horizontal };
        DockPanel.SetDock(controls, Dock.Right);
        StateChanged += delegate {
            if(WindowState==WindowState.Minimized) HideToTray();
            if(WindowState==WindowState.Maximized) WindowState=WindowState.Normal;
        };
        header.Children.Add(controls);
        var identity = new TextBlock { Text = "S / SENTINEL", FontSize = 12, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(178, 213, 249)), Margin = new Thickness(20, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        header.Children.Add(identity);
        header.MouseLeftButtonDown += delegate(object sender, System.Windows.Input.MouseButtonEventArgs e) { if(e.ClickCount==1 && e.OriginalSource is TextBlock) DragMove(); };
        grid.Children.Add(header);
        view.DefaultBackgroundColor = System.Drawing.Color.Transparent;
        Grid.SetRow(view, 1); grid.Children.Add(view);
        loadingSurface.Children.Add(new TextBlock { Text="Starting Sentinel…", Foreground=Brushes.White, FontSize=20, Margin=new Thickness(0,0,0,18), HorizontalAlignment=HorizontalAlignment.Center });
        loadingSurface.Children.Add(new System.Windows.Controls.ProgressBar { IsIndeterminate=true, Width=240, Height=4 });Grid.SetRow(loadingSurface,1);grid.Children.Add(loadingSurface);Content = grid;
        SourceInitialized += delegate { EnableBackdrop();var handle=new WindowInteropHelper(this).Handle;inputMonitor.Start(handle);usbArrival=new UsbGuardArrival(this,handle,null,()=>UsbAdmissionControl.Open(new WindowInteropHelper(this).Handle));HwndSource.FromHwnd(handle).AddHook(delegate(IntPtr hwnd,int message,IntPtr wParam,IntPtr lParam,ref bool handled){if(message==0x00FF)inputMonitor.Receive(lParam);if(message==0x00FE&&wParam.ToInt32()==2)inputMonitor.Removed(lParam);if(message==0x0219&&usbArrival!=null)usbArrival.Receive(wParam,lParam);return IntPtr.Zero;}); };
        Closed+=delegate{if(usbArrival!=null)usbArrival.Dispose();if(security!=null)security.Dispose();};
        Loaded += Initialize;
        Loaded += delegate { Dispatcher.BeginInvoke(new Action(EnableBackdrop),DispatcherPriority.ContextIdle); };
        Loaded += delegate {
            if(nativeCorners)return;
            var handle=new WindowInteropHelper(this).Handle;
            var transform=HwndSource.FromHwnd(handle).CompositionTarget.TransformToDevice;
            var region=CreateRoundRectRgn(0,0,(int)Math.Ceiling(ActualWidth*transform.M11)+1,(int)Math.Ceiling(ActualHeight*transform.M22)+1,(int)Math.Ceiling(20*transform.M11),(int)Math.Ceiling(20*transform.M22));
            if(region!=IntPtr.Zero&&SetWindowRgn(handle,region,true)==0)DeleteObject(region);
        };
        deadline.Interval = TimeSpan.FromSeconds(30);
        deadline.Tick += delegate { Fail("initialization_timeout"); };
        if(!smoke) {
            tray=new System.Windows.Forms.NotifyIcon { Icon=System.Drawing.Icon.ExtractAssociatedIcon(System.Reflection.Assembly.GetExecutingAssembly().Location), Text="Sentinel", Visible=true };
            var menu=new System.Windows.Forms.ContextMenuStrip();
            menu.Items.Add("Open Sentinel",null,delegate { Dispatcher.Invoke(new Action(OpenFromTray)); });
            menu.Items.Add("Quit Sentinel",null,delegate { Dispatcher.Invoke(new Action(delegate { quitting=true; Close(); })); });
            tray.ContextMenuStrip=menu;
            tray.MouseClick += delegate(object sender,System.Windows.Forms.MouseEventArgs e) { if(e.Button==System.Windows.Forms.MouseButtons.Left)Dispatcher.Invoke(new Action(OpenFromTray)); };
            Closing += delegate(object sender,System.ComponentModel.CancelEventArgs e) { if(!quitting) { e.Cancel=true; HideToTray(); } };
            // Keep the dashboard visible when switching apps; still revoke displayed secrets.
            Deactivated += delegate { Dispatcher.BeginInvoke(new Action(delegate { if(!IsActive&&!dragging&&!actionDialog&&!selectionRequest&&!quitting&&!UsbAdmissionControl.IsOpen) ClearVisibleSecrets(); }),DispatcherPriority.Background); };
            duckyPolicyTimer.Interval=TimeSpan.FromSeconds(2);
            duckyPolicyTimer.Tick+=delegate{var state=DuckyPolicyControl.Read();if(lastDuckyPolicyState!=null&&lastDuckyPolicyState!=state.State){if(state.State=="driver_unavailable")NotifyDucky("The profiled Ducky has no installed driver while its hold is armed.");else if(state.State=="off"&&(lastDuckyPolicyState=="armed"||lastDuckyPolicyState=="driver_unavailable"))NotifyDucky("Ducky hold rule removed. Reconnect the device.");}lastDuckyPolicyState=state.State;};
            duckyPolicyTimer.Start();
        }
        var openSignal=new EventWaitHandle(false,EventResetMode.AutoReset,AppEventName);
        var openTimer=new DispatcherTimer { Interval=TimeSpan.FromMilliseconds(300) };
        openTimer.Tick += delegate { if(openSignal.WaitOne(0)) OpenFromTray(); };openTimer.Start();
        var aiInboxTimer=new DispatcherTimer { Interval=TimeSpan.FromSeconds(1) };aiInboxTimer.Tick+=async delegate { await PollAiInbox(); };aiInboxTimer.Start();Closed+=delegate { aiInboxTimer.Stop(); };
        Closed += delegate { closing = true; deadline.Stop(); duckyPolicyTimer.Stop(); openTimer.Stop(); openSignal.Dispose(); if(tray!=null) tray.Dispose(); runtimeClient.Dispose(); view.Dispose(); };
    }

    void ClearVisibleSecrets() { try{if(view.CoreWebView2!=null)view.CoreWebView2.PostWebMessageAsJson("{\"kind\":\"vault-clear\"}");}catch{} }
    void HideToTray() { ClearVisibleSecrets(); ShowInTaskbar=false; Hide(); }
    void NotifyScan(string text){if(closing)return;AlertSound.Play();if(tray!=null)tray.ShowBalloonTip(5000,"Sentinel scan",text,System.Windows.Forms.ToolTipIcon.Info);}
    void NotifyDucky(string text){if(tray!=null&&!closing)tray.ShowBalloonTip(5000,"Sentinel USB Guard",text,System.Windows.Forms.ToolTipIcon.Info);}
    async void OpenDuckyControl(){
        if(actionDialog||selectionRequest)return;
        actionDialog=true;
        try{string error=await UsbAdmissionControl.Open(new WindowInteropHelper(this).Handle);if(error!=null)NotifyDucky(error=="approval_cancelled"?"Windows approval cancelled.":"USB input controls could not open.");}
        finally{actionDialog=false;}
    }
    void OpenFromTray() { ShowInTaskbar=true; WindowState=WindowState.Normal; Show(); Activate(); }

    Button WindowButton(string glyph, string name, Action action)
    {
        var button = new Button { Content = glyph, ToolTip = name, Width = 46, Height = 42, FontSize = 18,
            Foreground = Brushes.White, Background = Brushes.Transparent, BorderThickness = new Thickness(0), Cursor = System.Windows.Input.Cursors.Hand };
        button.Style = (Style)XamlReader.Parse(@"<Style xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='Button'>
          <Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Button'>
            <Border Background='{TemplateBinding Background}' BorderBrush='#88A9D6FF' BorderThickness='0' CornerRadius='5' x:Name='Chrome' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>
              <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
            </Border>
            <ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Chrome' Property='Background' Value='#554878A8'/></Trigger>
              <Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='Chrome' Property='BorderThickness' Value='1'/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate></Setter.Value></Setter></Style>");
        AutomationProperties.SetName(button, name);
        WindowChrome.SetIsHitTestVisibleInChrome(button, true);
        button.Click += delegate { action(); };
        return button;
    }

    void EnableBackdrop()
    {
        try {
            var handle = new WindowInteropHelper(this).Handle;
            int rounded = 2;
            nativeCorners = DwmSetWindowAttribute(handle, 33, ref rounded, sizeof(int)) == 0;
            int noBorder = unchecked((int)0xFFFFFFFE);
            DwmSetWindowAttribute(handle, 34, ref noBorder, sizeof(int));
            int rendering = 2;
            DwmSetWindowAttribute(handle, 2, ref rendering, sizeof(int));
            int acrylic = 3;
            if (DwmSetWindowAttribute(handle, 38, ref acrylic, sizeof(int)) != 0) return;
            var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
            if (DwmExtendFrameIntoClientArea(handle, ref margins) != 0) return;
            Background = Brushes.Transparent;
            HwndSource.FromHwnd(handle).CompositionTarget.BackgroundColor = Colors.Transparent;
            int dark = 1;
            DwmSetWindowAttribute(handle, 20, ref dark, sizeof(int));
            backdrop = true;
        } catch (DllNotFoundException) { } catch (EntryPointNotFoundException) { }
    }

    bool Local(string value)
    {
        Uri uri;
        return Uri.TryCreate(value, UriKind.Absolute, out uri) && uri.Scheme == "https" && uri.Host == "sentinel.example" && uri.Port == 443 && uri.UserInfo.Length == 0;
    }

    bool aiInboxBusy;Dictionary<string,object> pendingAiInbox;
    async Task PollAiInbox(){
        if(aiInboxBusy||closing||!demo||view.CoreWebView2==null)return;
        aiInboxBusy=true;try{
            if(await view.CoreWebView2.ExecuteScriptAsync("document.documentElement.dataset.sentinelAiReady === 'true'")!="true")return;
            if(pendingAiInbox==null)pendingAiInbox=await NativeActionCall("ai-inbox",new{});
            await DeliverAiInbox(pendingAiInbox,true);pendingAiInbox=null;
        }catch{/* Retain the handoff until the mounted UI acknowledges delivery. */}finally{aiInboxBusy=false;}
    }
    async Task DeliverAiInbox(Dictionary<string,object> inbox,bool focus){
        object raw;if(!inbox.TryGetValue("handoff",out raw))return;var handoff=raw as Dictionary<string,object>;if(handoff==null)return;
        var finding=handoff["finding"] as Dictionary<string,object>;if(finding==null)return;string reference=finding["ref"] as string;
        if(!System.Text.RegularExpressions.Regex.IsMatch(reference??"","^[a-f0-9]{32}$"))return;
        if(focus){OpenFromTray();string delivered=await view.CoreWebView2.ExecuteScriptAsync("(()=>{if(document.documentElement.dataset.sentinelAiReady!=='true')return false;delete document.documentElement.dataset.sentinelAiHandoffAck;window.dispatchEvent(new CustomEvent('sentinel-ai-handoff',{detail:"+json.Serialize(handoff)+"}));return document.documentElement.dataset.sentinelAiHandoffAck==='"+reference+"';})()");if(delivered!="true")throw new IOException("Assistant interface is not ready.");}
        NotifyAi(reference,finding["source"] as string,"A message is ready to review in SentinelAI. Open it for the explanation and suggested next steps.");
    }
    readonly HashSet<string> aiNotified=new HashSet<string>();
    void NotifyAi(string reference,string source,string explanation) {
        if(!System.Text.RegularExpressions.Regex.IsMatch(reference??"","^[a-f0-9]{32}$")||!aiNotified.Add(reference))return;
        if(aiNotified.Count>64)aiNotified.Clear();
        var card=SentinelAiNotification.Create(source,explanation,async delegate{
            OpenFromTray();try{await view.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('sentinel-ai-focus',{detail:'"+reference+"'}))");}catch{}
        });
        AlertSound.Play();card.Show();
    }

    async void RuntimeMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (closing || !demo || e.Source != "https://sentinel.example/index.html?desktop=glass") return;
        string id = null;
        bool selectionLease = false;
        string selectedPath = null;
        bool selectedFile = false;
        try {
            string raw = e.TryGetWebMessageAsString();
            if (raw.Length > 2200000 || requests >= 4) return;
            var request = json.Deserialize<Dictionary<string, object>>(raw);
            if (request.Count != 3 || !request.ContainsKey("id") || !request.ContainsKey("method") || !request.ContainsKey("data")) return;
            id = request["id"] as string;
            string method = request["method"] as string;
            if(raw.Length>4096&&method!="ai.history.save"){Reply(id,new{error="invalid_request"});return;}
            if (id == null || !System.Text.RegularExpressions.Regex.IsMatch(id, "^[a-zA-Z0-9_-]{1,64}$")) return;
            if(method=="ui.alert"){var alert=request["data"] as Dictionary<string,object>;if(alert==null||alert.Count!=1||!alert.ContainsKey("kind")||Array.IndexOf(new[]{"alert","error","notification"},alert["kind"] as string)<0)throw new InvalidOperationException();AlertSound.Play();Reply(id,new{ok=true});return;}
            if(method=="ui.sound"){var settings=request["data"] as Dictionary<string,object>;if(settings==null||settings.Count!=1||!settings.ContainsKey("enabled")||!(settings["enabled"] is bool))throw new InvalidOperationException();AlertSound.SetEnabled((bool)settings["enabled"]);Reply(id,new{ok=true});return;}
            if(method=="password.vault"){
                var input=request["data"] as Dictionary<string,object>;if(input==null||input.Count!=2||!input.ContainsKey("action")||!input.ContainsKey("data"))throw new InvalidOperationException();string operation=input["action"] as string;var payload=input["data"] as Dictionary<string,object>;if(payload==null)throw new InvalidOperationException();
                if(operation!="status"&&operation!="lock"&&(!IsActive||!IsVisible||actionDialog)){Reply(id,new{error="action_unavailable"});return;}
                bool prompt=operation!="status"&&operation!="lock";if(prompt)actionDialog=true;
                try{Reply(id,await WindowsVault.Request(this,operation,payload));}catch(Exception failure){Reply(id,new{error=failure is IOException?failure.Message:"Vault unavailable."});}finally{if(prompt)actionDialog=false;}return;
            }
            if(method!=null&&method.StartsWith("ai.")){
                var aiData=request["data"] as Dictionary<string,object>;
                if(aiData==null)throw new InvalidOperationException();
                if(method=="ai.history.load"&&aiData.Count==0){try{Reply(id,json.Deserialize<object>(new SentinelAiHistory().Load()));}catch{Reply(id,new{error="history_unavailable"});}return;}
                if(method=="ai.history.save"&&aiData.Count==1&&aiData.ContainsKey("history")){try{new SentinelAiHistory().Save(json.Serialize(aiData["history"]));Reply(id,new{ok=true});}catch{Reply(id,new{error="history_save_failed"});}return;}
                if(method=="ai.history.clear"&&aiData.Count==0&&IsVisible&&IsActive){try{new SentinelAiHistory().Clear();Reply(id,new{ok=true});}catch{Reply(id,new{error="history_save_failed"});}return;}
                if(method=="ai.chat.status"&&aiData.Count==0){Reply(id,await NativeActionCall("ai-chat-status",new{}));return;}
                if(method=="ai.chat.cancel"&&aiData.Count==0){Reply(id,await NativeActionCall("ai-chat-cancel",new{}));return;}
                if(method=="ai.chat"&&aiData.Count==2&&aiData.ContainsKey("question")&&aiData.ContainsKey("findingRef")&&((IsVisible&&IsActive)||aiData["findingRef"] is string)){Reply(id,await NativeActionCall("ai-chat",aiData));return;}
                if(method=="ai.local.status"&&aiData.Count==0){Reply(id,await NativeActionCall("ai-local-status",new{}));return;}
                if(method=="ai.quick.cancel"&&aiData.Count==1&&aiData.ContainsKey("findingRef")&&(aiData["findingRef"]==null||System.Text.RegularExpressions.Regex.IsMatch(aiData["findingRef"] as string??"","^[a-f0-9]{32}$"))){await NativeActionCall("ai-quick-cancel",aiData);Reply(id,new{ok=true});return;}
                if(method=="ai.deep.cancel"&&aiData.Count==0){sentinelAi.Cancel();Reply(id,new{ok=true});return;}
                if(method=="ai.quick"&&aiData.Count==2&&aiData.ContainsKey("question")&&aiData.ContainsKey("findingRef")){
                    if(aiData["findingRef"]==null&&(!IsVisible||!IsActive)){Reply(id,new{error="action_unavailable"});return;}
                    var quick=await NativeActionCall("ai-quick",aiData);
                    string reference=aiData["findingRef"] as string;
                    if(reference!=null&&quick.ContainsKey("text")){var record=await NativeActionCall("ai-finding",new{@ref=reference});var finding=record["finding"] as Dictionary<string,object>;if(finding!=null)NotifyAi(reference,(string)finding["source"],(string)quick["text"]);}
                    Reply(id,quick);return;
                }
                if(method=="ai.status"&&aiData.Count==0){Reply(id,sentinelAi.Status());return;}
                if(method=="ai.cancel"&&aiData.Count==0){sentinelAi.Cancel();try{await NativeActionCall("ai-quick-cancel",new{});}catch{}Reply(id,new{ok=true});return;}
                if(method=="ai.remove"&&aiData.Count==0&&IsVisible&&IsActive){try{Reply(id,sentinelAi.Remove());}catch(SentinelAiException failure){Reply(id,new{error=failure.Code});}return;}
                if(method=="ai.inbox"&&aiData.Count==0){var inbox=await NativeActionCall("ai-inbox",new{});Reply(id,inbox);await DeliverAiInbox(inbox,false);return;}
                if(((!IsVisible||!IsActive)&&!(method=="ai.send"&&aiData.ContainsKey("findingRef")&&aiData["findingRef"] is string))||actionDialog||selectionRequest){Reply(id,new{error="action_unavailable"});return;}
                actionDialog=true;
                try{
                    if(method=="ai.settings"&&aiData.Count==0)Reply(id,sentinelAi.Settings(this));
                    else if(method=="ai.remove"&&aiData.Count==0)Reply(id,sentinelAi.Remove());
                    else if(method=="ai.test"&&aiData.Count==0)Reply(id,await sentinelAi.Send(this,"Explain why verifying the official website is useful.",null,true));
                    else if(method=="ai.send"&&aiData.Count==2&&aiData.ContainsKey("question")&&aiData.ContainsKey("findingRef")){
                        string question=aiData["question"] as string;object finding=null;
                        if(aiData["findingRef"]!=null){string reference=aiData["findingRef"] as string;if(reference==null||!System.Text.RegularExpressions.Regex.IsMatch(reference,"^[a-f0-9]{32}$"))throw new SentinelAiException("invalid_finding");var resolved=await NativeActionCall("ai-finding",new{@ref=reference});finding=resolved["finding"];}
                        var answer=await sentinelAi.Send(this,question,finding,false);
                        if(finding!=null){try{await NativeActionCall("ai-answer",new{@ref=(string)aiData["findingRef"],result=answer});}catch{/* A failed return handoff never changes the detector or hides a valid desktop response. */}}
                        Reply(id,answer);
                    }else throw new SentinelAiException("invalid_request");
                }catch(SentinelAiException aiError){Reply(id,new{error=aiError.Code});}
                finally{actionDialog=false;}
                return;
            }
            if(method=="usb.admission.snapshot"||method=="usb.admission.action"){
                var payload=request["data"] as Dictionary<string,object>;bool change=method=="usb.admission.action";
                if(payload==null)throw new InvalidOperationException();
                if(change){object rawAction;if(!payload.TryGetValue("action",out rawAction))throw new InvalidOperationException();string action=rawAction as string;bool activate=action=="activate",deactivate=action=="deactivate",connect=action=="connect";if(!activate&&!deactivate&&!connect&&action!="allow"&&action!="block")throw new InvalidOperationException();if(payload.Count!=((deactivate||connect)?1:activate?2:3))throw new InvalidOperationException();foreach(string key in (deactivate||connect)?new string[0]:activate?new[]{"topology"}:new[]{"ref","topology"})if(!payload.ContainsKey(key)||!(payload[key] is string)||!System.Text.RegularExpressions.Regex.IsMatch((string)payload[key],"^[a-f0-9]{64}$"))throw new InvalidOperationException();}
                else{if(payload.Count!=0)throw new InvalidOperationException();payload=new Dictionary<string,object>{{"action","snapshot"}};}
                if(change&&(!IsVisible||!IsActive||selectionRequest||actionDialog)){Reply(id,new{error="action_unavailable"});return;}
                if(!change){requests++;try{Reply(id,json.Deserialize<object>(await UsbAdmissionControl.ReadTabSnapshot()));}finally{requests--;}return;}
                actionDialog=true;requests++;
                try{string result=await UsbAdmissionControl.TabRequest(new WindowInteropHelper(this).Handle,json.Serialize(payload));Reply(id,json.Deserialize<object>(result));}
                finally{actionDialog=false;requests--;}
                return;
            }
            if(method=="usb.admission.open"){
                var empty=request["data"] as Dictionary<string,object>;
                if(empty==null||empty.Count!=0)throw new InvalidOperationException();
                if(!IsVisible||!IsActive||selectionRequest){Reply(id,new{error="action_unavailable"});return;}
                if(actionDialog){Reply(id,new{error="action_busy"});return;}
                actionDialog=true;requests++;
                try{string error=await UsbAdmissionControl.Open(new WindowInteropHelper(this).Handle);if(error!=null)Reply(id,new{error=error});else Reply(id,new{ok=true});}
                finally{actionDialog=false;requests--;}
                return;
            }
            if(method=="usb.ducky.status"||method=="usb.ducky.block"||method=="usb.ducky.allow"){
                var empty=request["data"] as Dictionary<string,object>;
                if(empty==null||empty.Count!=0)throw new InvalidOperationException();
                if(method=="usb.ducky.status"){Reply(id,DuckyPolicyControl.Snapshot());return;}
                Reply(id,new{error="use_input_controls"});return;
            }
            if(method=="usb.ducky.open"){
                var empty=request["data"] as Dictionary<string,object>;
                if(empty==null||empty.Count!=0)throw new InvalidOperationException();
                if(!IsVisible||!IsActive||selectionRequest){Reply(id,new{error="action_unavailable"});return;}
                if(actionDialog){Reply(id,new{error="action_busy"});return;}
                OpenDuckyControl();Reply(id,new{ok=true});return;
            }
            if(method=="security.select"){
                var input=request["data"] as Dictionary<string,object>;if(input==null||input.Count!=1||!input.ContainsKey("kind")||!IsActive||!IsVisible||actionDialog||security==null)throw new InvalidOperationException();
                string kind=input["kind"] as string,path=null;actionDialog=true;
                try{if(kind=="file"){var picker=new Microsoft.Win32.OpenFileDialog{Title="Select a file to scan"};if(picker.ShowDialog(this)==true)path=picker.FileName;}else if(kind=="folder"){using(var picker=new System.Windows.Forms.FolderBrowserDialog{Description="Select a folder to scan"}){if(picker.ShowDialog()==System.Windows.Forms.DialogResult.OK)path=picker.SelectedPath;}}else throw new InvalidOperationException();if(path!=null)security.ScanSelected(path);Reply(id,security.Snapshot());}finally{actionDialog=false;}return;
            }
            if(method=="security.cancel"){
                var empty=request["data"] as Dictionary<string,object>;if(empty==null||empty.Count!=0||!IsVisible||!IsActive||security==null)throw new InvalidOperationException();security.Cancel();Reply(id,security.Snapshot());return;
            }
            if(method=="device.snapshot"||method=="security.status"){
                var empty=request["data"] as Dictionary<string,object>;if(empty==null||empty.Count!=0)throw new InvalidOperationException();
                if(method=="device.snapshot"){Reply(id,await DeviceHealth.Snapshot());return;}
                if(method=="security.status"){Reply(id,security==null?new{available=false,error="Protection is not running."}:security.Snapshot());return;}
            }
            if(method=="security.scan"||method=="security.monitor"){
                var action=request["data"] as Dictionary<string,object>;if(action==null||action.Count!=1||!IsVisible||!IsActive||security==null)throw new InvalidOperationException();
                if(method=="security.scan"){if(!action.ContainsKey("mode")||!(action["mode"] is string))throw new InvalidOperationException();security.Scan((string)action["mode"]);}
                else{if(!action.ContainsKey("enabled")||!(action["enabled"] is bool))throw new InvalidOperationException();security.SetMonitoring((bool)action["enabled"]);}
                Reply(id,security.Snapshot());return;
            }
            string route = null;
            object data = request["data"];
            if(method=="window.drag") {
                var empty=data as Dictionary<string,object>;
                if(empty==null||empty.Count!=0)throw new InvalidOperationException();
                if(!IsVisible||!IsActive||actionDialog||selectionRequest||(GetAsyncKeyState(1)&0x8000)==0){Reply(id,new{error="drag_unavailable"});return;}
                Reply(id,new{ok=true});
                dragging=true;
                try{ReleaseCapture();SendMessage(new WindowInteropHelper(this).Handle,0x00A1,new IntPtr(2),IntPtr.Zero);}
                finally{dragging=false;}
                return;
            }            if(method=="usb.observe"){var empty=data as Dictionary<string,object>;if(empty==null||empty.Count!=0)throw new InvalidOperationException();Reply(id,UsbDeviceInventory.Snapshot());return;} if(method=="usb.activity"){var empty=data as Dictionary<string,object>;if(empty==null||empty.Count!=0)throw new InvalidOperationException();Reply(id,inputMonitor.Snapshot());return;}
            if(method=="window.fullscreen"){var empty=data as Dictionary<string,object>;if(empty==null||empty.Count!=0||!IsVisible||!IsActive||(GetAsyncKeyState(0x7A)&0x8000)==0)throw new InvalidOperationException();ToggleFullscreen();Reply(id,new{ok=true});return;}
            if(method=="window.hide"){var empty=data as Dictionary<string,object>;if(empty==null||empty.Count!=0)throw new InvalidOperationException();HideToTray();Reply(id,new{ok=true});return;}
            if (method == "vault.copy" || method == "vault.rotate" || method=="vault.view" || method=="vault.remove" || method=="vault.add" || method=="vault.update") {
                if(actionDialog||selectionRequest){Reply(id,new {error="action_busy"});return;}
                var account=data as Dictionary<string,object>;
                bool add=method=="vault.add", update=method=="vault.update";
                if(account==null)throw new InvalidOperationException();
                if(add){if((account.Count!=3&&account.Count!=4)||!account.ContainsKey("name")||!account.ContainsKey("user")||!account.ContainsKey("host"))throw new InvalidOperationException();foreach(string key in account.Keys)if((key!="name"&&key!="user"&&key!="host"&&key!="password")||!(account[key] is string)||((string)account[key]).Length>256)throw new InvalidOperationException();}
                else if(update){if((account.Count!=4&&account.Count!=5)||!account.ContainsKey("id")||!account.ContainsKey("name")||!account.ContainsKey("user")||!account.ContainsKey("host"))throw new InvalidOperationException();foreach(string key in account.Keys)if((key!="id"&&key!="name"&&key!="user"&&key!="host"&&key!="password")||!(account[key] is string)||((string)account[key]).Length>256)throw new InvalidOperationException();}
                else if(account.Count!=1||!account.ContainsKey("id"))throw new InvalidOperationException();
                string accountId=add?"new_login":account["id"] as string;
                if(!System.Text.RegularExpressions.Regex.IsMatch(accountId??"","^[a-zA-Z0-9_-]{1,64}$"))throw new InvalidOperationException();
                actionDialog=true;requests++;
                try {
                    using(var lease=PasswordActionLease.TryAcquire()) {
                    if(lease==null){Reply(id,new {error="action_busy"});return;}
                    bool copy=method=="vault.copy";
                    string operation=update?"update":add?"add":method=="vault.view"?"view":method=="vault.remove"?"remove":copy?"copy":"rotate";
                    bool approved=await UsbOwnerVerification.Verify(new WindowInteropHelper(this).Handle,"Verify to "+operation+" this saved login");
                    if(!approved){Reply(id,new {error="Windows Hello cancelled or unavailable."});return;}
                    using(var message=new HttpRequestMessage(HttpMethod.Post,runtimeUrl+(update?"/account-update":add?"/account-add":operation=="remove"?"/account-remove":copy||operation=="view"?"/reveal":"/rotate"))) {
                        message.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",runtimeToken);
                        message.Headers.Add("X-Sentinel-Native-Action",runtimeActionToken);
                        message.Content=new StringContent(json.Serialize(add||update?(object)account:new {id=accountId}),Encoding.UTF8,"application/json");
                        using(var response=await runtimeClient.SendAsync(message)) {
                            response.EnsureSuccessStatusCode();
                            if(copy||operation=="view"){var result=json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync());if((string)result["mode"]!="synthetic_demo"&&(string)result["mode"]!="encrypted_vault")throw new InvalidOperationException();if(copy)Clipboard.SetText((string)result["password"]);else{if(!IsActive||!IsVisible){Reply(id,new{error="Viewing cancelled after focus changed."});return;}Reply(id,new{password=(string)result["password"]});return;}}
                            Reply(id,json.Deserialize<object>(await response.Content.ReadAsStringAsync()));
                        }
                    }
                    }
                }finally{actionDialog=false;requests--;if(!IsActive)ClearVisibleSecrets();}
                return;
            } else if (method == "quarantine.list" || method == "quarantine.restore" || method == "quarantine.destroy") {
                var input = data as Dictionary<string,object>;
                bool list=method=="quarantine.list";
                if(input==null||input.Count!=(list?0:1)||(!list&&(!input.ContainsKey("reference")||!(input["reference"] is string))))throw new InvalidOperationException();
                if(actionDialog||selectionRequest){Reply(id,new{error="action_busy"});return;}
                if(!list&&(!IsActive||!IsVisible)){Reply(id,new{error="action_unavailable"});return;}
                requests++;if(!list)actionDialog=true;
                try{Reply(id,list?await StoredQuarantine.List():await StoredQuarantine.Action(this,input["reference"] as string,method=="quarantine.destroy"));}
                catch{Reply(id,new{error="vault_recovery_required"});}
                finally{requests--;if(!list)actionDialog=false;}
                return;
            } else if (method == "quarantine.request" || method == "restore.request") {
                if (actionDialog || selectionRequest) { Reply(id, new { error = "action_busy" }); return; }
                var action = data as Dictionary<string, object>;
                bool restore = method == "restore.request";
                if(!IsActive||!IsVisible){Reply(id,new{error="action_unavailable"});return;}
                string key = restore ? "actionRef" : "reportRef";
                if (action == null || action.Count != 1 || !action.ContainsKey(key)) throw new InvalidOperationException();
                string reference = action[key] as string;
                if (reference == null || !System.Text.RegularExpressions.Regex.IsMatch(reference, "^[a-zA-Z0-9_-]{1,64}$")) throw new InvalidOperationException();
                actionDialog = true; requests++;
                try { Reply(id, await NativeDisposition(restore, reference)); }
                finally { actionDialog = false; requests--; }
                return;
            } else if (method == "scan.select") {
                quarantinedPaths.Clear(); // Durable store, not this map, owns recovery.
                if (actionDialog || selectionRequest) { Reply(id, new { error = "action_busy" }); return; }
                selectionRequest = true; selectionLease = true;
                var selection = data as Dictionary<string, object>;
                if (selection == null || selection.Count != 1 || !selection.ContainsKey("kind")) throw new InvalidOperationException();
                string path = null;
                if ((selection["kind"] as string) == "file") {
                    selectedFile = true;
                    var picker = new Microsoft.Win32.OpenFileDialog { Title = "Select a file for bounded read-only inspection" };
                    if (picker.ShowDialog(this) == true) path = picker.FileName;
                } else if ((selection["kind"] as string) == "folder") {
                    using (var picker = new System.Windows.Forms.FolderBrowserDialog { Description = "Select a small benign folder (64 files maximum)" }) {
                        if (picker.ShowDialog() == System.Windows.Forms.DialogResult.OK) path = picker.SelectedPath;
                    }
                } else throw new InvalidOperationException();
                if (path == null) { Reply(id, new { cancelled = true }); return; }
                selectedPath = path;
                // A rejected/ambiguous replacement loses action authority.
                nativeSelection.Clear();
                route = "scan"; data = new { path = path };
            } else if (method == "inspection.read") {
                var empty = data as Dictionary<string, object>;
                if (empty == null || empty.Count != 0) throw new InvalidOperationException();
                route = "inspection";
            } else if (method == "watchtower.preference") {
                var preference=data as Dictionary<string,object>;
                if(preference==null||preference.Count!=2||!preference.ContainsKey("host")||!preference.ContainsKey("choice"))throw new InvalidOperationException();
                string host=preference["host"] as string,choice=preference["choice"] as string;
                if(host==null||host.Length>253||!System.Text.RegularExpressions.Regex.IsMatch(host,@"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$" )||Array.IndexOf(new[]{"allow_once","trust","untrust"},choice)<0||!IsActive||!IsVisible||actionDialog)throw new InvalidOperationException();
                if(choice=="trust"){
                    actionDialog=true;bool approved;try{approved=MessageBox.Show(this,"Use a higher warning threshold for this domain and its subdomains? This does not establish that it is safe.\n\n"+host,"Trust domain in Watchtower",MessageBoxButton.YesNo,MessageBoxImage.Warning,MessageBoxResult.No)==MessageBoxResult.Yes;}finally{actionDialog=false;}
                    if(!approved){Reply(id,new{state="declined"});return;}
                }
                route="watchtower-preference";data=new{host=host,risk=choice};
            } else if (method == "wifi.assess") {
                var empty = data as Dictionary<string, object>;
                if (empty == null || empty.Count != 0) throw new InvalidOperationException();
                route = "wifi";

            } else if (method == "password.vault") route = "password-vault";
            else if (method == "state" || method == "lock" || method == "unlock" || method == "cancel" || method == "pair") route = method;
            else throw new InvalidOperationException();
            requests++;
            try {
                var message = new HttpRequestMessage(HttpMethod.Post, runtimeUrl + "/" + route);
                message.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", runtimeToken);
                message.Content = new StringContent(json.Serialize(data), Encoding.UTF8, "application/json");
                using (message) using (var response = await runtimeClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead)) {
                    if (response.Content.Headers.ContentLength > 131072) throw new InvalidOperationException();
                    string text;
                    using (var cancel = new System.Threading.CancellationTokenSource(8000)) using (var stream = await response.Content.ReadAsStreamAsync()) using (var bytes = new MemoryStream()) {
                        var chunk = new byte[8192]; int count;
                        while ((count = await stream.ReadAsync(chunk, 0, chunk.Length, cancel.Token)) != 0) {
                            if (bytes.Length + count > 131072) throw new InvalidOperationException();
                            bytes.Write(chunk, 0, count);
                        }
                        text = Encoding.UTF8.GetString(bytes.ToArray());
                    }
                    var result = json.Deserialize<Dictionary<string, object>>(text);
                    if (route == "scan" && response.IsSuccessStatusCode && result.Count == 1 && result.ContainsKey("id"))
                        nativeSelection.Accept(result["id"] as string, selectedPath, selectedFile);
                    Reply(id, result);
                }
            } finally { requests--; }
        } catch { if (id != null) Reply(id, new { error = "runtime_unavailable" }); }
        finally { if (selectionLease) selectionRequest = false; }
    }

    void Reply(string id, object data)
    {
        if (!closing) view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new { id = id, data = data }));
    }

    async Task<Dictionary<string, object>> NativeActionCall(string route, object data)
    {
        using (var message = new HttpRequestMessage(HttpMethod.Post, runtimeUrl + "/" + route)) {
            message.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", runtimeToken);
            message.Headers.Add("X-Sentinel-Native-Action", runtimeActionToken);
            message.Content = new StringContent(json.Serialize(data), Encoding.UTF8, "application/json");
            using (var response = await ((route=="ai-quick"||route=="ai-chat")?localAiClient:runtimeClient).SendAsync(message, HttpCompletionOption.ResponseHeadersRead)) {
                if ((!response.IsSuccessStatusCode&&route!="ai-quick"&&route!="ai-chat") || response.Content.Headers.ContentLength > ((route=="ai-quick"||route=="ai-chat")?8192:131072)) throw new InvalidOperationException();
                using (var cancel = new System.Threading.CancellationTokenSource((route=="ai-quick"||route=="ai-chat")?65000:8000)) using (var stream = await response.Content.ReadAsStreamAsync()) using (var bytes = new MemoryStream()) {
                    var chunk = new byte[8192]; int count;
                    while ((count = await stream.ReadAsync(chunk, 0, chunk.Length, cancel.Token)) != 0) {
                        if (bytes.Length + count > ((route=="ai-quick"||route=="ai-chat")?8192:131072)) throw new InvalidOperationException();
                        bytes.Write(chunk, 0, count);
                    }
                    return json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(bytes.ToArray()));
                }
            }
        }
    }

    async Task<object> NativeDisposition(bool restore, string reference)
    {
        string displayPath = null;
        if (!restore) {
            await StoredQuarantine.List(); // Refuse removal unless the durable recovery worker is available.
            var state = await NativeActionCall("state", new { });
            var scan = state.ContainsKey("scan") ? state["scan"] as Dictionary<string, object> : null;
            var evidence = await NativeActionCall("inspection", new { });
            var snapshot = evidence.ContainsKey("snapshot") ? evidence["snapshot"] as Dictionary<string, object> : null;
            var reports = snapshot == null || !snapshot.ContainsKey("reports") ? null : snapshot["reports"] as System.Collections.ICollection;
            displayPath = nativeSelection.Resolve(scan == null || !scan.ContainsKey("id") ? null : scan["id"] as string,
                reference, reports == null ? 0 : reports.Count);
        } else if (!quarantinedPaths.TryGetValue(reference, out displayPath)) throw new InvalidOperationException();
        string prefix = restore ? "restore" : "quarantine";
        object input = restore ? (object)new { actionRef = reference } : new { reportRef = reference };
        var preview = await NativeActionCall(prefix + "-prepare", input);
        if (!preview.ContainsKey("type") || (preview["type"] as string) != prefix + "_preview") return preview;
        var payload = preview["data"] as Dictionary<string, object>;
        string key = restore ? "restoreRef" : "actionRef";
        string action = payload == null || !payload.ContainsKey(key) ? null : payload[key] as string;
        if (action == null || !System.Text.RegularExpressions.Regex.IsMatch(action, "^[a-zA-Z0-9_-]{1,64}$") || closing) throw new InvalidOperationException();
        string explanation = restore
            ? "Restore the retained quarantined bytes to their original location? Existing files will not be overwritten."
            : "Encrypt and quarantine this completed selected-file report, then remove the original? This is a file operation, not a malware verdict. Only proceed for your intended selected file.";
        string evidenceText = "";
        if (!restore) {
            var inspection = payload.ContainsKey("inspection") ? payload["inspection"] as Dictionary<string, object> : null;
            string digest = inspection == null || !inspection.ContainsKey("sha256") ? null : inspection["sha256"] as string;
            if (digest == null || !System.Text.RegularExpressions.Regex.IsMatch(digest, "^[a-f0-9]{64}$")) throw new InvalidOperationException();
            evidenceText = "\nSHA-256: " + digest;
        }
        // Default is No. The renderer never supplies approval or the preview's
        // native action reference. Rust rechecks its subject and30-second expiry.
        bool approved = MessageBox.Show(this, explanation + "\n\nNative selection: " + displayPath + "\nReport/reference: " + reference + evidenceText + "\nApproval expires after30 seconds.", "Sentinel native " + prefix + " confirmation", MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) == MessageBoxResult.Yes;
        object decision = restore ? (object)new { restoreRef = action } : new { actionRef = action };
        var result = await NativeActionCall(prefix + (approved ? "-confirm" : "-decline"), decision);
        var receipt = result.ContainsKey("data") ? result["data"] as Dictionary<string, object> : null;
        if (receipt != null && receipt.ContainsKey("state")) {
            if (!restore && (receipt["state"] as string) == "quarantined" && quarantinedPaths.Count < 64) quarantinedPaths[action] = displayPath;
            if (restore && (receipt["state"] as string) == "restored") quarantinedPaths.Remove(reference);
        }
        return result;
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        if (actionDialog) {
            e.Cancel = true;
            MessageBox.Show(this, "Finish the native action before closing. Quarantined files remain available in the durable Vault after restarting.", "Sentinel recovery", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        base.OnClosing(e);
    }

    void Fail(string reason)
    {
        if (closing) return;
        deadline.Stop();
        loadingSurface.Visibility=Visibility.Collapsed;
        File.WriteAllText(evidence, "navigation=False\nerror=" + reason + "\nbackend=unavailable\n");
        Environment.ExitCode = 1;
        if (smoke) Close();
        else {
            view.Visibility = Visibility.Collapsed;
            var message = new TextBlock { Text = "Sentinel’s console could not load. Rebuild the local UI and run the console smoke check.",
                Foreground = Brushes.White, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(32) };
            Grid.SetRow(message, 1); ((Grid)Content).Children.Add(message);
        }
    }

    async void Initialize(object sender, RoutedEventArgs args)
    {
        deadline.Start();
        try {
            if (!File.Exists(Path.Combine(assets, "index.html"))) { Fail("assets_missing"); return; }
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppDomain.CurrentDomain.BaseDirectory, smoke ? "profile-smoke" : "profile"));
            await view.EnsureCoreWebView2Async(env);
            if (closing) return;
            view.ZoomFactor = 0.90;
            var core = view.CoreWebView2;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsWebMessageEnabled = demo;
            if (demo) {
                var config = json.Deserialize<Dictionary<string, string>>(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "demo-runtime.json")));
                Uri target;
                if (!Uri.TryCreate(config["url"], UriKind.Absolute, out target) || target.Scheme != "http" || target.Host != "127.0.0.1" || target.Port < 1024 || target.AbsolutePath != "/" || target.Query.Length != 0 || target.UserInfo.Length != 0 || !System.Text.RegularExpressions.Regex.IsMatch(config["token"], "^[a-f0-9]{64}$")) throw new InvalidOperationException();
                if (!config.ContainsKey("nativeActionToken") || !System.Text.RegularExpressions.Regex.IsMatch(config["nativeActionToken"], "^[a-f0-9]{64}$")) throw new InvalidOperationException();
                runtimeUrl = config["url"]; runtimeToken = config["token"]; runtimeActionToken = config["nativeActionToken"];
                core.WebMessageReceived += RuntimeMessage;
            }
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDefaultScriptDialogsEnabled = false;
            core.PermissionRequested += delegate(object s, CoreWebView2PermissionRequestedEventArgs e) { e.State = CoreWebView2PermissionState.Deny; e.Handled = true; };
            core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e) {
                File.AppendAllText(evidence, "navigation_start_local=" + Local(e.Uri) + "\n");
                if (!Local(e.Uri)) e.Cancel = true;
            };
            core.SetVirtualHostNameToFolderMapping("sentinel.example", assets, CoreWebView2HostResourceAccessKind.Deny);
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object s, CoreWebView2WebResourceRequestedEventArgs e) {
                if (!Local(e.Request.Uri)) { e.Response = env.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes("External requests unavailable")),403,"Forbidden","Content-Type: text/plain");return; }
                var resourceUri=new Uri(e.Request.Uri);string relative=Uri.UnescapeDataString(resourceUri.AbsolutePath).TrimStart('/');if(relative.Length==0)relative="index.html";
                string resourcePath=Path.GetFullPath(Path.Combine(assets,relative.Replace('/',Path.DirectorySeparatorChar)));
                if(!resourcePath.StartsWith(Path.GetFullPath(assets)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!File.Exists(resourcePath)){e.Response=env.CreateWebResourceResponse(null,404,"Not Found","Content-Type: text/plain");return;}
                string extension=Path.GetExtension(resourcePath).ToLowerInvariant();string mime=extension==".html"?"text/html; charset=utf-8":extension==".js"?"text/javascript; charset=utf-8":extension==".css"?"text/css; charset=utf-8":extension==".png"?"image/png":extension==".svg"?"image/svg+xml":extension==".woff2"?"font/woff2":extension==".woff"?"font/woff":"application/octet-stream";
                e.Response=env.CreateWebResourceResponse(File.OpenRead(resourcePath),200,"OK","Content-Type: "+mime+"\r\nCache-Control: no-store");
            };
            core.NavigationCompleted += async delegate(object s, CoreWebView2NavigationCompletedEventArgs e) {
                try {
                    if (closing) return;
                    if (!e.IsSuccess) { Fail(e.WebErrorStatus.ToString() + "_http_" + e.HttpStatusCode); return; }
                    string heading = "\"\"";
                    for (int attempt = 0; attempt < 40 && !closing; attempt++) {
                        heading = await core.ExecuteScriptAsync("document.querySelector('h1')?.textContent || ''");
                        if (heading == "\"Dashboard\"") break;
                        await Task.Delay(50);
                    }
                    if (closing) return;
                    string glass = await core.ExecuteScriptAsync("document.documentElement.dataset.desktop === 'glass'");
                    string backend = "unavailable";
                    string inspectionBridge = "not_checked";
                    if (demo) {
                        using (var probe = new HttpRequestMessage(HttpMethod.Post, runtimeUrl + "/state")) {
                            probe.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", runtimeToken);
                            probe.Content = new StringContent("{}", Encoding.UTF8, "application/json");
                            using (var response = await runtimeClient.SendAsync(probe)) {
                                if (!response.IsSuccessStatusCode) throw new InvalidOperationException();
                                var snapshot = json.Deserialize<Dictionary<string, object>>(await response.Content.ReadAsStringAsync());
                                if (!RuntimeReadiness.Accept(snapshot)) throw new InvalidOperationException();
                                backend = "demo_runtime";
                            }
                        }
                        if (smoke) {
                            await core.ExecuteScriptAsync(@"document.documentElement.dataset.inspectionSmoke = ''; window.chrome.webview.addEventListener('message', e => { if(e.data?.id === 'native_smoke_read') { const s=e.data.data?.snapshot; document.documentElement.dataset.inspectionSmoke=JSON.stringify({state:s?.state??null,reports:s?.reports.length??0,inspectedBytes:s?.reports[0]?.inspectedBytes??null,sha256:s?.reports[0]?.sha256??null}); } }); window.chrome.webview.postMessage(JSON.stringify({id:'native_smoke_read',method:'inspection.read',data:{}}));");
                            for (int attempt = 0; attempt < 100 && !closing; attempt++) {
                                inspectionBridge = await core.ExecuteScriptAsync("document.documentElement.dataset.inspectionSmoke || ''");
                                if (inspectionBridge != "\"\"") break;
                                await Task.Delay(50);
                            }
                            if (inspectionBridge == "\"\"") throw new InvalidOperationException();
                        }
                    }
                    if(glass!="true"||heading!="\"Dashboard\""){Fail("console_not_ready");return;}
                    deadline.Stop();loadingSurface.Visibility=Visibility.Collapsed;
                    File.WriteAllText(evidence, "navigation=True\nglass=" + glass + "\nheading=" + heading + "\ncustom_chrome=True\nbackdrop_requested=" + backdrop + "\nbackend=" + backend + "\ninspection_bridge=" + inspectionBridge + "\n");
                    if(Array.IndexOf(Environment.GetCommandLineArgs(),"--protection-status-smoke")>=0&&security!=null){
                        for(int attempt=0;attempt<120&&!closing;attempt++){
                            string controls=await core.ExecuteScriptAsync("JSON.stringify({page:document.querySelector('h1')?.textContent,quickPresent:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Quick scan')),quickEnabled:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Quick scan')&&!b.disabled),definitionsVisible:document.body.textContent.includes(' signatures · Updated ')})");
                            var status=json.Deserialize<Dictionary<string,object>>(json.Serialize(security.Snapshot()));
                            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"protection-smoke.txt"),"native="+json.Serialize(status)+"\nui="+controls+"\n");
                            if(Convert.ToBoolean(status["available"])&&Convert.ToBoolean(json.Deserialize<Dictionary<string,object>>(json.Deserialize<string>(controls))["quickEnabled"])&&Convert.ToBoolean(json.Deserialize<Dictionary<string,object>>(json.Deserialize<string>(controls))["definitionsVisible"])){File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"protection-smoke.txt"),"native="+json.Serialize(status)+"\nui="+controls+"\n");break;}
                            await Task.Delay(1000);
                        }
                    }
                    if (smoke) { if (glass != "true" || heading != "\"Dashboard\"") Environment.ExitCode = 1; Close(); }
                } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
            };
            File.WriteAllText(evidence, "initializing=True\nassets_exist=" + File.Exists(Path.Combine(assets, "index.html")) + "\n");
            await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache);
            core.Navigate("https://sentinel.example/index.html?desktop=glass");
        } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
    }
}
