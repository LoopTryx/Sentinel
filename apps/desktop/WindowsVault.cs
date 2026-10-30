using System;
using System.IO;
using System.Text;
using System.Net.Http;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;

// DPAPI protects the random vault secret for this Windows user. Hello authorizes
// each action in the native broker. This is not a claim of TPM-bound encryption.
internal static class WindowsVault {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=131072};
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes("Sentinel.WindowsVault.v1");
 static Dictionary<string,string> Config(){
  string path=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"demo-runtime.json");
  if(new FileInfo(path).Length>4096)throw new IOException("Desktop configuration unavailable.");
  var c=Json.Deserialize<Dictionary<string,string>>(File.ReadAllText(path));Uri u;
  if(!Uri.TryCreate(c["url"],UriKind.Absolute,out u)||u.Scheme!="http"||u.Host!="127.0.0.1"||u.Port<1024||u.Port>65535||u.AbsolutePath!="/"||u.Query.Length!=0||u.UserInfo.Length!=0||!Regex.IsMatch(c["token"],"^[a-f0-9]{64}$")||!Regex.IsMatch(c["nativeActionToken"],"^[a-f0-9]{64}$"))throw new IOException("Desktop configuration unavailable.");
  return c;
 }
 static async Task<Dictionary<string,object>> Call(Dictionary<string,string> c,string action,object data){
  using(var client=new HttpClient(new HttpClientHandler{UseProxy=false,AllowAutoRedirect=false})){
   client.Timeout=TimeSpan.FromSeconds(15);client.MaxResponseContentBufferSize=131072;
   client.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",c["token"]);client.DefaultRequestHeaders.Add("X-Sentinel-Native-Action",c["nativeActionToken"]);
   using(var response=await client.PostAsync(c["url"]+"/password-vault",new StringContent(Json.Serialize(new{action,data}),Encoding.UTF8,"application/json"))){
    var result=Json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync());if(!response.IsSuccessStatusCode||result.ContainsKey("error"))throw new IOException(result.ContainsKey("error")?Convert.ToString(result["error"]):"Vault unavailable.");return result;
   }
  }
 }
 static string KeyPath(Dictionary<string,string> c){
  string vault=Path.GetFullPath(c["vaultPath"]),profile=Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)).TrimEnd('\\')+"\\";
  if(!vault.StartsWith(profile,StringComparison.OrdinalIgnoreCase)||!vault.EndsWith("\\Sentinel\\Passwords\\vault.json",StringComparison.OrdinalIgnoreCase))throw new IOException("Vault location unavailable.");
  for(string p=Path.GetDirectoryName(vault);p!=null&&p.StartsWith(profile,StringComparison.OrdinalIgnoreCase);p=Path.GetDirectoryName(p))if(Directory.Exists(p)&&(File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw new IOException("Vault location must be a local folder.");
  return Path.Combine(Path.GetDirectoryName(vault),"windows-key.bin");
 }
 static string ReadSecret(string path){if(new FileInfo(path).Length>4096||(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new IOException("Vault key unavailable.");byte[] plain=ProtectedData.Unprotect(File.ReadAllBytes(path),Entropy,DataProtectionScope.CurrentUser);try{return Encoding.UTF8.GetString(plain);}finally{Array.Clear(plain,0,plain.Length);}}
 static string ArchiveLegacy(string path){
  if(!File.Exists(path))return null;
  var info=new FileInfo(path);if(info.Length>1048576||(info.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("Existing vault could not be preserved safely.");
  string archive=Path.Combine(Path.GetDirectoryName(path),"vault.legacy-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N")+".json");File.Move(path,archive);return archive;
 }
 static void CreatePending(string path){
  string temp=path+"."+Guid.NewGuid().ToString("N")+".tmp";byte[] random=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(random);byte[] plain=Encoding.UTF8.GetBytes(Convert.ToBase64String(random));Array.Clear(random,0,random.Length);
  try{byte[] blob=ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser);using(var file=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){file.Write(blob,0,blob.Length);file.Flush(true);}File.Move(temp,path);}finally{Array.Clear(plain,0,plain.Length);if(File.Exists(temp))File.Delete(temp);}
 }
 // Recovery is inside the existing Hello-approved action. Never replace ciphertext on key failure.
 static async Task UnlockKnownKeys(string key,Func<string,Task> unlock){
  try{await unlock(ReadSecret(key));return;}catch(IOException e){if(e.Message!="vault_unlock_failed")throw;}
  string pending=key+".pending";if(!File.Exists(pending))throw new IOException("vault_unlock_failed");
  string recovery=ReadSecret(pending);await Task.Delay(1100);await unlock(recovery);
  File.Replace(pending,key,key+".previous-"+Guid.NewGuid().ToString("N"));
 }
 static async Task Unlock(Window owner,Dictionary<string,string> c){
  string key=KeyPath(c),pending=key+".pending";Directory.CreateDirectory(Path.GetDirectoryName(key));
  if(File.Exists(key)){await UnlockKnownKeys(key,async secret=>{await Call(c,"unlock",new{passphrase=secret});});return;}
  if(!File.Exists(pending))CreatePending(pending);
  string next=ReadSecret(pending);
  var status=await Call(c,"status",new{});
  if(status.ContainsKey("locked")&&status["locked"] is bool&&!(bool)status["locked"]){await Call(c,"rekey",new{passphrase=next});File.Move(pending,key);return;}
  bool legacy=false;try{await Call(c,"unlock",new{passphrase=next});}
  catch(IOException error){if(error.Message!="vault_unlock_failed")throw;legacy=true;}
  if(legacy){
   string original=c["vaultPath"],archive=ArchiveLegacy(original);
   try{await Task.Delay(1100);await Call(c,"unlock",new{passphrase=next});}
   catch{if(archive!=null&&!File.Exists(original))File.Move(archive,original);throw;}
  }
  File.Move(pending,key);
 }
 internal static async Task<Dictionary<string,object>> Request(Window owner,string action,Dictionary<string,object> data){
  if(Array.IndexOf(new[]{"status","unlock","lock","list","save","fill","remove","edit","copy","rotate","autofill","matches"},action)<0)throw new IOException("Unsupported vault action.");
  if(action=="autofill"){Uri site;string origin=data.ContainsKey("origin")?data["origin"] as string:null;if(data.Count!=1||origin==null||origin.Length>2048||!Uri.TryCreate(origin,UriKind.Absolute,out site)||site.Scheme!="https"||site.UserInfo.Length!=0||site.Query.Length!=0||site.Fragment.Length!=0||site.AbsolutePath!="/"||site.GetLeftPart(UriPartial.Authority)!=origin)throw new IOException("Invalid website origin.");}
  var config=Config();
  if(action=="status"){var status=await Call(config,"status",new{});status["helloReady"]=File.Exists(KeyPath(config));return status;}
  if(action=="lock")return await Call(config,"lock",new{});
  if(action=="list"||action=="matches"){if(!File.Exists(KeyPath(config)))return action=="matches"?new Dictionary<string,object>{{"matches",false}}:new Dictionary<string,object>{{"accounts",new object[0]}};using(var listLease=PasswordActionLease.TryAcquire()){if(listLease==null)throw new IOException("Another vault action is waiting.");await Unlock(owner,config);return await Call(config,action,data);}}

  using(var lease=PasswordActionLease.TryAcquire()){
   if(lease==null)throw new IOException("Another vault action is waiting.");
   if(!await UsbOwnerVerification.Verify(new WindowInteropHelper(owner).Handle,"Verify to "+(action=="unlock"?"open your Sentinel vault":(action=="fill"||action=="autofill")?"use this saved login":"update your Sentinel vault")))throw new IOException("Windows Hello cancelled or unavailable.");
   await Unlock(owner,config);
   if(action=="unlock"){var result=await Call(config,"status",new{});result["accounts"]=(await Call(config,"list",new{}))["accounts"];result["helloReady"]=true;return result;}
   if(action=="autofill"){
    string origin=(string)data["origin"];var rows=new List<Dictionary<string,object>>();foreach(object raw in (System.Collections.IEnumerable)(await Call(config,"list",new{origin}))["accounts"]){var row=raw as Dictionary<string,object>;if(row!=null&&Convert.ToString(row["origin"])==origin)rows.Add(row);}
    if(rows.Count!=1)return new Dictionary<string,object>{{"accounts",rows}};
    var value=await Call(config,"fill",new{id=(string)rows[0]["id"],origin});value["automatic"]=true;return value;
   }
   if(action=="copy"||action=="rotate"){
    string id=data.ContainsKey("id")?data["id"] as string:null;if(data.Count!=1||!Regex.IsMatch(id??"","^[a-f0-9]{32}$"))throw new IOException("Invalid login.");
    if(action=="copy"){Dictionary<string,object> row=null;foreach(object raw in (System.Collections.IEnumerable)(await Call(config,"list",new{}))["accounts"]){var candidate=raw as Dictionary<string,object>;if(candidate!=null&&Convert.ToString(candidate["id"])==id)row=candidate;}if(row==null)throw new IOException("Login unavailable.");var secret=await Call(config,"fill",new{id,origin=(string)row["origin"]});Clipboard.SetText((string)secret["password"]);secret["password"]="";return new Dictionary<string,object>{{"ok",true}};}
    byte[] random=new byte[24];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(random);string password=Convert.ToBase64String(random);Array.Clear(random,0,random.Length);return await Call(config,"edit",new{id,patch=new{password}});
   }
   var actionResult=await Call(config,action,data);if(action=="save"||action=="edit"||action=="remove")actionResult["accounts"]=(await Call(config,"list",new{}))["accounts"];return actionResult;
  }
 }
 internal static object BrowserRequest(string action,Dictionary<string,object> data){
  if(action=="status"||action=="lock"||action=="list"||action=="matches")return Request(null,action,data).GetAwaiter().GetResult();
  Dictionary<string,object> result=null;Exception failure=null;
  // Invisible HWND owner gives Windows Hello its required parent without a second dialog.
  var owner=new Window{Width=1,Height=1,Left=-10000,Top=-10000,WindowStyle=WindowStyle.None,ResizeMode=ResizeMode.NoResize,ShowInTaskbar=false,ShowActivated=true,Opacity=0};
  owner.Loaded+=async delegate{await Task.Delay(150);try{if(!owner.Activate())throw new IOException("Click the Sentinel logo and try Windows Hello again.");result=await Request(owner,action,data);}catch(Exception e){failure=e;}finally{owner.Close();}};
  owner.ShowDialog();if(failure!=null)throw failure;if(result==null)throw new IOException("Vault action cancelled.");return result;
 }
}
