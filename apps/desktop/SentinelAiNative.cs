using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Web.Script.Serialization;

// Provider secrets only cross native Windows UI -> Credential Manager -> fixed NVIDIA HTTPS endpoint.
// Credential Manager is a per-user boundary, not isolation from other applications running as that user.
public sealed class SentinelAiNative {
 const string Target="LoopTryx/Sentinel/NVIDIA-NIM/v1";
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Credential{public uint Flags,Type;public string TargetName,Comment;public long LastWritten;public uint BlobSize;public IntPtr Blob;public uint Persist,AttributeCount;public IntPtr Attributes;public string Alias,UserName;}
 [DllImport("advapi32",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CredRead(string target,uint type,uint flags,out IntPtr value);
 [DllImport("advapi32",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CredWrite(ref Credential value,uint flags);
 [DllImport("advapi32",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CredDelete(string target,uint type,uint flags);
 [DllImport("advapi32")]static extern void CredFree(IntPtr value);
 readonly SentinelNim provider=new SentinelNim();
 CancellationTokenSource active;int epoch;string model=SentinelNim.DefaultModel;int timeout=45;
 readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=65536,RecursionLimit=12};
 static string Read(string target){IntPtr p;if(!CredRead(target,1,0,out p)){if(Marshal.GetLastWin32Error()==1168)return null;throw new SentinelAiException("credential_store_unavailable");}try{var c=(Credential)Marshal.PtrToStructure(p,typeof(Credential));if(c.BlobSize>5120||c.BlobSize%2!=0)throw new SentinelAiException("credential_store_unavailable");return Marshal.PtrToStringUni(c.Blob,(int)c.BlobSize/2);}finally{CredFree(p);}}
 static void Save(string target,string value){byte[] bytes=Encoding.Unicode.GetBytes(value);IntPtr p=Marshal.AllocHGlobal(bytes.Length);try{Marshal.Copy(bytes,0,p,bytes.Length);var c=new Credential{Type=1,TargetName=target,BlobSize=(uint)bytes.Length,Blob=p,Persist=2,UserName=System.Security.Principal.WindowsIdentity.GetCurrent().Name};if(!CredWrite(ref c,0))throw new SentinelAiException("credential_store_unavailable");}finally{for(int i=0;i<bytes.Length;i++)Marshal.WriteByte(p,i,0);Array.Clear(bytes,0,bytes.Length);Marshal.FreeHGlobal(p);}}
 public SentinelAiNative(){try{string m=Read(Target+"/model");if(m!=null){SentinelNim.ValidateModel(m);model=m;}int t;if(int.TryParse(Read(Target+"/timeout"),out t)&&t>=10&&t<=90)timeout=t;}catch{}}
 public object Status(){return new{provider="NVIDIA NIM",model=model,configured=Read(Target)!=null,busy=active!=null,timeoutSeconds=timeout,retention="Current console session only"};}
 public void Cancel(){if(active!=null)active.Cancel();}
 public object Remove(){epoch++;Cancel();if(!CredDelete(Target,1,0)&&Marshal.GetLastWin32Error()!=1168)throw new SentinelAiException("credential_store_unavailable");return Status();}
 public object Settings(Window owner){
  var dialog=new Window{Owner=owner,Title="SentinelAI · NVIDIA settings",Width=530,Height=420,ResizeMode=ResizeMode.NoResize,WindowStartupLocation=WindowStartupLocation.CenterOwner};
  var panel=new StackPanel{Margin=new Thickness(22)};dialog.Content=panel;
  panel.Children.Add(new TextBlock{Text="NVIDIA API key",Margin=new Thickness(0,0,0,8)});
  var secret=new PasswordBox{MaxLength=2500};panel.Children.Add(secret);
  panel.Children.Add(new TextBlock{Text="Leave blank to keep your key. Chat and flagged-message explanations use NVIDIA.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,8,0,14)});
  panel.Children.Add(new TextBlock{Text="Chat-completions model identifier"});
  var input=new TextBox{Text=model,MaxLength=120,Margin=new Thickness(0,8,0,12)};panel.Children.Add(input);
  panel.Children.Add(new TextBlock{Text="Request timeout (10–90 seconds)"});var seconds=new TextBox{Text=timeout.ToString(),MaxLength=2};panel.Children.Add(seconds);
  var status=new TextBlock{TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,12,0,12)};panel.Children.Add(status);
  var save=new Button{Content="Save settings",Padding=new Thickness(12,8,12,8)};panel.Children.Add(save);
  save.Click+=delegate{try{SentinelNim.ValidateModel(input.Text);int t;if(!int.TryParse(seconds.Text,out t)||t<10||t>90)throw new SentinelAiException("invalid_timeout");string k=secret.Password;if(k.Length>0){if(k.Length>2500||System.Text.RegularExpressions.Regex.IsMatch(k,"[\\s\\x00-\\x1f]"))throw new SentinelAiException("invalid_key_format");epoch++;Cancel();Save(Target,k);}Save(Target+"/model",input.Text);Save(Target+"/timeout",t.ToString());model=input.Text;timeout=t;secret.Clear();dialog.DialogResult=true;}catch(SentinelAiException e){status.Text=e.Code;}};
  dialog.ShowDialog();secret.Clear();return Status();
 }
 public async Task<object> Send(Window owner,string question,object finding,bool test){
  if(active!=null)throw new SentinelAiException("request_busy");
  if(question==null||question.Length<1||question.Length>2000)throw new SentinelAiException("invalid_question");
  // Build the bounded request in native code; no credential reaches the renderer.
  var context=new{question=question,finding=finding};string payload=SentinelNim.Payload(model,context);
  string chosenModel=model;int generation=epoch;
  var refs=new List<string>();var f=finding as Dictionary<string,object>;
  if(f!=null){var signals=f["signals"] as IList;if(signals!=null)foreach(Dictionary<string,object> s in signals)refs.Add((string)s["code"]);}
  // Owner-requested automatic AI flow. The fixed native endpoint, key boundary,
  // cancellation and bounded payload validation remain enforced.
  if(generation!=epoch)throw new SentinelAiException("configuration_changed");
  string key=Read(Target);if(key==null)throw new SentinelAiException("key_not_configured");
  active=new CancellationTokenSource(TimeSpan.FromSeconds(timeout));
  try{object response=await provider.Generate(key,chosenModel,payload,true,refs.ToArray(),active.Token);if(generation!=epoch)throw new SentinelAiException("configuration_changed");return new{provider="NVIDIA NIM",model=chosenModel,kind="provider_interpretation",answer=response};}
  finally{active.Dispose();active=null;key=null;}
 }
}

