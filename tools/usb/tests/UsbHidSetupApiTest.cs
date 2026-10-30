using System;
public static class UsbHidSetupApiTest {
 static int assertions;static readonly string Id=@"USB\VID_1234&PID_5678\TEST";
 static void Yes(bool v,string label){assertions++;if(!v)throw new Exception(label);}
 static void Refused(Action a,string label){bool failed=false;try{a();}catch(InvalidOperationException){failed=true;}Yes(failed,label);}
 static UsbHidSetupApi.Node Node(bool disableable=true,uint problem=0,string cls="HIDClass",UsbHidSetupApi.Node[] children=null){return new UsbHidSetupApi.Node(Id,cls,new[]{@"USB\Class_03"},disableable,0,problem,children??new UsbHidSetupApi.Node[0]);}
 static UsbAdmissionInventory.Result Inventory(){return new UsbAdmissionInventory.Result{Complete=true,Preflight=new UsbAdmissionPreflight.Result{State="review_required",TopologyToken="fresh",Unresolved=0,Candidates=new[]{new UsbAdmissionPreflight.Candidate{Instance=Id,Category="external_approval_required"}}}};}
 sealed class Fake:UsbHidSetupApi.IRecoveryDevice {public UsbHidSetupApi.Node Current=Node();public int Calls,Error;public bool Restart,Enabled;public string Connector="external-port-A";public UsbHidSetupApi.Node Post;public string ReadConnector(string instance){return Connector;}public UsbHidSetupApi.Node Read(string id){return Current;}public int Change(string id,bool enable,out bool restart){Calls++;Enabled=enable;restart=Restart;Current=Post??Node(true,enable?0u:22u);return Error;}}
 static void Main(string[] args){
  if(args.Length==1&&args[0]=="--native-read-only"){var inventory=UsbAdmissionInventory.Collect(null);if(!inventory.Complete)throw new Exception("read_only_inventory_incomplete");int safe=0,refused=0;foreach(var c in inventory.Preflight.Candidates){if(c.Category!="external_approval_required")continue;try{var nativePlan=UsbHidSetupApi.Prepare(inventory,c.Instance);safe++;Console.WriteLine("SAFE external function "+safe+" disableable="+nativePlan.Disableable+" started="+((nativePlan.BeforeStatus&8)!=0)+" problem="+nativePlan.BeforeProblem);}catch(InvalidOperationException error){refused++;Console.WriteLine("REFUSED "+error.Message);}}Console.WriteLine("READ ONLY external safe="+safe+" refused="+refused+"; NO transitions");return;}
  Yes(UsbHidSetupApi.IsSafeTree(Node()),"simple HID");
  var child=new UsbHidSetupApi.Node(@"HID\VID_1234\CHILD","Keyboard",null,true,0,0,null);
  Yes(UsbHidSetupApi.IsSafeTree(Node(children:new[]{child})),"keyboard descendant");
  Yes(!UsbHidSetupApi.IsSafeTree(Node(cls:"USB")),"hub refused");
  Yes(!UsbHidSetupApi.IsSafeTree(Node(children:new[]{new UsbHidSetupApi.Node(@"USBSTOR\DISK","DiskDrive",null,true,0,0,null)})),"storage descendant refused");
  Yes(!UsbHidSetupApi.IsSafeTree(Node(children:new[]{child,child})),"duplicate tree refused");
  var fake=new Fake();var inv=Inventory();var plan=UsbHidSetupApi.Prepare(inv,Id,fake);Yes(plan.Instance==Id,"exact mapping");
  inv.Preflight.Candidates[0].Category="required_safety_candidate";Refused(()=>UsbHidSetupApi.Prepare(inv,Id,fake),"internal refused");
  inv=Inventory();inv.Preflight.Candidates=new[]{inv.Preflight.Candidates[0],inv.Preflight.Candidates[0]};Refused(()=>UsbHidSetupApi.Prepare(inv,Id,fake),"ambiguous refused");
  inv=Inventory();inv.Complete=false;Refused(()=>UsbHidSetupApi.Prepare(inv,Id,fake),"incomplete refused");
  int fences=0;var result=UsbHidSetupApi.ExecuteChecked(plan,false,()=>fences++,fake,Inventory());Yes(fake.Calls==1&&!fake.Enabled&&fences==3,"fence/change/readback");Yes(result.State=="Pending verification","API success never claims blocked");
  fake=new Fake{Current=Node(false)};result=UsbHidSetupApi.ExecuteChecked(plan,false,()=>{},fake,Inventory());Yes(result.State=="Failed"&&fake.Calls==0,"nondisableable refused before mutation");
  fake=new Fake{Error=5};result=UsbHidSetupApi.ExecuteChecked(plan,false,()=>{},fake,Inventory());Yes(result.State=="Failed"&&result.NativeError==5,"native error preserved");
  fake=new Fake{Restart=true};result=UsbHidSetupApi.ExecuteChecked(plan,false,()=>{},fake,Inventory());Yes(result.State=="Restart required","restart truthful");
  fake=new Fake();inv=Inventory();inv.Preflight.TopologyToken="changed";Refused(()=>UsbHidSetupApi.ExecuteChecked(plan,false,()=>{},fake,inv),"stale topology");Yes(fake.Calls==0,"stale no mutation");
  fake=new Fake();Refused(()=>UsbHidSetupApi.ExecuteChecked(plan,false,()=>{throw new InvalidOperationException();},fake,Inventory()),"authorization fence refusal");Yes(fake.Calls==0,"fence no mutation");
  result=UsbHidSetupApi.Classify(true,Node(true),false);Yes(result.State=="Pending verification","allowed API still needs input verification");
  result=UsbHidSetupApi.Classify(false,Node(true),false);Yes(result.State=="Failed","unchanged input fails disable");
    Yes(UsbHidSetupApi.IsRecoverySubset(Node(children:new[]{child}),Node()),"pruned descendant accepted");
    Yes(!UsbHidSetupApi.IsRecoverySubset(Node(),Node(children:new[]{child})),"new descendant refused");
  var child2=new UsbHidSetupApi.Node(@"HID\VID_1234\CHILD2","Mouse",null,true,0,0,null);
  var nested=new UsbHidSetupApi.Node(child.Id,"Keyboard",null,true,0,0,new[]{child2});
  Yes(!UsbHidSetupApi.IsRecoverySubset(Node(children:new[]{child,child2}),Node(children:new[]{nested})),"reparented known node refused");
  Yes(!UsbHidSetupApi.IsRecoverySubset(Node(children:new[]{child}),Node(children:new[]{new UsbHidSetupApi.Node(child.Id,"DiskDrive",null,true,0,0,null)})),"changed class refused");
  var original=Node(children:new[]{child});fake=new Fake{Current=original};var recoveryPlan=UsbHidSetupApi.Prepare(Inventory(),Id,fake);
  fake.Current=Node(problem:22);Yes(UsbHidSetupApi.InspectRecovery(recoveryPlan,()=>{},fake).Problem==22,"own disabled pruned node inspect");
  fake.Current=original;Yes(UsbHidSetupApi.InspectRecovery(recoveryPlan,()=>{},fake).Children.Length==1,"authenticated descendant reappears");
  fake.Connector="external-port-B";Refused(()=>UsbHidSetupApi.InspectRecovery(recoveryPlan,()=>{},fake),"changed connector refused");Yes(fake.Calls==0,"changed connector no mutation");
  fake.Connector="external-port-A";fake.Current=Node(children:new[]{child2});Refused(()=>UsbHidSetupApi.InspectRecovery(recoveryPlan,()=>{},fake),"foreign descendant refused");
  fake.Current=Node(problem:22);fake.Post=Node(children:new[]{child});result=UsbHidSetupApi.ExecuteRecovery(recoveryPlan,true,()=>{},fake);Yes(result.State=="Pending verification"&&fake.Enabled,"enable pruned and authenticated reappearance");
  var legacy=new UsbHidSetupApi.Plan(Id,"fresh",recoveryPlan.Tree);Refused(()=>UsbHidSetupApi.InspectRecovery(legacy,()=>{},fake),"legacy plan cannot authorize recovery");
  fake=new Fake{Current=Node(false)};var noDisable=UsbHidSetupApi.Prepare(Inventory(),Id,fake);result=UsbHidSetupApi.ExecuteRecovery(noDisable,false,()=>{},fake);Yes(result.State=="Failed"&&fake.Calls==0,"recovery cannot force nondisableable");
  Refused(()=>UsbHidSetupApi.InspectRecovery(recoveryPlan,()=>{throw new InvalidOperationException();},fake),"recovery fence refusal");
  Yes(UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},0,28,0)=="UninstalledUsbHid","classless uninstalled HID recognized from bus evidence");
  Yes(UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},0,1,0)=="UninstalledUsbHid","not configured HID recognized");
  Refused(()=>UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},8,28,0),"started root cannot infer uninstalled class");
  Refused(()=>UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},0,22,0),"disabled root cannot infer uninstalled class");
  Refused(()=>UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},0,28,1),"unknown descendants cannot infer class");
  Refused(()=>UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_08"},0,28,0),"storage bus class refused");
  Yes(UsbHidSetupApi.UninstalledClass(Id,new[]{@"USB\Class_03"},0x2000,28,0)=="UninstalledUsbHid","retained disableable flag is not a started driver");
  fake=new Fake{Current=new UsbHidSetupApi.Node(Id,"UninstalledUsbHid",new[]{@"USB\Class_03"},true,0x2000,28,null)};var uninstalled=UsbHidSetupApi.Prepare(Inventory(),Id,fake);Yes(UsbHidSetupApi.IsUninstalledPlan(uninstalled),"policy-only plan captures native uninstalled state");
  Refused(()=>UsbHidSetupApi.ExecuteRecovery(uninstalled,true,()=>{},fake),"policy-only plan cannot authorize recovery enable");Refused(()=>UsbHidSetupApi.ExecuteChecked(uninstalled,true,()=>{},fake,Inventory()),"policy-only plan cannot authorize ordinary enable");Yes(fake.Calls==0,"uninstalled representation never changes devices");
  fake.Current=Node(children:new[]{child});Yes(UsbHidSetupApi.InspectPolicyTransition(uninstalled,()=>{},fake,Inventory()).Children.Length==1,"read-only policy grant may observe installed HID descendants");
  fake.Connector="other-port";Refused(()=>UsbHidSetupApi.InspectPolicyTransition(uninstalled,()=>{},fake,Inventory()),"policy-only connector drift refused");fake.Connector="external-port-A";
  fake.Current=new UsbHidSetupApi.Node(Id,"HIDClass",new[]{@"USB\Class_03","changed descriptor"},true,8,0,null);Refused(()=>UsbHidSetupApi.InspectPolicyTransition(uninstalled,()=>{},fake,Inventory()),"policy-only bus descriptor drift refused");
  fake.Current=Node(children:new[]{new UsbHidSetupApi.Node(@"USBSTOR\DISK","DiskDrive",null,true,0,0,null)});Refused(()=>UsbHidSetupApi.InspectPolicyTransition(uninstalled,()=>{},fake,Inventory()),"policy-only unrelated child refused");
  fake=new Fake{Current=Node(children:new[]{child})};var deniedPlan=UsbHidSetupApi.Prepare(Inventory(),Id,fake);fake.Current=new UsbHidSetupApi.Node(Id,"UninstalledUsbHid",new[]{@"USB\Class_03"},true,0x2000,28,null);
  Yes(UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,Inventory()).Problem==28&&fake.Calls==0,"policy denial may observe original HID driver removal without mutation");
  Refused(()=>UsbHidSetupApi.ExecuteRecovery(deniedPlan,false,()=>{},fake),"read-only denial observation never expands mutation witness");
  fake.Connector="other-port";Refused(()=>UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,Inventory()),"denial connector change refused");fake.Connector="external-port-A";
  fake.Current=new UsbHidSetupApi.Node(Id,"UninstalledUsbHid",new[]{@"USB\Class_03","changed descriptor"},true,0,28,null);Refused(()=>UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,Inventory()),"denial descriptor drift refused");
  fake.Current=Node(children:new[]{child2});Refused(()=>UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,Inventory()),"denial foreign descendant refused");
  fake.Current=Node(children:new[]{child});Yes(UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,Inventory()).Children.Length==1,"unchanged installed denial target remains observable");
  var protectedInventory=Inventory();protectedInventory.Preflight.Candidates[0].Category="required_safety_candidate";Refused(()=>UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{},fake,protectedInventory),"denial observation protects internal inputs");
  Refused(()=>UsbHidSetupApi.InspectBlockPolicyTransition(deniedPlan,()=>{throw new InvalidOperationException();},fake,Inventory()),"denial fence failure refused");Yes(fake.Calls==0,"denial observation never invokes device transitions");
  int scopeCalls=0;int scopeResult=UsbHidSetupApi.ChangeScopes(true,(state,scope)=>{scopeCalls++;return scope==1?5:0;});Yes(scopeCalls==2&&scopeResult==0,"global enable refusal still attempts current profile");
  scopeCalls=0;scopeResult=UsbHidSetupApi.ChangeScopes(true,(state,scope)=>{scopeCalls++;return scope==1?5:13;});Yes(scopeCalls==2&&scopeResult==13,"current profile error propagated");
  scopeCalls=0;scopeResult=UsbHidSetupApi.ChangeScopes(false,(state,scope)=>{scopeCalls++;Yes(state==2&&scope==2,"disable remains config scoped");return 0;});Yes(scopeCalls==1&&scopeResult==0,"no preliminary global disable");
  Console.WriteLine("PASS "+assertions+" SetupAPI mapping, scope, fence and result assertions; fake transitions only");
 }
}
