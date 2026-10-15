using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

public sealed class DuckyPolicyWindow : Window {
 readonly TextBlock state=new TextBlock(),detail=new TextBlock(),message=new TextBlock();
 readonly Button hold=new Button(),release=new Button();readonly DispatcherTimer timer=new DispatcherTimer();readonly Action<string> notify;bool busy;
 public DuckyPolicyWindow(Window owner,Action<string> notification){
  Owner=owner;notify=notification;Title="Sentinel · Profiled USB";Width=440;Height=330;ResizeMode=ResizeMode.NoResize;WindowStartupLocation=WindowStartupLocation.CenterOwner;ShowInTaskbar=false;
  Background=new SolidColorBrush(Color.FromRgb(19,28,46));Foreground=Brushes.White;
  var stack=new StackPanel{Margin=new Thickness(24)};Content=stack;
  stack.Children.Add(new TextBlock{Text="RP2040-Zero",FontSize=23,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,0,0,8)});
  stack.Children.Add(new TextBlock{Text="Profiled device · this computer",Foreground=Brushes.LightSteelBlue,Margin=new Thickness(0,0,0,20)});
  state.FontSize=18;state.FontWeight=FontWeights.SemiBold;stack.Children.Add(state);
  detail.TextWrapping=TextWrapping.Wrap;detail.Foreground=Brushes.LightSteelBlue;detail.Margin=new Thickness(0,8,0,16);stack.Children.Add(detail);
  var buttons=new StackPanel{Orientation=Orientation.Horizontal};stack.Children.Add(buttons);
  hold.Content="Hold for 5 minutes";release.Content="Release";
  foreach(var button in new[]{hold,release}){button.Padding=new Thickness(14,8,14,8);button.Margin=new Thickness(0,0,10,0);button.Background=new SolidColorBrush(Color.FromRgb(35,64,96));button.Foreground=Brushes.White;button.BorderBrush=Brushes.SteelBlue;buttons.Children.Add(button);}
  hold.Click+=delegate{Run("hold");};release.Click+=delegate{Run("release");};
  message.TextWrapping=TextWrapping.Wrap;message.Margin=new Thickness(0,14,0,0);message.Foreground=Brushes.LightSteelBlue;stack.Children.Add(message);
  timer.Interval=TimeSpan.FromSeconds(2);timer.Tick+=delegate{Refresh();};Closed+=delegate{timer.Stop();};timer.Start();Refresh();
 }
 void Refresh(){var current=DuckyPolicyControl.Read();state.Text=current.Title;detail.Text=current.Detail;hold.IsEnabled=!busy&&(current.State=="off"||current.State=="unavailable");release.IsEnabled=!busy;}
 async void Run(string action){if(busy)return;busy=true;message.Text="Approve Windows to continue.";Refresh();int code=await DuckyPolicyControl.Execute(action);busy=false;
  message.Text=code==0?(action=="hold"?"Hold configured. Automatic release is scheduled.":"Hold removed and Windows policy refreshed. Reconnect the Ducky."):code==21?"Windows approval cancelled.":code==20?"Windows is still processing the request. Outcome and recovery status are unknown.":"Action could not be completed. The enrolled profile or recovery task needs attention.";
  Refresh();if(code==0&&notify!=null)notify(action=="hold"?"Profiled Ducky hold armed for five minutes.":"Ducky hold removed. Reconnect the device.");
 }
}
