using System;
using System.IO;
using System.Text;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Collections;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Native-only, bounded per-user history. This is not a credential vault:
// DPAPI protects stored bytes, not access by another process as the same user.
internal sealed class SentinelAiHistory {
 readonly string path;
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes("SentinelAI history v1");
 internal SentinelAiHistory():this(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","PrivateHistory","chats.dat")){}
 internal SentinelAiHistory(string file){path=Path.GetFullPath(file);}
 void Check(){for(string p=path;p!=null;p=Path.GetDirectoryName(p))if((File.Exists(p)||Directory.Exists(p))&&(File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw new IOException("History path is redirected");}
 static void Validate(string raw){
  if(raw==null||Encoding.UTF8.GetByteCount(raw)>2097152)throw new InvalidOperationException("History is too large");
  var data=new JavaScriptSerializer{MaxJsonLength=2097152,RecursionLimit=12}.Deserialize<Dictionary<string,object>>(raw);
  var chats=data!=null&&data.ContainsKey("chats")?data["chats"] as ArrayList:null;
  if(data==null||data.Count!=2||!data.ContainsKey("schemaVersion")||!Equals(data["schemaVersion"],1)||chats==null||chats.Count>24)throw new InvalidOperationException("Invalid history");
 }
 internal string Load(){Check();if(!File.Exists(path))return "{\"schemaVersion\":1,\"chats\":[]}";if(new FileInfo(path).Length>2200000)throw new InvalidOperationException("History is too large");var bytes=ProtectedData.Unprotect(File.ReadAllBytes(path),Entropy,DataProtectionScope.CurrentUser);try{string raw=Encoding.UTF8.GetString(bytes);Validate(raw);return raw;}finally{Array.Clear(bytes,0,bytes.Length);}}
 internal void Save(string raw){
  Validate(raw);Check();var directory=Path.GetDirectoryName(path);Directory.CreateDirectory(directory);Check();
  var owner=WindowsIdentity.GetCurrent().User;
  var acl=new FileSecurity();acl.SetAccessRuleProtection(true,false);acl.SetOwner(owner);acl.AddAccessRule(new FileSystemAccessRule(owner,FileSystemRights.FullControl,AccessControlType.Allow));acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),FileSystemRights.FullControl,AccessControlType.Allow));
  byte[] plain=Encoding.UTF8.GetBytes(raw);byte[] encrypted;try{encrypted=ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser);}finally{Array.Clear(plain,0,plain.Length);}
  string temp=path+"."+Guid.NewGuid().ToString("N")+".tmp";
  try{using(var file=new FileStream(temp,FileMode.CreateNew,FileSystemRights.FullControl,FileShare.None,4096,FileOptions.WriteThrough,acl)){file.Write(encrypted,0,encrypted.Length);file.Flush(true);}Check();if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);File.SetAccessControl(path,acl);}finally{if(File.Exists(temp))File.Delete(temp);}
 }
 internal void Clear(){Check();if(File.Exists(path))File.Delete(path);}
}
