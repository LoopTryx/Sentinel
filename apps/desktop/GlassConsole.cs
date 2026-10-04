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

    readonly WebView2 view = new WebView2();
    readonly string assets, evidence;
    readonly bool smoke;
    readonly DispatcherTimer deadline = new DispatcherTimer();
    bool backdrop;
    bool closing;

    [STAThread]
    public static void Main(string[] args)
    {
        string here = AppDomain.CurrentDomain.BaseDirectory;
        string root = Path.GetFullPath(Path.Combine(here, "../../.."));
        RenderOptions.ProcessRenderMode = RenderMode.SoftwareOnly;
        var app = new Application();
        app.Run(new SentinelGlassConsole(Path.Combine(root, "apps/ui/dist"), Path.Combine(here, "glass-smoke.txt"), args.Length == 1 && args[0] == "--smoke"));
    }

    public SentinelGlassConsole(string assets, string evidence, bool smoke)
    {
        this.assets = assets; this.evidence = evidence; this.smoke = smoke;
        Title = "Sentinel — GLM Glass Console";
        Width = 1280; Height = 850; MinWidth = 850; MinHeight = 600;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        WindowStyle = WindowStyle.None;
        Background = new SolidColorBrush(Color.FromRgb(7, 11, 30));
        WindowChrome.SetWindowChrome(this, new WindowChrome {
            CaptionHeight = 42, ResizeBorderThickness = new Thickness(6),
            GlassFrameThickness = new Thickness(-1), CornerRadius = new CornerRadius(12), UseAeroCaptionButtons = false
        });
        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(42) });
        grid.RowDefinitions.Add(new RowDefinition());
        var header = new DockPanel { Background = new SolidColorBrush(Color.FromArgb(95, 13, 24, 48)), LastChildFill = true };
        var controls = new StackPanel { Orientation = Orientation.Horizontal };
        DockPanel.SetDock(controls, Dock.Right);
        controls.Children.Add(WindowButton("−", "Minimize", delegate { SystemCommands.MinimizeWindow(this); }));
        var maximize = WindowButton("□", "Maximize", delegate {
            if (WindowState == WindowState.Maximized) SystemCommands.RestoreWindow(this);
            else SystemCommands.MaximizeWindow(this);
        });
        controls.Children.Add(maximize);
        controls.Children.Add(WindowButton("×", "Close", delegate { SystemCommands.CloseWindow(this); }));
        StateChanged += delegate {
            maximize.Content = WindowState == WindowState.Maximized ? "❐" : "□";
            maximize.ToolTip = WindowState == WindowState.Maximized ? "Restore" : "Maximize";
            AutomationProperties.SetName(maximize, (string)maximize.ToolTip);
        };
        header.Children.Add(controls);
        var identity = new TextBlock { Text = "S / SENTINEL", FontSize = 12, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(178, 213, 249)), Margin = new Thickness(20, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        header.Children.Add(identity);
        grid.Children.Add(header);
        view.DefaultBackgroundColor = System.Drawing.Color.Transparent;
        Grid.SetRow(view, 1); grid.Children.Add(view); Content = grid;
        SourceInitialized += delegate { EnableBackdrop(); };
        Loaded += Initialize;
        deadline.Interval = TimeSpan.FromSeconds(30);
        deadline.Tick += delegate { Fail("initialization_timeout"); };
        Closed += delegate { closing = true; deadline.Stop(); view.Dispose(); };
    }

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
            var core = view.CoreWebView2;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsWebMessageEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
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
                    deadline.Stop();
                    File.WriteAllText(evidence, "navigation=True\nglass=" + glass + "\nheading=" + heading + "\ncustom_chrome=True\nbackdrop_requested=" + backdrop + "\nbackend=unavailable\n");
                    if (smoke) { if (glass != "true" || heading != "\"Console\"") Environment.ExitCode = 1; Close(); }
                } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
            };
            File.WriteAllText(evidence, "initializing=True\nassets_exist=" + File.Exists(Path.Combine(assets, "index.html")) + "\n");
            core.Navigate("https://sentinel.example/index.html?desktop=glass");
        } catch (Exception error) { Fail(error.GetType().Name + "_" + error.HResult.ToString("X8")); }
    }
}
