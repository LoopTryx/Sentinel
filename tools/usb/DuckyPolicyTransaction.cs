using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

// Independent exact-instance policy adapter. All writes use a single KTM transaction.
public static class SentinelDuckyPolicy {
 const string Live = "SOFTWARE\\Policies\\Microsoft\\Windows\\DeviceInstall\\Restrictions";
 const int Access = 0x2001f | 0x100; // read/write plus 64-bit registry view
 [DllImport("KtmW32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateTransaction(IntPtr a,IntPtr b,int c,int d,int e,int timeout,string description);
 [DllImport("KtmW32.dll", SetLastError=true)] static extern bool CommitTransaction(IntPtr transaction);
 [DllImport("KtmW32.dll", SetLastError=true)] static extern bool RollbackTransaction(IntPtr transaction);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegCreateKeyTransacted(IntPtr root,string path,int reserved,string cls,int options,int access,IntPtr security,out IntPtr key,out int disposition,IntPtr tx,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegOpenKeyTransacted(IntPtr root,string path,int options,int access,out IntPtr key,IntPtr tx,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegDeleteKeyTransacted(IntPtr root,string path,int view,int reserved,IntPtr tx,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegSetValueEx(IntPtr key,string name,int reserved,int type,byte[] data,int length);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegQueryValueEx(IntPtr key,string name,IntPtr reserved,out int type,byte[] data,ref int length);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegQueryInfoKey(IntPtr key,IntPtr cls,IntPtr clsLength,IntPtr reserved,out int subkeys,IntPtr maxSubkey,IntPtr maxClass,out int values,IntPtr maxName,IntPtr maxValue,IntPtr security,IntPtr time);
 [DllImport("advapi32.dll")] static extern int RegCloseKey(IntPtr key);
 static void Check(int code){if(code!=0)throw new Win32Exception(code,"Registry transaction failed");}
 static IntPtr Hive(bool machine){return new IntPtr(machine ? unchecked((int)0x80000002) : unchecked((int)0x80000001));}
 public static void Validate(string path,string target,string nonce){
  if(nonce==null || !Regex.IsMatch(nonce,@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid nonce");
  if(target==null || !Regex.IsMatch(target,@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z"))throw new ArgumentException("Invalid exact target");
  if(path!=Live && path!="SOFTWARE\\Sentinel\\DuckyPolicyProbe\\"+nonce)throw new ArgumentException("Invalid policy namespace");
 }
 static IntPtr Begin(){IntPtr t=CreateTransaction(IntPtr.Zero,IntPtr.Zero,0,0,0,30000,"Sentinel exact USB policy");if(t==new IntPtr(-1) || t==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());return t;}
 static void Finish(IntPtr tx){if(!CommitTransaction(tx))throw new Win32Exception(Marshal.GetLastWin32Error(),"Policy transaction did not commit");}
 static void Set(IntPtr key,string name,int type,byte[] bytes){int code=RegSetValueEx(key,name,0,type,bytes,bytes.Length);if(code!=0)throw new Win32Exception(code,"Set "+name);}
 static void Text(IntPtr key,string name,string value){Set(key,name,1,Encoding.Unicode.GetBytes(value+"\0"));}
 static void Number(IntPtr key,string name){Set(key,name,4,BitConverter.GetBytes(1));}
 static void Fault(int requested,int current){if(requested==current)throw new InvalidOperationException("Injected transaction abort");}
 public static void Apply(string path,string target,string nonce,bool machine,int failStep){
  Validate(path,target,nonce);if(path==Live && !machine)throw new ArgumentException("Live policy requires machine hive");
  if(failStep<0 || failStep>4)throw new ArgumentException("Invalid failure stage");
  IntPtr tx=Begin(), key=IntPtr.Zero,list=IntPtr.Zero;
  try {
   int disposition;int createCode=RegCreateKeyTransacted(Hive(machine),path,0,null,0,Access,IntPtr.Zero,out key,out disposition,tx,IntPtr.Zero);if(createCode!=0)throw new Win32Exception(createCode,"Create policy root");
   if(disposition!=1)throw new InvalidOperationException("Existing policy namespace; no changes allowed");
   Text(key,"SentinelOperation",nonce);Fault(failStep,1);
   Check(RegCreateKeyTransacted(key,"DenyInstanceIDs",0,null,0,Access,IntPtr.Zero,out list,out disposition,tx,IntPtr.Zero));
   if(disposition!=1)throw new InvalidOperationException("Existing device list");
   Text(list,"1",target);Fault(failStep,2);
   Number(key,"DenyInstanceIDsRetroactive");Fault(failStep,3);
   Number(key,"DenyInstanceIDs");Fault(failStep,4);
   Finish(tx);
  }finally{if(list!=IntPtr.Zero)RegCloseKey(list);if(key!=IntPtr.Zero)RegCloseKey(key);RollbackTransaction(tx);CloseHandle(tx);}
 }
 static void Count(IntPtr key,int expectedSubkeys,int expectedValues){int subkeys,values;Check(RegQueryInfoKey(key,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,out subkeys,IntPtr.Zero,IntPtr.Zero,out values,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero));if(subkeys!=expectedSubkeys || values!=expectedValues)throw new InvalidOperationException("Foreign policy schema; restore refused");}
 static void Value(IntPtr key,string name,int expectedType,byte[] expected){byte[] actual=new byte[1024];int type,size=actual.Length;Check(RegQueryValueEx(key,name,IntPtr.Zero,out type,actual,ref size));if(type!=expectedType || size!=expected.Length)throw new InvalidOperationException("Policy ownership or value changed");for(int i=0;i<size;i++)if(actual[i]!=expected[i])throw new InvalidOperationException("Policy ownership or value changed");}
 public static void Restore(string path,string target,string nonce,bool machine){
  Validate(path,target,nonce);if(path==Live && !machine)throw new ArgumentException("Live policy requires machine hive");
  IntPtr tx=Begin(),key=IntPtr.Zero,list=IntPtr.Zero;
  try {
   int code=RegOpenKeyTransacted(Hive(machine),path,0,Access,out key,tx,IntPtr.Zero);if(code==2)return;Check(code);
   Count(key,1,3);Value(key,"SentinelOperation",1,Encoding.Unicode.GetBytes(nonce+"\0"));
   Value(key,"DenyInstanceIDs",4,BitConverter.GetBytes(1));Value(key,"DenyInstanceIDsRetroactive",4,BitConverter.GetBytes(1));
   Check(RegOpenKeyTransacted(Hive(machine),path+"\\DenyInstanceIDs",0,Access,out list,tx,IntPtr.Zero));
   Count(list,0,1);Value(list,"1",1,Encoding.Unicode.GetBytes(target+"\0"));
   // Transacted deletion conflicts with concurrent non-transacted writes rather than removing them.
   Check(RegDeleteKeyTransacted(Hive(machine),path+"\\DenyInstanceIDs",0x100,0,tx,IntPtr.Zero));
   Check(RegDeleteKeyTransacted(Hive(machine),path,0x100,0,tx,IntPtr.Zero));
   Finish(tx);
  }finally{if(list!=IntPtr.Zero)RegCloseKey(list);if(key!=IntPtr.Zero)RegCloseKey(key);RollbackTransaction(tx);CloseHandle(tx);}
 }
}
