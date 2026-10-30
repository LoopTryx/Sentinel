using System;using System.Threading;using System.Web.Script.Serialization;using System.Collections.Generic;
class ScanModeAcceptance {
 static Dictionary<string,object> Read(NativeSecurity security){return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(new JavaScriptSerializer().Serialize(security.Snapshot()));}
 static int Main(string[] args){using(var security=new NativeSecurity(null)){
  for(int i=0;i<30&&!Convert.ToBoolean(Read(security)["available"]);i++)Thread.Sleep(1000);
  if(!Convert.ToBoolean(Read(security)["available"]))throw new Exception("Sentinel worker unavailable");
  string mode=args.Length==0?"quick":args[0];security.Scan(mode);
  bool cancelled=false;for(int i=0;i<180;i++){Thread.Sleep(1000);var snapshot=Read(security);var scan=(Dictionary<string,object>)snapshot["scan"];
   if(i%15==0)Console.WriteLine("Progress: "+new JavaScriptSerializer().Serialize(scan));
   if(mode=="full"&&i==7){security.Cancel();cancelled=true;}
   if((string)scan["state"]!="scanning"){Console.WriteLine(new JavaScriptSerializer().Serialize(snapshot));string state=(string)scan["state"];if(state=="failed"||(!cancelled&&state!="completed"&&state!="incomplete"))throw new Exception("Unexpected scan outcome");if(cancelled&&state!="cancelled")throw new Exception("Stop was not acknowledged");Console.WriteLine(mode+" native Sentinel scan "+state+" PASS");return 0;}
  }security.Cancel();throw new Exception("Acceptance deadline exceeded");
 }}
}
