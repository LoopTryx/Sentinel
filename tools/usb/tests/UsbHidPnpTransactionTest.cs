using System;
using System.Collections.Generic;
public static class UsbHidPnpTransactionTest {
 const string Digest="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";static int checks;
 static void Yes(bool b,string s){checks++;if(!b)throw new Exception(s);}static void Refused(Action a){bool failed=false;try{a();}catch(InvalidOperationException){failed=true;}Yes(failed,"expected refusal");}
 sealed class Fault {public int At=-1,Calls;public void Hit(){if(Calls++==At)throw new InvalidOperationException("injected fault");}}
 sealed class Store:UsbHidPnpTransaction.IJournal {public UsbHidPnpTransaction.State State;public bool Owned;public Fault Fault;public UsbHidPnpTransaction.State Load(string digest){return State!=null&&State.Digest==digest?State:null;}public void CompareExchange(long revision,UsbHidPnpTransaction.State next){Fault.Hit();if((State==null?-1:State.Revision)!=revision)throw new InvalidOperationException("generation");State=next;Fault.Hit();}public bool OwnsDisabled(string id,string tree){return Owned;}}
 sealed class Native:UsbHidPnpTransaction.IPnp,UsbHidPnpTransaction.IPolicyReadPnp,UsbHidPnpTransaction.IBlockPolicyReadPnp {public UsbHidSetupApi.Node ReadBlockPolicyTransition(UsbHidSetupApi.Plan plan,Action fence){fence();return Read(plan);}public UsbHidSetupApi.Node ReadPolicyTransition(UsbHidSetupApi.Plan plan,Action fence){fence();if(!UsbHidSetupApi.IsUninstalledPlan(plan))throw new InvalidOperationException();return Read(plan);}public Store Store;public Fault Fault;public Dictionary<string,bool> Enabled=new Dictionary<string,bool>();public int Changes;public bool LostReply,Uninstalled;public bool Disableable=true;public uint? PolicyProblem;public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan plan){Fault.Hit();return new UsbHidSetupApi.Node(plan.Instance,Uninstalled?"UninstalledUsbHid":"HIDClass",new[]{@"USB\Class_03"},Disableable,PolicyProblem.HasValue?(PolicyProblem.Value==0?8u:0u):(Enabled[plan.Instance]?8u:0u),PolicyProblem??(Enabled[plan.Instance]?0u:22u),null);}public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan plan,bool enable,Action fence){fence();Fault.Hit();bool intent=false;foreach(var e in Store.State.Entries)if(e.Plan.Instance==plan.Instance&&e.Intent)intent=true;if(!intent)throw new Exception("mutation without durable intent");Enabled[plan.Instance]=enable;PolicyProblem=null;Changes++;Fault.Hit();if(LostReply){LostReply=false;throw new InvalidOperationException("lostreply");}return UsbHidSetupApi.Classify(enable,Read(plan),false);}}
 sealed class RecoveryNative:UsbHidPnpTransaction.IPnp,UsbHidPnpTransaction.IRecoveryPnp {
  internal Native Inner;internal int RecoveryReads;
  public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan p){if(!Inner.Enabled[p.Instance])throw new InvalidOperationException("full inventory changed after disable");return Inner.Read(p);}
  public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan p,bool enable,Action fence){return Inner.Change(p,enable,fence);}
  public UsbHidSetupApi.Node ReadRecovery(UsbHidSetupApi.Plan p,Action fence){fence();RecoveryReads++;return Inner.Read(p);}
  public UsbHidSetupApi.Result ChangeRecovery(UsbHidSetupApi.Plan p,bool enable,Action fence){return Inner.Change(p,enable,fence);}
 }
 static UsbHidSetupApi.Plan[] Plans(Native n,int count){var p=new UsbHidSetupApi.Plan[count];for(int i=0;i<count;i++){string id=@"USB\VID_1234&PID_5678\TARGET"+i;n.Enabled[id]=true;var blank=new UsbHidSetupApi.Plan(id,"topology","");p[i]=new UsbHidSetupApi.Plan(id,"topology",UsbHidSetupApi.TreeBinding(n.Read(blank)));}return p;}
 static void Main(){
  Yes(UsbHidPnpTransaction.CanDisable(8,0)&&!UsbHidPnpTransaction.CanDisable(0,0)&&!UsbHidPnpTransaction.CanDisable(8,22),"healthy started requirement");
  for(int failure=0;failure<90;failure++){var fault=new Fault();var store=new Store{Fault=fault};var native=new Native{Store=store,Fault=fault};var plans=Plans(native,2);var tx=new UsbHidPnpTransaction(store,native);fault.Calls=0;fault.At=failure;try{tx.Apply(Digest,"block",plans,fault.Hit);}catch(InvalidOperationException){}fault.At=-1;if(store.State!=null)tx.Recover(Digest,"block",plans,fault.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);foreach(var p in plans)Yes(native.Enabled[p.Instance],"fault recovery restored selected target");}
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,2);n.Enabled[p[1].Instance]=false;var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",p,f.Hit);tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(n.Enabled[p[0].Instance]&&!n.Enabled[p[1].Instance],"originally disabled untouched");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);n.LostReply=true;var tx=new UsbHidPnpTransaction(s,n);Refused(()=>tx.Apply(Digest,"block",p,f.Hit));tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(n.Enabled[p[0].Instance],"lost reply recovered");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);n.Enabled[p[0].Instance]=false;var tx=new UsbHidPnpTransaction(s,n);Refused(()=>tx.Apply(Digest,"allow",p,f.Hit));Yes(n.Changes==0,"arbitrary disabled not enabled");s.Owned=true;tx.Apply(Digest,"allow",p,f.Hit);Yes(n.Enabled[p[0].Instance],"owned allow");tx.Recover(Digest,"allow",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(!n.Enabled[p[0].Instance],"allow recovery restores disabled prestate");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",p,f.Hit);Refused(()=>tx.Recover(new string('b',64),"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted));var stale=new[]{new UsbHidSetupApi.Plan(p[0].Instance,"stale",p[0].Tree)};Refused(()=>tx.Recover(Digest,"block",stale,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted));Yes(!n.Enabled[p[0].Instance],"stale request no recovery mutation");
  }
  {
 var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",p,f.Hit);tx.Commit(Digest,"block",p,f.Hit);Refused(()=>tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted));Yes(!n.Enabled[p[0].Instance],"committed change never rolled back");
}
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",p,f.Hit);
   tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.CandidateCommitted);
   Yes(!n.Enabled[p[0].Instance]&&s.State.Phase=="Committed pending physical verification","lost parent commit reply preserves device state");int changes=n.Changes;tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.CandidateCommitted);Yes(n.Changes==changes,"repeat committed recovery never repeats native transition");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",p,f.Hit);int changes=n.Changes;
   Refused(()=>tx.Recover(Digest,"block",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.Unverified));
   Yes(n.Changes==changes&&!n.Enabled[p[0].Instance],"unknown parent never mutates input state");
   int reads=0;
   Refused(()=>tx.Recover(Digest,"block",p,f.Hit,()=>++reads==1?UsbHidPnpTransaction.ParentDecision.BeforeCommitted:UsbHidPnpTransaction.ParentDecision.CandidateCommitted));
   Yes(n.Changes==changes&&!n.Enabled[p[0].Instance],"parent decision race fences inverse transition");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var p=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);
   tx.Apply(Digest,"allow",p,f.Hit);
   Yes(n.Changes==0&&n.Enabled[p[0].Instance],"policy-restored healthy Allow does not change PnP state");
   tx.Recover(Digest,"allow",p,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);
   Yes(n.Changes==0&&n.Enabled[p[0].Instance],"policy-only Allow rollback never disables healthy original device");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var inner=new Native{Fault=f,Store=s};var plans=Plans(inner,1);var native=new RecoveryNative{Inner=inner};var tx=new UsbHidPnpTransaction(s,native);
   Refused(()=>tx.Apply(Digest,"block",plans,f.Hit));
   Yes(!inner.Enabled[plans[0].Instance]&&s.State.Entries[0].Intent,"changed inventory retains durable disable intent");
   tx.Recover(Digest,"block",plans,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);
   Yes(inner.Enabled[plans[0].Instance]&&native.RecoveryReads>=2,"dedicated authenticated recovery path restores own target despite unrelated inventory changes");
  }
    {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"block",plans,f.Hit);Yes(s.State.Phase=="Prepared"&&n.Changes==0,"prestate durable before parent policy");tx.ApplyPrepared(Digest,"block",plans,f.Hit);Yes(n.Changes==1,"prepared apply changes only after policy");
  }
    {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"block",plans,f.Hit);n.PolicyProblem=48;tx.ApplyPrepared(Digest,"block",plans,f.Hit);Yes(n.Changes==0&&!s.State.Entries[0].Intent&&s.State.Entries[0].Outcome=="Policy restricted","policy denial never creates native disable ownership");tx.Recover(Digest,"block",plans,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(n.Changes==0,"policy-only restriction recovery leaves native state alone");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);n.PolicyProblem=48;var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"allow",plans,f.Hit);n.PolicyProblem=0;tx.ApplyPrepared(Digest,"allow",plans,f.Hit);Yes(n.Changes==0&&!s.State.Entries[0].Intent&&s.State.Entries[0].Outcome=="Policy restored","policy-only healthy Allow is no-op");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"allow",plans,f.Hit);n.PolicyProblem=22;Refused(()=>tx.ApplyPrepared(Digest,"allow",plans,f.Hit));Yes(n.Changes==0,"new foreign disabled node never enabled");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var inner=new Native{Fault=f,Store=s};var plans=Plans(inner,1);var p=plans[0];plans[0]=new UsbHidSetupApi.Plan(p.Instance,p.Topology,p.Tree,8,0,true,"connector","recoverytree");var native=new RecoveryNative{Inner=inner};var tx=new UsbHidPnpTransaction(s,native);inner.LostReply=true;Refused(()=>tx.Apply(Digest,"block",plans,f.Hit));Yes(s.State.Entries[0].Intent,"lost native reply retains pre-policy intent");tx.Recover(Digest,"block",plans,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(inner.Enabled[p.Instance]&&native.RecoveryReads>0,"witnessed recovery survives changed whole inventory");
  }
  for(int mode=0;mode<3;mode++){
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);n.Uninstalled=true;n.PolicyProblem=28;var node=n.Read(plans[0]);plans[0]=new UsbHidSetupApi.Plan(node.Id,"topology",UsbHidSetupApi.TreeBinding(node),node.Status,node.Problem,node.Disableable,"connector",UsbHidSetupApi.RecoveryTreeBinding(node));var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"allow",plans,f.Hit);
   if(mode==1){n.Uninstalled=false;n.PolicyProblem=0;}if(mode==2){n.Uninstalled=false;n.PolicyProblem=22;Refused(()=>tx.ApplyPrepared(Digest,"allow",plans,f.Hit));Yes(n.Changes==0,"foreign disable after policy grant never enabled");continue;}
   tx.ApplyPrepared(Digest,"allow",plans,f.Hit);Yes(n.Changes==0&&!s.State.Entries[0].Intent&&!s.State.Entries[0].Observed,"policy-only grant creates no native intent or ownership");Yes(s.State.Entries[0].Outcome==(mode==0?"Reconnect required":"Policy restored"),"policy-only grant truthful outcome");tx.Recover(Digest,"allow",plans,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(n.Changes==0,"policy-only rollback never changes device state");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s,Disableable=false};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",plans,f.Hit);Yes(n.Changes==0&&!s.State.Entries[0].Intent&&!s.State.Entries[0].Observed&&s.State.Entries[0].Outcome=="Reconnect required","non-disableable keyboard keeps policy decision without native mutation or disable receipt");tx.Commit(Digest,"block",plans,f.Hit);Yes(s.State.Phase=="Committed pending physical verification","policy-only non-disableable block can commit truthfully");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s,Disableable=false};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Apply(Digest,"block",plans,f.Hit);tx.Recover(Digest,"block",plans,f.Hit,()=>UsbHidPnpTransaction.ParentDecision.BeforeCommitted);Yes(n.Changes==0&&n.Enabled[plans[0].Instance],"policy-only non-disableable rollback never enables or disables the device");
  }
  {
   var f=new Fault();var s=new Store{Fault=f};var n=new Native{Fault=f,Store=s};var plans=Plans(n,1);var tx=new UsbHidPnpTransaction(s,n);tx.Prepare(Digest,"block",plans,f.Hit);n.Uninstalled=true;n.PolicyProblem=1;tx.ApplyPrepared(Digest,"block",plans,f.Hit);Yes(n.Changes==0&&!s.State.Entries[0].Intent&&s.State.Entries[0].Outcome=="Policy restricted","post-policy uninstalled HID does not cause native disable or rollback");
  }
  Console.WriteLine("PASS "+checks+" PnP durable-intent/fault/recovery assertions; modeled native only");
 }
}
