using System;
using Microsoft.Win32;

// Read-only advisory survey. Markers are observations, never ownership proof.
public static class UsbAdmissionPolicySurvey {
 const string Path=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 static readonly string[] SwitchNames={"AllowDenyLayered","AllowInstanceIDs","DenyInstanceIDs","DenyInstanceIDsRetroactive","AllowDeviceIDs","DenyDeviceIDs","DenyDeviceIDsRetroactive","AllowDeviceClasses","DenyDeviceClasses","DenyDeviceClassesRetroactive","DenyRemovableDevices","DenyUnspecified","AllowAdminInstall"};
 static readonly string[] ListNames={"AllowInstanceIDs","DenyInstanceIDs","AllowDeviceIDs","DenyDeviceIDs","AllowDeviceClasses","DenyDeviceClasses"};
 public sealed class Snapshot {
  public bool Present,Complete=true,LegacyMarkerPresent,AdmissionMarkerPresent;
  public int KnownSwitches,InvalidSwitches,KnownListValues,InvalidListValues,UnknownRootValues,UnknownSubkeys;
  public string FailureCode;
  // Switch state only: -1 absent, 0 disabled, 1 enabled, 2 unexpected.
  public int[] SwitchStates=new int[SwitchNames.Length];
  public Snapshot(){for(int i=0;i<SwitchStates.Length;i++)SwitchStates[i]=-1;}
 }
 public sealed class Result {public Snapshot Saved,Effective;public bool ReadComplete,KnownSwitchesMatch;public string FailureCode;public bool OwnershipVerified=false;}
 static bool Named(string[] names,string name){return Array.Exists(names,n=>string.Equals(n,name,StringComparison.OrdinalIgnoreCase));}
 public static Snapshot Read(RegistryKey root,string relativePath){
  var snapshot=new Snapshot();
  try{using(var key=root.OpenSubKey(relativePath)){
   if(key==null)return snapshot;snapshot.Present=true;
   string[] values=key.GetValueNames(),children=key.GetSubKeyNames();if(values.Length>256||children.Length>64)throw new InvalidOperationException("survey_bound");
   foreach(string name in values){
    if(name=="SentinelOperation"){snapshot.LegacyMarkerPresent=true;continue;}
    if(name=="SentinelAdmissionOperation"){snapshot.AdmissionMarkerPresent=true;continue;}
    int index=Array.FindIndex(SwitchNames,n=>n.Equals(name,StringComparison.OrdinalIgnoreCase));
    if(index<0){snapshot.UnknownRootValues++;continue;}
    snapshot.KnownSwitches++;object value=key.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);
    if(key.GetValueKind(name)==RegistryValueKind.DWord&&value is int&&((int)value==0||(int)value==1))snapshot.SwitchStates[index]=(int)value;
    else{snapshot.SwitchStates[index]=2;snapshot.InvalidSwitches++;}
   }
   foreach(string name in children){
    if(!Named(ListNames,name)){snapshot.UnknownSubkeys++;continue;}
    using(var list=key.OpenSubKey(name)){
     if(list==null)throw new InvalidOperationException("survey_changed");
     string[] entries=list.GetValueNames();if(entries.Length>256)throw new InvalidOperationException("survey_bound");
     if(list.SubKeyCount!=0)snapshot.UnknownSubkeys+=list.SubKeyCount;
     foreach(string entry in entries){snapshot.KnownListValues++;int number;bool deletion=entry.StartsWith("**Del.",StringComparison.Ordinal);string numeric=deletion?entry.Substring(6):entry;
      if(!int.TryParse(numeric,out number)||number<1||number>256||number.ToString()!=numeric||list.GetValueKind(entry)!=RegistryValueKind.String){snapshot.InvalidListValues++;continue;}
      object item=list.GetValue(entry,null,RegistryValueOptions.DoNotExpandEnvironmentNames);string text=item as string;
      if(text==null||text.Length>512||text.IndexOf('\0')>=0||(deletion?text.Length!=0:text.Length==0))snapshot.InvalidListValues++;
     }
    }
   }
  }}catch{snapshot.Complete=false;snapshot.FailureCode="survey_read_failed";}
  return snapshot;
 }
 public static bool MatchingSwitches(Snapshot saved,Snapshot effective){if(saved==null||effective==null||!saved.Complete||!effective.Complete||saved.InvalidSwitches!=0||effective.InvalidSwitches!=0)return false;for(int i=0;i<SwitchNames.Length;i++)if(saved.SwitchStates[i]!=effective.SwitchStates[i])return false;return true;}
 public static Result Collect(){
  var result=new Result();
  try{SentinelDuckyLocalGpo.Session(true,(root,save)=>{result.Saved=Read(root,Path);});}catch{result.FailureCode="saved_policy_unavailable";}
  result.Effective=Read(Registry.LocalMachine,Path);
  result.ReadComplete=result.Saved!=null&&result.Saved.Complete&&result.Effective.Complete;
  result.KnownSwitchesMatch=MatchingSwitches(result.Saved,result.Effective);return result;
 }
 static string Summary(Snapshot snapshot){if(snapshot==null)return "unavailable";return "present="+snapshot.Present+" complete="+snapshot.Complete+" knownSwitches="+snapshot.KnownSwitches+" invalidSwitches="+snapshot.InvalidSwitches+" listEntries="+snapshot.KnownListValues+" invalidLists="+snapshot.InvalidListValues+" unknownValues="+snapshot.UnknownRootValues+" unknownSubkeys="+snapshot.UnknownSubkeys+" legacyMarker="+snapshot.LegacyMarkerPresent+" admissionMarker="+snapshot.AdmissionMarkerPresent;}
 public static int Main(string[] args){if(args.Length!=0)return 2;Result result=Collect();Console.WriteLine("saved "+Summary(result.Saved));Console.WriteLine("effective "+Summary(result.Effective));Console.WriteLine("complete="+result.ReadComplete+" knownSwitchesMatch="+result.KnownSwitchesMatch+" ownershipVerified=False failure="+(result.FailureCode??"none"));return result.ReadComplete?0:1;}
}
