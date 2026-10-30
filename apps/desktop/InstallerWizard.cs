using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;

internal sealed class InstallerWizard:Window {
 readonly TextBlock title=new TextBlock(),description=new TextBlock(),status=new TextBlock();
 readonly Button primary=new Button(),settings=new Button(),secondary=new Button();
 readonly ProgressBar progress=new ProgressBar();bool busy,installed;string settingsTarget="ms-settings:signinoptions";
 readonly string extension=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","ChromeExtension");
 internal InstallerWizard(string version){
  Title="Sentinel "+version+" Setup";WindowStyle=WindowStyle.None;AllowsTransparency=true;ResizeMode=ResizeMode.CanResize;Width=800;Height=620;MinWidth=560;MinHeight=480;WindowStartupLocation=WindowStartupLocation.CenterScreen;FontFamily=new FontFamily("Segoe UI");FontSize=15;Foreground=Brushes.White;Background=Brushes.Transparent;UseLayoutRounding=true;SnapsToDevicePixels=true;
  var surface=new Border{CornerRadius=new CornerRadius(8),BorderBrush=new SolidColorBrush(Color.FromArgb(110,194,231,255)),BorderThickness=new Thickness(1),Padding=new Thickness(30),Background=GlassSurface(false)};Content=surface;
  var layout=new Grid();layout.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});layout.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1,GridUnitType.Star)});layout.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});surface.Child=layout;
  var heading=new StackPanel{Margin=new Thickness(0,0,0,22)};
  var caption=new DockPanel{LastChildFill=true,Margin=new Thickness(0,0,0,12)};var captionActions=new StackPanel{Orientation=Orientation.Horizontal};
  foreach(bool minimize in new[]{true,false}){
   var action=new Button{Content=minimize?"−":"×",Width=36,Height=32,FontSize=20,Padding=new Thickness(0),Margin=new Thickness(5,0,0,0),Foreground=Brushes.White,Background=GlassSurface(true),BorderBrush=new SolidColorBrush(Color.FromArgb(90,214,240,255)),BorderThickness=new Thickness(1),Template=GlassButton()};
   System.Windows.Automation.AutomationProperties.SetName(action,minimize?"Minimize setup":"Close setup");
   if(minimize)action.Click+=delegate{WindowState=WindowState.Minimized;};else action.Click+=delegate{Close();};captionActions.Children.Add(action);
  }
  DockPanel.SetDock(captionActions,Dock.Right);caption.Children.Add(captionActions);
  var dragArea=new Border{Background=Brushes.Transparent,Child=new TextBlock{Text="SENTINEL  /  SETUP",FontSize=12,FontWeight=FontWeights.SemiBold,Foreground=Ink(177,224,250),VerticalAlignment=VerticalAlignment.Center}};
  dragArea.MouseLeftButtonDown+=delegate(object sender,System.Windows.Input.MouseButtonEventArgs e){if(e.ButtonState==System.Windows.Input.MouseButtonState.Pressed)DragMove();};caption.Children.Add(dragArea);heading.Children.Add(caption);
  title.Text="Welcome to Sentinel";title.FontSize=30;title.FontWeight=FontWeights.SemiBold;title.TextWrapping=TextWrapping.Wrap;heading.Children.Add(title);layout.Children.Add(heading);
  var body=new Border{CornerRadius=new CornerRadius(18),BorderThickness=new Thickness(1),BorderBrush=new SolidColorBrush(Color.FromArgb(70,214,239,255)),Background=GlassSurface(true),Padding=new Thickness(22),Margin=new Thickness(0,0,0,22)};
  description.Text="Setup will check your PC and install everything Sentinel needs. Your passwords and chats stay on your device.";description.TextWrapping=TextWrapping.Wrap;description.LineHeight=25;description.Foreground=Ink(228,242,251);body.Child=new ScrollViewer{Content=description,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled};Grid.SetRow(body,1);layout.Children.Add(body);
  var footer=new StackPanel();status.Text="Checking your PC...";status.Foreground=Ink(185,222,240);status.TextWrapping=TextWrapping.Wrap;status.LineHeight=22;status.Margin=new Thickness(0,0,0,14);footer.Children.Add(status);
  progress.Height=5;progress.IsIndeterminate=true;progress.Visibility=Visibility.Collapsed;progress.Margin=new Thickness(0,0,0,16);progress.Foreground=Ink(152,224,255);progress.Background=new SolidColorBrush(Color.FromArgb(40,210,240,255));footer.Children.Add(progress);
  var buttons=new WrapPanel{HorizontalAlignment=HorizontalAlignment.Right};
  foreach(var b in new[]{settings,secondary,primary}){
   b.MinHeight=48;b.MinWidth=126;b.Padding=new Thickness(20,12,20,12);b.Margin=new Thickness(8,4,0,4);b.FontSize=14;b.FontWeight=FontWeights.SemiBold;b.Cursor=System.Windows.Input.Cursors.Hand;
   b.Background=b==primary?new LinearGradientBrush(Color.FromArgb(230,192,237,255),Color.FromArgb(205,111,188,226),90):GlassSurface(true);b.Foreground=b==primary?Ink(13,38,56):Ink(232,245,255);b.BorderBrush=new SolidColorBrush(Color.FromArgb(145,211,239,255));b.BorderThickness=new Thickness(1);b.Template=GlassButton();buttons.Children.Add(b);
  }
  primary.Content="Install Sentinel";primary.IsEnabled=false;primary.IsDefault=true;settings.Content="Set up Windows Hello";settings.Visibility=Visibility.Collapsed;secondary.Content="Close";footer.Children.Add(buttons);Grid.SetRow(footer,2);layout.Children.Add(footer);
  primary.Click+=async delegate{if(installed){Launch();return;}await Install();};settings.Click+=delegate{Open(settingsTarget);};secondary.Click+=async delegate{if(installed){Chrome();return;}if(settings.Visibility==Visibility.Visible){await Check();return;}Close();};
  SourceInitialized+=delegate{InstallerGlass.Apply(this,surface);};ContentRendered+=async delegate{await Check();};Closing+=delegate(object sender,System.ComponentModel.CancelEventArgs e){if(busy)e.Cancel=true;};
 }
 static Brush Ink(byte r,byte g,byte b){return new SolidColorBrush(Color.FromRgb(r,g,b));}
 static Brush GlassSurface(bool light){return new LinearGradientBrush(new GradientStopCollection{new GradientStop(Color.FromArgb(light?(byte)18:(byte)36,186,223,246),0),new GradientStop(Color.FromArgb(light?(byte)8:(byte)48,18,39,65),0.58),new GradientStop(Color.FromArgb(light?(byte)15:(byte)60,35,61,95),1)},45);}
 static ControlTemplate GlassButton(){return (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='Button'><Border x:Name='edge' CornerRadius='12' Padding='{TemplateBinding Padding}' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='{TemplateBinding BorderThickness}'><ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center' RecognizesAccessKey='True'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='edge' Property='Opacity' Value='0.85'/></Trigger><Trigger Property='IsPressed' Value='True'><Setter TargetName='edge' Property='Opacity' Value='0.65'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter TargetName='edge' Property='Opacity' Value='0.45'/></Trigger><Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='edge' Property='BorderBrush' Value='White'/><Setter TargetName='edge' Property='BorderThickness' Value='2'/></Trigger></ControlTemplate.Triggers></ControlTemplate>");}
 internal static string PlatformProblem(int build,bool x64,int framework){
  if(build<19041)return "This version needs Windows 10 version 2004 or newer, or Windows 11. Open Windows Update to update this PC.";
  if(!x64)return "This installer is for x64 PCs. This PC needs a separate ARM64 or 32-bit build.";
  if(framework<528040)return "Microsoft .NET Framework 4.8 is needed. Install it through Windows Update, restart if requested, then reopen Setup.";
  return null;
 }
 async Task Check(){
  primary.IsEnabled=false;secondary.IsEnabled=false;settings.Visibility=Visibility.Collapsed;status.Text="Checking Windows and Windows Hello...";string problem;
  try{using(var os=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))using(var fx=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full")){
   string arch=Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432")??Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE");problem=PlatformProblem(Convert.ToInt32(os.GetValue("CurrentBuildNumber")),arch=="AMD64",fx==null?0:Convert.ToInt32(fx.GetValue("Release",0)));
  }}catch{problem="Setup could not check Windows requirements. Open Windows Update, finish pending updates, then reopen Setup.";}
  if(problem!=null){description.Text=problem;status.Text="A Windows update or a different installer is needed.";if(problem.IndexOf("x64 PCs",StringComparison.Ordinal)<0){settingsTarget="ms-settings:windowsupdate";settings.Content="Open Windows Update";settings.Visibility=Visibility.Visible;secondary.Content="Check again";}else secondary.Content="Close";secondary.IsEnabled=true;return;}
  string hello=await HelloStartup.Availability();
  if(hello!="Available"){
   title.Text="Set up Windows Hello";description.Text="Sentinel uses your Windows PIN, fingerprint or face to protect passwords and sensitive approvals.\n\n1. Choose Set up Windows Hello below.\n2. In Windows Settings, add a PIN (Windows Hello).\n3. Return here and choose Check again.\n\nIf Hello is disabled by your organization, ask its administrator. If it is busy, finish the other verification first.";
   status.Text=hello=="DeviceBusy"?"Windows Hello is busy. Finish the other verification, then check again.":"Windows Hello is not ready on this PC.";settingsTarget="ms-settings:signinoptions";settings.Content="Set up Windows Hello";settings.Visibility=Visibility.Visible;secondary.Content="Check again";secondary.IsEnabled=true;return;
  }
  title.Text="Ready to install";description.Text="Windows Hello is ready.\n\nSetup installs Sentinel, its local AI models and the Chrome extension files. Missing Microsoft WebView2 will be installed automatically (internet may be needed).\n\nAfter installation, Setup will guide you through Chrome's one-time extension approval. Your existing passwords and chats are preserved.";
  status.Text="Choose Install Sentinel to begin.";primary.IsEnabled=true;secondary.Content="Close";secondary.IsEnabled=true;
 }
 async Task Install(){
  busy=true;primary.IsEnabled=false;secondary.IsEnabled=false;settings.Visibility=Visibility.Collapsed;progress.Visibility=Visibility.Visible;title.Text="Installing Sentinel";description.Text="Please keep this window open. Setup is verifying and installing the included app files. This can take several minutes.";
  try{
   await Task.Run(()=>ReleaseInstaller.Install(delegate(string text){Dispatcher.BeginInvoke((Action)delegate{status.Text=text;});}));
   installed=true;title.Text="Sentinel is installed";description.Text="One last step for Chrome:\n\n1. Choose Set up Chrome below.\n2. Turn on Developer mode (top right).\n3. Choose Load unpacked.\n4. Paste the folder path copied to your clipboard and select it.\n\nChrome requires this approval for the included extension. You can also open Sentinel now and finish Chrome later.";
   status.Text=ReleaseInstaller.ChromePath()==null?"Chrome was not found. Set up Chrome opens its download page.":"Your desktop connection is already configured.";primary.Content="Open Sentinel";secondary.Content="Set up Chrome";
  }catch(Exception e){title.Text="Setup needs your attention";description.Text=e.Message;status.Text="Resolve the issue shown above, then choose Try again.";primary.Content="Try again";secondary.Content="Close";}
  finally{busy=false;progress.Visibility=Visibility.Collapsed;primary.IsEnabled=true;secondary.IsEnabled=true;}
 }
 void Chrome(){
  string chrome=ReleaseInstaller.ChromePath();if(chrome==null){Open("https://www.google.com/chrome/");return;}
  try{Clipboard.SetText(extension);Process.Start(new ProcessStartInfo("explorer.exe","\""+extension+"\""){UseShellExecute=true});Process.Start(new ProcessStartInfo(chrome,"chrome://extensions"){UseShellExecute=true});status.Text="Extension folder copied. In Chrome: Load unpacked, paste the path, Select Folder.";}catch{status.Text="Select this extension folder in Chrome: "+extension;}
 }
 void Launch(){try{Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","Desktop","Sentinel.exe")){UseShellExecute=true});Close();}catch{status.Text="Open Sentinel using the shortcut on your desktop.";}}
 void Open(string target){try{Process.Start(new ProcessStartInfo(target){UseShellExecute=true});}catch{MessageBox.Show(this,target=="ms-settings:signinoptions"?"Open Windows Settings > Accounts > Sign-in options to configure your PIN.":target=="ms-settings:windowsupdate"?"Open Windows Settings > Update & Security > Windows Update.":"Open https://www.google.com/chrome/ in your browser to install Chrome.","Sentinel Setup");}}
}
