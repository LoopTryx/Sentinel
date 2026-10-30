using System;using System.IO;using System.Media;
// Native playback also works while WebView2 is hidden or subject to autoplay rules.
internal static class AlertSound {
 static readonly object Gate=new object();static SoundPlayer player;static Stream resource;static DateTime last=DateTime.MinValue;
 internal static bool Enabled {get{try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey("Software\\Sentinel\\Presentation"))return key==null||Convert.ToInt32(key.GetValue("Sounds",1))!=0;}catch{return true;}}}
 internal static void SetEnabled(bool enabled){using(var key=Microsoft.Win32.Registry.CurrentUser.CreateSubKey("Software\\Sentinel\\Presentation"))key.SetValue("Sounds",enabled?1:0);if(!enabled)lock(Gate){if(player!=null)player.Stop();}}
 internal static bool Deliver(bool enabled,Action play){if(!enabled)return false;try{play();return true;}catch{return false;}}
 internal static void Play(){lock(Gate){if(!Enabled||(DateTime.UtcNow-last).TotalMilliseconds<500)return;last=DateTime.UtcNow;
  Deliver(true,delegate{try{if(player==null){resource=typeof(AlertSound).Assembly.GetManifestResourceStream("Sentinel.Alert.wav");if(resource==null)throw new IOException();player=new SoundPlayer(resource);player.Load();}player.Play();}catch{SystemSounds.Exclamation.Play();}});
 }}
}
