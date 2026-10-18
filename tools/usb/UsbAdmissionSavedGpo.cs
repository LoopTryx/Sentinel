using System;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

// Private native saved-GPO qualification adapter. No live DeviceInstall entry point.
public static class UsbAdmissionSavedGpo {
 static string Path(string nonce){if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid private operation");return @"SOFTWARE\Sentinel\UsbAdmissionProbe\"+nonce;}
 public static void EditPrivate(string nonce,byte[] compiledPlan,bool hold){
  string path=Path(nonce);var values=UsbSavedAdmissionEntry.DecodePlan(compiledPlan);
  SentinelDuckyLocalGpo.Session(false,(root,save)=>UsbSavedAdmissionEntry.Edit(root,path,nonce,values,hold,save,()=>{},0));
 }
 public static string PrivateState(string nonce,byte[] compiledPlan,out string unrelatedDigest){
  string path=Path(nonce),state="missing",digest=null;var values=UsbSavedAdmissionEntry.DecodePlan(compiledPlan);
  SentinelDuckyLocalGpo.Session(true,(root,save)=>{
   digest=SentinelDuckyLocalGpo.Digest(root,path);
   using(var key=root.OpenSubKey(path)){
    if(key==null)return;
    if((string)key.GetValue("SentinelAdmissionOperation",null)!=nonce)throw new InvalidOperationException("Private owner drift");
    bool armed=true,released=true;
    foreach(var value in values)using(var child=value.Key==""?null:key.OpenSubKey(value.Key)){
     var current=child??key;if(value.Key!=""&&child==null){armed=false;released=false;continue;}
     object actual=current.GetValue(value.Name,null);
     bool equal=value.Kind==4?actual is int&&(int)actual==1:actual is string&&(string)actual==Encoding.Unicode.GetString(value.Data).TrimEnd('\0');
     if(!equal)armed=false;
     if(actual!=null||!(current.GetValue("**Del."+value.Name,null) is string)||(string)current.GetValue("**Del."+value.Name)!="")released=false;
    }
    state=armed?"armed":released?"released":"partial";
   }
  });unrelatedDigest=digest;return state;
 }
}
