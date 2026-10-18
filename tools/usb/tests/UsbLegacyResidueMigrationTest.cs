using System;
using System.IO;
using Microsoft.Win32;
internal static class UsbLegacyResidueMigrationTest {
 static void Check(bool value){if(!value)throw new Exception("Legacy cleanup fixture failed.");}
 static void Refuses(Action action){bool refused=false;try{action();}catch{refused=true;}Check(refused);}
 static void Seed(RegistryKey root,string path,string nonce){using(var key=root.CreateSubKey(path)){key.SetValue("SentinelOperation",nonce,RegistryValueKind.String);key.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);key.SetValue("DenyInstanceIDsRetroactive",1,RegistryValueKind.DWord);using(var list=key.CreateSubKey("DenyInstanceIDs")){} }}
 static void Original(RegistryKey root,string path){using(var key=root.OpenSubKey(path))using(var child=key.OpenSubKey("DenyInstanceIDs"))Check(key.ValueCount==3&&key.SubKeyCount==1&&child.ValueCount==0&&child.SubKeyCount==0);}
 static int Main(){int phase=0;string nonce=Guid.NewGuid().ToString("N"),path=@"Software\SentinelLegacyResidueTest\"+nonce;using(var root=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64)){
  try{
   Seed(root,path,nonce);for(int step=1;step<=5;step++){phase=step;int failure=step;Refuses(()=>UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{},failure));Original(root,path);}
   Refuses(()=>UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{throw new IOException("Quiescence changed.");},0));Original(root,path);
   using(var key=root.OpenSubKey(path,true))key.SetValue("Foreign",7);Refuses(()=>UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{},0));using(var key=root.OpenSubKey(path,true)){Check((int)key.GetValue("Foreign")==7);key.DeleteValue("Foreign");}
   using(var key=root.OpenSubKey(path+@"\DenyInstanceIDs",true))key.SetValue("1",@"USB\VID_0001&PID_0001\SYNTHETIC");Refuses(()=>UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{},0));using(var key=root.OpenSubKey(path+@"\DenyInstanceIDs",true))key.DeleteValue("1");
   using(var key=root.OpenSubKey(path,true))key.SetValue("SentinelOperation",new string('b',32));Refuses(()=>UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{},0));using(var key=root.OpenSubKey(path,true))key.SetValue("SentinelOperation",nonce);
   phase=99;UsbLegacyResidueMigration.TestCleanup(path,nonce,()=>{},0);using(var key=root.OpenSubKey(path))Check(key.ValueCount==0&&key.SubKeyCount==0);
   Console.WriteLine("Released-residue KTM fixture PASS: all five interruption stages rollback, quiescence change, foreign/active/marker refusal, exact empty cleanup");return 0;
  }catch(Exception error){Console.WriteLine("Migration fixture refused at phase "+phase+" category "+error.GetType().Name+" status "+error.HResult+" native "+(error is System.ComponentModel.Win32Exception?((System.ComponentModel.Win32Exception)error).NativeErrorCode:0));return 1;}finally{root.DeleteSubKeyTree(path,false);}
 }}
}
