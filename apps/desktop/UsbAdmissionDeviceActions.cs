using System;
using System.Collections.Generic;
internal static class UsbAdmissionDeviceActions {
 internal static string Status(bool builtIn,bool verifiedRule,bool approved,bool verifiedOff=false){return builtIn?"Built-in · protected":!verifiedRule?(verifiedOff?"Not restricted · approval required":"Windows access state unverified"):approved?"Allowed by Windows rule":"Restricted by Windows rule";}
 internal static string[] Change(string[] current,string exact,bool allow){if(string.IsNullOrEmpty(exact))throw new ArgumentException();var selected=new HashSet<string>(current??new string[0],StringComparer.OrdinalIgnoreCase);if(allow)selected.Add(exact);else selected.Remove(exact);var result=new List<string>(selected);result.Sort(StringComparer.Ordinal);return result.ToArray();}
}
