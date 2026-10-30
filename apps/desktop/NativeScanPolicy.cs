using System;using System.IO;
internal static class NativeScanPolicy {
 internal static bool Candidate(string root,string path){try{string full=Path.GetFullPath(path);if(full.StartsWith("E:",StringComparison.OrdinalIgnoreCase)||!full.StartsWith(Path.GetFullPath(root).TrimEnd('\\')+"\\",StringComparison.OrdinalIgnoreCase))return false;string ext=Path.GetExtension(full).ToLowerInvariant();return ext!=".crdownload"&&ext!=".part"&&ext!=".partial"&&ext!=".tmp"&&ext!=".download";}catch{return false;}}
 internal static bool SystemScope(string[] volumes){foreach(string volume in volumes)if(volume.StartsWith("E:",StringComparison.OrdinalIgnoreCase))return false;return true;}
 internal static string ExitState(int code){return code==0?"completed":code==2?"attention":"failed";}
 internal static bool NoLinks(string path){try{string current=Path.GetFullPath(path);while(!string.IsNullOrEmpty(current)){if((File.GetAttributes(current)&FileAttributes.ReparsePoint)!=0)return false;current=Path.GetDirectoryName(current);}return true;}catch{return false;}}
}
