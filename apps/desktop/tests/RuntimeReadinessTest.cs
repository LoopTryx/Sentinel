using System;using System.Collections.Generic;
class RuntimeReadinessTest {
 static Dictionary<string,object> State(object mode,object connected){return new Dictionary<string,object>{{"mode",mode},{"connected",connected}};}
 static int Main(){
  if(!RuntimeReadiness.Accept(State("synthetic_demo",true)))throw new Exception("Demo runtime refused");
  if(!RuntimeReadiness.Accept(State("encrypted_vault",true)))throw new Exception("Real encrypted vault runtime refused");
  foreach(var mode in new object[]{"unknown",null,123})if(RuntimeReadiness.Accept(State(mode,true)))throw new Exception("Unknown runtime accepted");
  foreach(var connected in new object[]{false,"true",null})if(RuntimeReadiness.Accept(State("encrypted_vault",connected)))throw new Exception("Disconnected/malformed runtime accepted");
  if(RuntimeReadiness.Accept(null)||RuntimeReadiness.Accept(new Dictionary<string,object>()))throw new Exception("Missing state accepted");
  Console.WriteLine("PASS both supported runtime modes and fail-closed malformed/disconnected state.");return 0;
 }
}
