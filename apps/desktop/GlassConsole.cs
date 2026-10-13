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
    readonly WebView2 view = new WebView2();
    readonly string assets, evidence;
    readonly bool smoke;
    readonly DispatcherTimer deadline = new DispatcherTimer();
    bool backdrop;
    bool closing;
    readonly bool demo;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 131072 };
    readonly HttpClient runtimeClient = new HttpClient { Timeout = TimeSpan.FromSeconds(12), MaxResponseContentBufferSize = 131072 };
    string runtimeUrl, runtimeToken, runtimeActionToken;
    bool actionDialog;
    bool selectionRequest;
    readonly NativeSelectionBinding nativeSelection = new NativeSelectionBinding();
    readonly Dictionary<string, string> quarantinedPaths = new Dictionary<string, string>();
    int requests;
    System.Windows.Forms.NotifyIcon tray;
    bool quitting;
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
        try {
            if (standalone) {
                instance = new Mutex(false, "Local\\SentinelDesktopApp");
                try { owns = instance.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
                if (!owns) { using(var signal = EventWaitHandle.OpenExisting(AppEventName)) signal.Set(); return; }
                string configPath = Path.Combine(here, "demo-runtime.json");
                if(File.Exists(configPath)) File.Delete(configPath);
                string bundled = Path.Combine(root, "tools/runtime/node.exe");
                worker = Process.Start(new ProcessStartInfo(File.Exists(bundled) ? bundled : "node.exe", "\"" + Path.Combine(root,"apps/demo-runtime/server.mjs") + "\"") { UseShellExecute=false, CreateNoWindow=true, WorkingDirectory=root });
                for(int i=0;i<150 && !File.Exists(configPath);i++) { if(worker.HasExited) throw new InvalidOperationException("Runtime did not start."); Thread.Sleep(100); }
                if(!File.Exists(configPath)) throw new InvalidOperationException("Runtime startup timed out.");
            }
            var app = new Application();
            var console = new SentinelGlassConsole(Path.Combine(root, "apps/ui/dist"), Path.Combine(here, "glass-smoke.txt"), Array.IndexOf(args, "--smoke") >= 0, standalone || Array.IndexOf(args, "--demo") >= 0);
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
            app.Run(console);
        } catch(Exception) { MessageBox.Show("Sentinel could not start. Check that the complete app folder is present and Microsoft Edge WebView2 Runtime is installed.", "Sentinel"); }
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

    public SentinelGlassConsole(string assets, string evidence, bool smoke, bool demo)
    {
        this.demo = demo;
        this.assets = assets; this.evidence = evidence; this.smoke = smoke;
        Title = "Sentinel";
        Width = Math.Min(1080,SystemParameters.WorkArea.Width); Height = Math.Min(740,SystemParameters.WorkArea.Height);
        ResizeMode = ResizeMode.NoResize;
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
        Grid.SetRow(view, 1); grid.Children.Add(view); Content = grid;
        SourceInitialized += delegate { EnableBackdrop();var handle=new WindowInteropHelper(this).Handle;inputMonitor.Start(handle);HwndSource.FromHwnd(handle).AddHook(delegate(IntPtr hwnd,int message,IntPtr wParam,IntPtr lParam,ref bool handled){if(message==0x00FF)inputMonitor.Receive(lParam);if(message==0x00FE&&wParam.ToInt32()==2)inputMonitor.Removed(lParam);return IntPtr.Zero;}); };
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
            tray=new System.Windows.Forms.NotifyIcon { Icon=System.Drawing.SystemIcons.Shield, Text="Sentinel", Visible=true };
            var menu=new System.Windows.Forms.ContextMenuStrip();
            menu.Items.Add("Open Sentinel",null,delegate { Dispatcher.Invoke(new Action(OpenFromTray)); });
            menu.Items.Add("Quit Sentinel",null,delegate { Dispatcher.Invoke(new Action(delegate { quitting=true; Close(); })); });
            tray.ContextMenuStrip=menu;
            tray.MouseClick += delegate(object sender,System.Windows.Forms.MouseEventArgs e) { if(e.Button==System.Windows.Forms.MouseButtons.Left)Dispatcher.Invoke(new Action(OpenFromTray)); };
            Closing += delegate(object sender,System.ComponentModel.CancelEventArgs e) { if(!quitting) { e.Cancel=true; HideToTray(); } };
            Deactivated += delegate { Dispatcher.BeginInvoke(new Action(delegate { if(!IsActive&&!dragging&&!actionDialog&&!selectionRequest&&!quitting) HideToTray(); }),DispatcherPriority.Background); };
        }
        var openSignal=new EventWaitHandle(false,EventResetMode.AutoReset,AppEventName);
        var openTimer=new DispatcherTimer { Interval=TimeSpan.FromMilliseconds(300) };
        openTimer.Tick += delegate { if(openSignal.WaitOne(0)) OpenFromTray(); };openTimer.Start();
        Closed += delegate { closing = true; deadline.Stop(); openTimer.Stop(); openSignal.Dispose(); if(tray!=null) tray.Dispose(); runtimeClient.Dispose(); view.Dispose(); };
    }

    void HideToTray() { try{if(view.CoreWebView2!=null)view.CoreWebView2.PostWebMessageAsJson("{\"kind\":\"vault-clear\"}");}catch{}ShowInTaskbar=false; Hide(); }
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

    async void RuntimeMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (closing || !demo || e.Source != "https://sentinel.example/index.html?desktop=glass") return;
        string id = null;
        bool selectionLease = false;
        string selectedPath = null;
        bool selectedFile = false;
        try {
            string raw = e.TryGetWebMessageAsString();
            if (raw.Length > 4096 || requests >= 4) return;
            var request = json.Deserialize<Dictionary<string, object>>(raw);
            if (request.Count != 3 || !request.ContainsKey("id") || !request.ContainsKey("method") || !request.ContainsKey("data")) return;
            id = request["id"] as string;
            string method = request["method"] as string;
            if (id == null || !System.Text.RegularExpressions.Regex.IsMatch(id, "^[a-zA-Z0-9_-]{1,64}$")) return;
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
                    bool approved=await Task.Run(()=>VaultApproval.Approve(operation,accountId));
                    if(!approved){Reply(id,new {error=VaultApproval.LastError});return;}
                    using(var message=new HttpRequestMessage(HttpMethod.Post,runtimeUrl+(update?"/account-update":add?"/account-add":operation=="remove"?"/account-remove":copy||operation=="view"?"/reveal":"/rotate"))) {
                        message.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",runtimeToken);
                        message.Headers.Add("X-Sentinel-Native-Action",runtimeActionToken);
                        message.Content=new StringContent(json.Serialize(add||update?(object)account:new {id=accountId}),Encoding.UTF8,"application/json");
                        using(var response=await runtimeClient.SendAsync(message)) {
                            response.EnsureSuccessStatusCode();
                            if(copy||operation=="view"){var result=json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync());if((string)result["mode"]!="synthetic_demo")throw new InvalidOperationException();if(copy)Clipboard.SetText((string)result["password"]);else{if(!IsActive||!IsVisible){Reply(id,new{error="Viewing cancelled after focus changed."});return;}Reply(id,new{password=(string)result["password"]});return;}}
                            Reply(id,json.Deserialize<object>(await response.Content.ReadAsStringAsync()));
                        }
                    }
                    }
                }finally{actionDialog=false;requests--;if(!IsActive)HideToTray();}
                return;
            } else if (method == "quarantine.request" || method == "restore.request") {
                if (actionDialog || selectionRequest) { Reply(id, new { error = "action_busy" }); return; }
                var action = data as Dictionary<string, object>;
                bool restore = method == "restore.request";
                if (!restore) { Reply(id, new { error = "quarantine_recovery_lifetime_unavailable" }); return; }
                string key = restore ? "actionRef" : "reportRef";
                if (action == null || action.Count != 1 || !action.ContainsKey(key)) throw new InvalidOperationException();
                string reference = action[key] as string;
                if (reference == null || !System.Text.RegularExpressions.Regex.IsMatch(reference, "^[a-zA-Z0-9_-]{1,64}$")) throw new InvalidOperationException();
                actionDialog = true; requests++;
                try { Reply(id, await NativeDisposition(restore, reference)); }
                finally { actionDialog = false; requests--; }
                return;
            } else if (method == "scan.select") {
                if (quarantinedPaths.Count != 0) { Reply(id, new { error = "restore_required_before_new_scan" }); return; }
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
            } else if (method == "wifi.assess") {
                var empty = data as Dictionary<string, object>;
                if (empty == null || empty.Count != 0) throw new InvalidOperationException();
                route = "wifi";

            } else if (method == "state" || method == "lock" || method == "unlock" || method == "cancel" || method == "pair") route = method;
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
            using (var response = await runtimeClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead)) {
                if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 131072) throw new InvalidOperationException();
                using (var cancel = new System.Threading.CancellationTokenSource(8000)) using (var stream = await response.Content.ReadAsStreamAsync()) using (var bytes = new MemoryStream()) {
                    var chunk = new byte[8192]; int count;
                    while ((count = await stream.ReadAsync(chunk, 0, chunk.Length, cancel.Token)) != 0) {
                        if (bytes.Length + count > 131072) throw new InvalidOperationException();
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
        if (quarantinedPaths.Count != 0 || actionDialog) {
            e.Cancel = true;
            MessageBox.Show(this, "Finish the native action and restore quarantined files before closing. This demo retains restore authority only for the current session.", "Sentinel recovery", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        base.OnClosing(e);
    }

    void Fail(string reason)
    {
        if (closing) return;
        deadline.Stop();
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
                if (!Local(e.Request.Uri)) e.Response = env.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes("External requests unavailable")), 403, "Forbidden", "Content-Type: text/plain");
            };
            core.NavigationCompleted += async delegate(object s, CoreWebView2NavigationCompletedEventArgs e) {
                try {
                    if (closing) return;
                    if (!e.IsSuccess) { Fail(e.WebErrorStatus.ToString() + "_http_" + e.HttpStatusCode); return; }
                    string heading = "\"\"";
                    for (int attempt = 0; attempt < 40 && !closing; attempt++) {
                        heading = await core.ExecuteScriptAsync("document.querySelector('h1')?.textContent || ''");
                        if (heading == "\"Console\"") break;
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
                                if ((string)snapshot["mode"] != "synthetic_demo" || !(bool)snapshot["connected"]) throw new InvalidOperationException();
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
                    deadline.Stop();
                    File.WriteAllText(evidence, "navigation=True\nglass=" + glass + "\nheading=" + heading + "\ncustom_chrome=True\nbackdrop_requested=" + backdrop + "\nbackend=" + backend + "\ninspection_bridge=" + inspectionBridge + "\n");
                    if (smoke) { if (glass != "true" || heading != "\"Console\"") Environment.ExitCode = 1; Close(); }
                } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
            };
            File.WriteAllText(evidence, "initializing=True\nassets_exist=" + File.Exists(Path.Combine(assets, "index.html")) + "\n");
            core.Navigate("https://sentinel.example/index.html?desktop=glass");
        } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
    }
}
