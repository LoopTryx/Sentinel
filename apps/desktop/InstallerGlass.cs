using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;

internal static class InstallerGlass {
 [StructLayout(LayoutKind.Sequential)]struct Margins{public int Left,Right,Top,Bottom;}
 [StructLayout(LayoutKind.Sequential)]struct Accent{public int State,Flags,Color,Animation;}
 [StructLayout(LayoutKind.Sequential)]struct Composition{public int Attribute;public IntPtr Data;public int Size;}
 [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
 [DllImport("dwmapi.dll")]static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd,ref Margins margins);
 [DllImport("user32.dll")]static extern int SetWindowCompositionAttribute(IntPtr hwnd,ref Composition data);
 static bool AccentBackdrop(IntPtr hwnd){
  var accent=new Accent{State=4,Color=unchecked((int)0x552C1B12)};var memory=Marshal.AllocHGlobal(Marshal.SizeOf(accent));
  try{Marshal.StructureToPtr(accent,memory,false);var data=new Composition{Attribute=19,Data=memory,Size=Marshal.SizeOf(accent)};return SetWindowCompositionAttribute(hwnd,ref data)!=0;}finally{Marshal.FreeHGlobal(memory);}
 }
 internal static void Apply(Window window,Border surface){
  window.SizeChanged+=delegate{Round(window);};window.Loaded+=delegate{Configure(window,surface);Round(window);};window.ContentRendered+=delegate{Configure(window,surface);};Configure(window,surface);var source=HwndSource.FromHwnd(new WindowInteropHelper(window).Handle);
  if(source!=null)source.AddHook(delegate(IntPtr h,int message,IntPtr w,IntPtr l,ref bool handled){if(message==0x31E||message==0x1A){window.Dispatcher.BeginInvoke((Action)delegate{Configure(window,surface);});}return IntPtr.Zero;});
 }
 static void Round(Window window){
  if(window.ActualWidth<=0||window.ActualHeight<=0)return;
  window.OpacityMask=CornerMask(window.ActualWidth,window.ActualHeight);
 }
 internal static Brush CornerMask(double width,double height){
  var drawing=new GeometryDrawing(Brushes.White,null,new RectangleGeometry(new Rect(0,0,width,height),8,8));
  var mask=new DrawingBrush(drawing){Stretch=Stretch.Fill};mask.Freeze();return mask;
 }
 static void Configure(Window window,Border surface){
  var hwnd=new WindowInteropHelper(window).Handle;var source=HwndSource.FromHwnd(hwnd);
  bool roundedBackdrop=false;try{int rounded=2;roundedBackdrop=DwmSetWindowAttribute(hwnd,33,ref rounded,4)==0;}catch{}
  bool glass=false;bool transparency=true;
  try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")){transparency=key==null||Convert.ToInt32(key.GetValue("EnableTransparency",1))!=0;}}catch{}
  // Older compositors cannot round their blur surface; prefer a clean alpha-masked
  // opaque fallback instead of leaking a rectangular blur beyond the corners.
  if(!SystemParameters.HighContrast&&transparency&&roundedBackdrop){
   try{int dark=1;DwmSetWindowAttribute(hwnd,20,ref dark,4);int none=1;DwmSetWindowAttribute(hwnd,38,ref none,4);glass=AccentBackdrop(hwnd);}catch{}
   if(!glass){try{int backdrop=3;glass=DwmSetWindowAttribute(hwnd,38,ref backdrop,4)==0;}catch{}}
  }
  if(glass){try{var margins=new Margins{Left=-1,Right=-1,Top=-1,Bottom=-1};glass=DwmExtendFrameIntoClientArea(hwnd,ref margins)==0;}catch{glass=false;}}
  if(glass){window.Background=Brushes.Transparent;if(source!=null&&source.CompositionTarget!=null)source.CompositionTarget.BackgroundColor=Colors.Transparent;}
  else {try{int off=1;DwmSetWindowAttribute(hwnd,38,ref off,4);var accent=new Accent();var memory=Marshal.AllocHGlobal(Marshal.SizeOf(accent));try{Marshal.StructureToPtr(accent,memory,false);var data=new Composition{Attribute=19,Data=memory,Size=Marshal.SizeOf(accent)};SetWindowCompositionAttribute(hwnd,ref data);}finally{Marshal.FreeHGlobal(memory);}}catch{}window.Background=new SolidColorBrush(Color.FromRgb(16,31,51));}
  window.Tag=glass?"Native background blur":"Opaque fallback";
 }
}
