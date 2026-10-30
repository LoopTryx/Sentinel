using System;
class NativeSecurityPolicyTest {
 static void Check(bool ok,string label){if(!ok)throw new Exception(label);}
 static int Main(){
  Check(!NativeScanPolicy.Candidate("C:\\Users\\owner\\Downloads", "E:\\file.exe"),"protected drive");
  Check(!NativeScanPolicy.Candidate("C:\\Users\\owner\\Downloads", "C:\\Users\\owner\\Downloads-other\\x.exe"),"sibling prefix");
  Check(!NativeScanPolicy.Candidate("C:\\Users\\owner\\Downloads", "C:\\Users\\owner\\Downloads\\x.crdownload"),"unfinished download");
  Check(!NativeScanPolicy.Candidate("C:\\Users\\owner\\Downloads", "C:\\Users\\owner\\Downloads\\..\\x.exe"),"escaped directory");
  Check(NativeScanPolicy.Candidate("C:\\Users\\owner\\Downloads", "C:\\Users\\owner\\Downloads\\x.txt"),"completed candidate");
  Check(!NativeScanPolicy.SystemScope(new[]{"C:\\","E:\\"}),"protected mounted volume");
  Check(NativeScanPolicy.SystemScope(new[]{"C:\\"}),"system scope");
  Check(NativeScanPolicy.ExitState(0)=="completed"&&NativeScanPolicy.ExitState(2)=="attention"&&NativeScanPolicy.ExitState(5)=="failed","no false clean exit mapping");
  Console.WriteLine("Native scan scope and result policy PASS");return 0;
 }
}
