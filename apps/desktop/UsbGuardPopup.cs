using System;
using System.Text;
using System.Diagnostics;
using System.Windows.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;

// Native notice model. No renderer-controlled hold Boolean or enrollment IDs.
internal sealed class UsbGuardNotice {
 internal readonly string Reference,Name,Capabilities,Status,Reason;internal readonly bool CanApprove;
 internal readonly bool CanManage;
 UsbGuardNotice(string reference,string name,string capabilities,string status,string reason,bool approve,bool manage=false){Reference=reference;Name=Clean(name,80,"USB device");Capabilities=Clean(capabilities,80,"Input device");Status=status;Reason=reason;CanApprove=approve;CanManage=manage;}
 internal static UsbGuardNotice Connected(string reference,string name,string capabilities){return new UsbGuardNotice(reference,name,capabilities,"USB device connected","Review device access in USB Guard.",false,true);}
 static string Clean(string text,int limit,string fallback){if(string.IsNullOrEmpty(text))return fallback;var value=new StringBuilder();foreach(char c in text)if(c>=0x20&&c<=0x7E&&value.Length<limit)value.Append(c);return value.Length==0?fallback:value.ToString();}
 internal static UsbGuardNotice Unavailable(string reference,string name,string capabilities,string reason){if(string.IsNullOrEmpty(reference)||reference.Length>128)throw new ArgumentException("Invalid native connection reference.");return new UsbGuardNotice(reference,name,capabilities,"Input blocking unavailable",reason=="disconnected"?"Device disconnected.":"USB Guard is not enforcing input restrictions.",false);}
 internal static UsbGuardNotice Disconnected(string reference){return new UsbGuardNotice(reference,"USB device","Disconnected","Device disconnected","This connection is no longer available.",false);}
 internal static UsbGuardNotice Profiled(string reference,string name,string capabilities,string state){
  if(state=="off")return new UsbGuardNotice(reference,name,capabilities,"Ducky rule: allowed","No enrolled-device block rule is active. Open USB Guard to block it.",false);
  if(state=="armed"||state=="driver_unavailable")return new UsbGuardNotice(reference,name,capabilities,"Ducky block rule armed","An installation rule is configured for this enrolled device. Input blocking is not confirmed. Open USB Guard to allow it.",false);
  return Unavailable(reference,name,capabilities,"service_unavailable");
 }
 public override string ToString(){return Status;}
 // Blocked/approval-enabled factory intentionally absent until a reviewed native
 // service supplies actual measured admission evidence. No UI may invent it.
}
internal sealed class UsbGuardPopup:Window {
 string actionError;UsbGuardNotice current;readonly Button allow=new Button();readonly Button dismiss=new Button();readonly TextBlock title=new TextBlock(),status=new TextBlock(),detail=new TextBlock(),capabilities=new TextBlock();readonly Func<UsbGuardNotice,Task<UsbGuardNotice>> approve;bool busy,closed;
 readonly Stopwatch visibleLifetime=new Stopwatch();readonly DispatcherTimer expiryTimer=new DispatcherTimer();
 internal static bool ShouldExpire(TimeSpan elapsed,bool actionBusy){return !actionBusy&&elapsed>=TimeSpan.FromSeconds(5);}
 void ExpireIfDue(){if(!closed&&ShouldExpire(visibleLifetime.Elapsed,busy))Close();}
 internal bool AllowEnabled{get{return allow.IsEnabled;}}
 static SolidColorBrush Brush(byte r,byte g,byte b){return new SolidColorBrush(Color.FromRgb(r,g,b));}
 internal UsbGuardPopup(UsbGuardNotice notice,Func<UsbGuardNotice,Task<UsbGuardNotice>> nativeApproval){
  if(notice==null)throw new ArgumentNullException("notice");current=notice;approve=nativeApproval;
  Title="Sentinel — USB connected";Width=390;SizeToContent=SizeToContent.Height;ResizeMode=ResizeMode.NoResize;WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ShowInTaskbar=false;ShowActivated=false;Topmost=true;WindowStartupLocation=WindowStartupLocation.Manual;
  var area=SystemParameters.WorkArea;Left=Math.Max(area.Left,area.Right-Width-20);Top=Math.Max(area.Top,area.Bottom-290);
  var panel=new StackPanel{Margin=new Thickness(22)};var border=new Border{CornerRadius=new CornerRadius(14),Background=Brush(12,24,44),Child=panel,Effect=new DropShadowEffect{BlurRadius=24,Opacity=.35,ShadowDepth=3}};Content=border;
  var header=new DockPanel{Margin=new Thickness(0,0,0,18)};var close=new Button{Content="×",Width=26,Height=26,Background=Brush(18,32,52),Foreground=Brush(178,199,224),BorderThickness=new Thickness(0)};close.Click+=(s,e)=>Close();DockPanel.SetDock(close,Dock.Right);header.Children.Add(close);header.Children.Add(new TextBlock{Text="SENTINEL  /  USB GUARD",FontSize=11,Foreground=Brush(109,171,226),VerticalAlignment=VerticalAlignment.Center});header.MouseLeftButtonDown+=(s,e)=>{if(e.OriginalSource is TextBlock)DragMove();};panel.Children.Add(header);
  title.FontSize=21;title.FontWeight=FontWeights.SemiBold;title.Foreground=Brush(226,236,249);title.TextWrapping=TextWrapping.Wrap;panel.Children.Add(title);
  capabilities.FontSize=12;capabilities.Foreground=Brush(145,169,197);capabilities.Margin=new Thickness(0,5,0,16);panel.Children.Add(capabilities);
  status.FontSize=14;status.FontWeight=FontWeights.SemiBold;status.Foreground=Brush(237,194,110);panel.Children.Add(status);
  detail.FontSize=12;detail.Foreground=Brush(165,186,211);detail.TextWrapping=TextWrapping.Wrap;detail.Margin=new Thickness(0,6,0,20);panel.Children.Add(detail);
  var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};allow.Content="Allow once";allow.Padding=new Thickness(14,8,14,8);allow.Margin=new Thickness(0,0,8,0);allow.Background=Brush(47,137,227);allow.Foreground=Brush(238,246,255);allow.BorderThickness=new Thickness(0);allow.Click+=async(s,e)=>await Approve();actions.Children.Add(allow);dismiss.Padding=new Thickness(14,8,14,8);dismiss.Background=Brush(24,41,62);dismiss.Foreground=Brush(200,217,238);dismiss.BorderThickness=new Thickness(0);dismiss.Click+=(s,e)=>Close();actions.Children.Add(dismiss);panel.Children.Add(actions);
  expiryTimer.Interval=TimeSpan.FromMilliseconds(100);expiryTimer.Tick+=(s,e)=>ExpireIfDue();
  Loaded+=(s,e)=>{if(!closed&&!visibleLifetime.IsRunning){visibleLifetime.Start();expiryTimer.Start();}};
  Closed+=(s,e)=>{closed=true;expiryTimer.Stop();visibleLifetime.Stop();};Display();
 }
 void Display(){title.Text=current.Name;capabilities.Text=current.Capabilities;status.Text=current.Status;detail.Text=actionError??current.Reason;allow.Content=current.CanManage?"Open USB Guard":"Allow once";allow.IsEnabled=!closed&&!busy&&(current.CanApprove||current.CanManage)&&approve!=null;dismiss.Content=current.CanApprove?"Keep blocked":"Dismiss";}
 internal void Disconnect(){current=UsbGuardNotice.Disconnected(current.Reference);Display();}
 async Task Approve(){if(busy||closed||(!current.CanApprove&&!current.CanManage)||approve==null)return;actionError=null;busy=true;var subject=current;Display();try{var next=await approve(subject);if(!closed&&object.ReferenceEquals(current,subject)&&next!=null&&next.Reference==subject.Reference)current=next;}catch{if(!closed&&object.ReferenceEquals(current,subject))actionError="USB Guard could not open.";}finally{busy=false;if(!closed){ExpireIfDue();if(!closed)Display();}}}
}
