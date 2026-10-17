using System;
using Microsoft.Win32;
internal static class UsbLegacyReleasedBaselineTest {
 static void Refuse(Action action){try{action();}catch{return;}throw new Exception("Expected refusal");}
 static int Main(){string path=@"Software\SentinelLegacyBaselineTest\"+Guid.NewGuid().ToString("N"),nonce=new string('a',32);try{using(var key=Registry.CurrentUser.CreateSubKey(path)){
 key.SetValue("SentinelOperation",nonce);key.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);key.SetValue("DenyInstanceIDsRetroactive",1,RegistryValueKind.DWord);using(var list=key.CreateSubKey("DenyInstanceIDs")){}
 UsbLegacyReleasedBaseline.ValidatePreservedValues(key,nonce);
 key.SetValue("SentinelAdmissionOperation",new string('b',32));UsbLegacyReleasedBaseline.ValidatePreservedValues(key,nonce);
 Refuse(()=>UsbLegacyReleasedBaseline.ValidatePreservedValues(key,new string('b',32)));
 using(var list=key.OpenSubKey("DenyInstanceIDs",true))list.SetValue("1","USB\\SYNTHETIC");Refuse(()=>UsbLegacyReleasedBaseline.ValidatePreservedValues(key,nonce));using(var list=key.OpenSubKey("DenyInstanceIDs",true))list.DeleteValue("1");
 key.SetValue("DenyInstanceIDs",0,RegistryValueKind.DWord);Refuse(()=>UsbLegacyReleasedBaseline.ValidatePreservedValues(key,nonce));key.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);
 key.SetValue("DenyInstanceIDsRetroactive","1");Refuse(()=>UsbLegacyReleasedBaseline.ValidatePreservedValues(key,nonce));
 }Console.WriteLine("PASS exact legacy baseline preservation rejects drift; no machine policy changed");return 0;}finally{Registry.CurrentUser.DeleteSubKeyTree(path,false);}}
}
