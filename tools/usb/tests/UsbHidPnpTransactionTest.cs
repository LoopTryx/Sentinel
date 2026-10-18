using System;
using System.Collections.Generic;
public static class UsbHidPnpTransactionTest {
 const string Digest="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";static int checks;
 static void Yes(bool b,string s){checks++;if(!b)throw new Exception(s);}static void Refused(Action a){bool failed=false;try{a();}catch(InvalidOperationException){failed=true;}Yes(failed,"expected refusal");}
 sealed class Fault {public int At=-1,Calls;public void Hit(){if(Calls++==At)throw new InvalidOperationException("injected fault");}}
 sealed class Store:UsbHidPnpTransaction.IJournal {public UsbHidPnpTransaction.State State;public bool Owned;public Fault Fault;public UsbHidPnpTransaction.State Load(string digest){return State!=null&&State.Digest==digest?State:null;}public void CompareExchange(long revision,UsbHidPnpTransaction.State next){Fault.Hit();if((State==null?-1:State.Revision)!=revision)throw new InvalidOperationException("generation");State=next;Fault.Hit();}public bool OwnsDisabled(string id,string tree){return Owned;}}
 sealed class Native:UsbHidPnpTransaction.IPnp {public Store Store;public Fault Fault;public Dictionary<string,bool> Enabled=new Dictionary<string,bool>();public int Changes;public bool LostReply;public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan plan){Fault.Hit();return new UsbHidSetupApi.Node(plan.Instance,"HIDClass",new[]{@"USB\Class_03"},true,Enabled[plan.Instance]?8u:0u,Enabled[plan.Instance]?0u:22u,null);}public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan plan,bool enable,Action fence){fence();Fault.Hit();bool intent=false;foreach(var e in Store.State.Entries)if(e.Plan.Instance==plan.Instance&&e.Intent)intent=true;if(!intent)throw new Exception("mutation without durable intent");Enabled[plan.Instance]=enable;Changes++;Fault.Hit();if(LostReply){LostReply=false;throw new InvalidOperationException("lostreply");}return UsbHidSetupApi.Classify(enable,Read(plan),false);}}
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
  Console.WriteLine("PASS "+checks+" PnP durable-intent/fault/recovery assertions; modeled native only");
 }
}

