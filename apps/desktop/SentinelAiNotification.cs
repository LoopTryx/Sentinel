using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;

// Presentation only: the caller owns finding references and the Learn more action.
internal static class SentinelAiNotification {
 [StructLayout(LayoutKind.Sequential)]struct Margins{public int Left,Right,Top,Bottom;}
 [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
 [DllImport("dwmapi.dll")]static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd,ref Margins margins);
 [StructLayout(LayoutKind.Sequential)]struct AccentPolicy{public int State,Flags,Color,Animation;}
 [StructLayout(LayoutKind.Sequential)]struct CompositionData{public int Attribute;public IntPtr Data;public int Size;}
 [DllImport("user32.dll")]static extern int SetWindowCompositionAttribute(IntPtr window,ref CompositionData data);
 static bool EnableGlass(IntPtr window){
  var policy=new AccentPolicy{State=4,Flags=0,Color=unchecked((int)0x991c140c)};
  IntPtr ptr=Marshal.AllocHGlobal(Marshal.SizeOf(policy));
  try{Marshal.StructureToPtr(policy,ptr,false);var data=new CompositionData{Attribute=19,Data=ptr,Size=Marshal.SizeOf(policy)};return SetWindowCompositionAttribute(window,ref data)!=0;}finally{Marshal.FreeHGlobal(ptr);}
 }
 static Brush Ink(byte r,byte g,byte b){return new SolidColorBrush(Color.FromRgb(r,g,b));}
 static Button MakeButton(string text,bool primary){
  var button=new Button{Content=text,Padding=new Thickness(13,8,13,8),FontSize=12,FontWeight=FontWeights.SemiBold,Cursor=System.Windows.Input.Cursors.Hand,Background=primary?(Brush)new LinearGradientBrush(Color.FromRgb(200,242,255),Color.FromRgb(101,191,244),90):Brushes.Transparent,Foreground=primary?Ink(16,44,65):Ink(188,210,227),BorderBrush=Ink(91,132,163),BorderThickness=new Thickness(1)};
  button.Template=(ControlTemplate)XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='Button'><Border x:Name='edge' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' CornerRadius='9' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='{TemplateBinding BorderThickness}' Padding='{TemplateBinding Padding}'><ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='edge' Property='Opacity' Value='0.82'/></Trigger><Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='edge' Property='BorderBrush' Value='#D5F1FF'/><Setter TargetName='edge' Property='BorderThickness' Value='2'/></Trigger></ControlTemplate.Triggers></ControlTemplate>");return button;
 }
 internal static Window Create(string source,string explanation,Action open){
  var card=new Window{Title="Sentinel notification",Width=396,Height=238,WindowStyle=WindowStyle.None,ResizeMode=ResizeMode.NoResize,ShowInTaskbar=false,ShowActivated=false,Topmost=true,Background=Ink(18,35,55)};
  card.Left=SystemParameters.WorkArea.Right-card.Width-18;card.Top=SystemParameters.WorkArea.Bottom-card.Height-18;
  var background=new LinearGradientBrush(Color.FromRgb(22,65,99),Color.FromRgb(12,24,49),45);
  var border=new Border{CornerRadius=new CornerRadius(16),BorderBrush=new SolidColorBrush(Color.FromArgb(175,134,217,255)),BorderThickness=new Thickness(0),Background=background,Padding=new Thickness(21,17,21,18)};card.Content=border;
  var grid=new Grid();grid.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});grid.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1,GridUnitType.Star)});grid.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});border.Child=grid;
  var header=new DockPanel{LastChildFill=true,Margin=new Thickness(0,0,0,12)};
  var dismiss=MakeButton("×",false);dismiss.Padding=new Thickness(8,1,8,3);dismiss.FontSize=19;dismiss.BorderThickness=new Thickness(0);AutomationProperties.SetName(dismiss,"Dismiss notification");dismiss.Click+=delegate{card.Close();};DockPanel.SetDock(dismiss,Dock.Right);header.Children.Add(dismiss);
  string surface=source=="whatsapp_message"?"WhatsApp":source=="gmail_message"?"Gmail":source=="outlook_message"?"Outlook":source.EndsWith("_message")?"Email":"Link warning";
  var title=new StackPanel();title.Children.Add(new TextBlock{Text="SENTINEL  /  "+surface,FontSize=10,FontWeight=FontWeights.SemiBold,Foreground=Ink(149,200,231),Margin=new Thickness(0,0,0,5)});title.Children.Add(new TextBlock{Text="Worth a closer look",FontSize=18,FontWeight=FontWeights.SemiBold,Foreground=Ink(230,245,255)});header.Children.Add(title);grid.Children.Add(header);
  var body=new TextBlock{Text=explanation.Length>240?explanation.Substring(0,237)+"…":explanation,Foreground=Ink(196,215,230),TextWrapping=TextWrapping.Wrap,TextTrimming=TextTrimming.CharacterEllipsis,FontSize=12,LineHeight=19,MaxHeight=77,Margin=new Thickness(0,0,0,12)};Grid.SetRow(body,1);grid.Children.Add(body);
  var footer=new DockPanel();var learn=MakeButton("Learn more  ↗",true);learn.HorizontalAlignment=HorizontalAlignment.Left;learn.Click+=delegate{card.Close();open();};footer.Children.Add(learn);Grid.SetRow(footer,2);grid.Children.Add(footer);
  var timer=new DispatcherTimer{Interval=TimeSpan.FromSeconds(12)};timer.Tick+=delegate{timer.Stop();card.Close();};card.MouseEnter+=delegate{timer.Stop();};card.MouseLeave+=delegate{if(!card.IsKeyboardFocusWithin)timer.Start();};card.GotKeyboardFocus+=delegate{timer.Stop();};card.LostKeyboardFocus+=delegate{if(!card.IsMouseOver)timer.Start();};card.Closed+=delegate{timer.Stop();};card.Loaded+=delegate{timer.Start();if(SystemParameters.ClientAreaAnimation)border.BeginAnimation(UIElement.OpacityProperty,new DoubleAnimation(0,1,TimeSpan.FromMilliseconds(180)));};
  card.SourceInitialized+=delegate{try{
   var h=new WindowInteropHelper(card).Handle;int corners=2,noBorder=unchecked((int)0xfffffffe);DwmSetWindowAttribute(h,33,ref corners,4);DwmSetWindowAttribute(h,34,ref noBorder,4);
   if(SystemParameters.HighContrast)return;
   int acrylic=3;bool glass=DwmSetWindowAttribute(h,38,ref acrylic,4)==0;
   glass=EnableGlass(h)||glass;if(!glass)return;
   var m=new Margins{Left=-1,Right=-1,Top=-1,Bottom=-1};DwmExtendFrameIntoClientArea(h,ref m);
   HwndSource.FromHwnd(h).CompositionTarget.BackgroundColor=Colors.Transparent;card.Background=Brushes.Transparent;
   border.Background=new LinearGradientBrush(Color.FromArgb(50,24,86,121),Color.FromArgb(90,10,22,43),45);
  }catch{/* Opaque fallback remains usable. */}};

  return card;
 }
}
