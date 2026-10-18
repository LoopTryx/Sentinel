using System;
public static class UsbHidSetupApiTest {
 static int assertions;static readonly string Id=@"USB\VID_1234&PID_5678\TEST";
 static void Yes(bool v,string label){assertions++;if(!v)throw new Exception(label);}
 static void Refused(Action a,string label){bool failed=false;try{a();}catch(InvalidOperationException){failed=true;}Yes(failed,label);}
 static UsbHidSetupApi.Node Node(bool disableable=true,uint problem=0,string cls="HIDClass",UsbHidSetupApi.Node[] children=null){return new UsbHidSetupApi.Node(Id,cls,new[]{@"USB\Class_03"},disableable,0,problem,children??new UsbHidSetupApi.Node[0]);}
 static UsbAdmissionInventory.Result Inventory(){return new UsbAdmissionInventory.Result{Complete=true,Preflight=new UsbAdmissionPreflight.Result{State="review_required",TopologyToken="fresh",Unresolved=0,Candidates=new[]{new UsbAdmissionPreflight.Candidate{Instance=Id,Category="external_approval_required"}}}};}
 sealed class Fake:UsbHidSetupApi.IDevice {public UsbHidSetupApi.Node Current=Node();public int Calls,Error;public bool Restart,Enabled;public UsbHidSetupApi.Node Read(string id){return Current;}public int Change(string id,bool enable,out bool restart){Calls++;Enabled=enable;restart=Restart;Current=Node(true,enable?0u:22u);return Error;}}
 static void Main(string[] args){
  if(args.Length==1&&args[0]=="--native-read-only"){var inventory=UsbAdmissionInventory.Collect(null);if(!inventory.Complete)throw new Exception("read_only_inventory_incomplete");int safe=0,refused=0;foreach(var c in inventory.Preflight.Candidates){if(c.Category!="external_approval_required")continue;try{var nativePlan=UsbHidSetupApi.Prepare(inventory,c.Instance);safe++;Console.WriteLine("SAFE external function "+safe+" disableable="+nativePlan.Disableable+" started="+((nativePlan.BeforeStatus&8)!=0)+" problem="+nativePlan.BeforeProblem);}catch(InvalidOperationException){refused++;}}Console.WriteLine("READ ONLY external safe="+safe+" refused="+refused+"; NO transitions");return;}
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
  Console.WriteLine("PASS "+assertions+" SetupAPI mapping, scope, fence and result assertions; fake transitions only");
 }
}


