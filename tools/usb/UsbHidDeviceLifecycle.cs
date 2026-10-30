using System;using System.Linq;using System.Collections.Generic;
using P=UsbHidAdmissionPolicy;
using Store=SentinelHidAdmission.UsbExactBlockFileStore;

// Worker-only device participant. Every entry requires the parent-held decision
// fence and captured native state. No renderer path or device identity is accepted.
internal sealed class UsbHidDeviceLifecycle {
 readonly UsbHidPnpTransaction.IPnp native;readonly Func<P.Request,string,UsbHidSetupApi.Plan> prepare;readonly string privateNonce;
 internal UsbHidDeviceLifecycle(){native=new UsbHidPnpTransaction.NativePnp();prepare=(q,id)=>UsbHidSetupApi.Prepare(UsbAdmissionInventory.Collect(q.TopologyHash),id);}
#if SENTINEL_USB_HID_LIFECYCLE_PRIVATE
 internal static UsbHidDeviceLifecycle Private(string nonce,UsbHidPnpTransaction.IPnp explicitModeledNative,Func<P.Request,string,UsbHidSetupApi.Plan> modeledPreparation){if(nonce==null||nonce.Length!=32||explicitModeledNative==null||modeledPreparation==null)throw new ArgumentException();return new UsbHidDeviceLifecycle(nonce,explicitModeledNative,modeledPreparation);}
 UsbHidDeviceLifecycle(string nonce,UsbHidPnpTransaction.IPnp modeled,Func<P.Request,string,UsbHidSetupApi.Plan> preparation){privateNonce=nonce;native=modeled;prepare=preparation;}
#endif
 sealed class Proxy:UsbHidPnpFileJournal.ICommittedDisableLedger {internal Func<string,string,bool> Read;public bool OwnsDisabled(string id,string tree){if(Read==null)throw new InvalidOperationException("ownership_source_unbound");return Read(id,tree);}}
 static void Require(bool yes){if(!yes)throw new InvalidOperationException("device_lifecycle_parent_unverified");}
 static bool HasPnp(P.Request q){return q.Action=="block"||q.Action=="allow";}
 void Open(P.Request request,P.Snapshot current,P.Transition pending,Action fence,Action<UsbHidParentCommitLinks,UsbHidPnpFileJournal> action,Dictionary<string,KeyValuePair<string,string>> verifiedAllowTrees=null){Require(request!=null&&fence!=null&&pending!=null&&pending.Request.Digest==request.Digest&&(P.Same(current,request.Before)||P.Same(current,request.After)));fence();var proxy=new Proxy();UsbHidPnpFileJournal journal=null;UsbHidParentCommitLinks links=null;try{
#if SENTINEL_USB_HID_LIFECYCLE_PRIVATE
  if(privateNonce!=null){journal=UsbHidPnpFileJournal.OpenPrivate(privateNonce,fence,proxy);links=UsbHidParentCommitLinks.OpenPrivate(privateNonce,fence,()=>new UsbHidParentCommitLinks.View(current,pending),journal.Load);}else
#endif
  {journal=UsbHidPnpFileJournal.OpenNative(fence,proxy);links=UsbHidParentCommitLinks.OpenNative(fence,()=>new UsbHidParentCommitLinks.View(current,pending),journal.Load);}
  var source=links.Source(request.Action=="allow"&&P.Same(current,request.Before)?request.Digest:null);proxy.Read=(id,tree)=>{KeyValuePair<string,string> mapped;if(verifiedAllowTrees!=null&&verifiedAllowTrees.TryGetValue(id,out mapped)&&mapped.Key==tree)return new UsbHidCommittedDisableLedger(source,fence).OwnsDisabled(id,mapped.Value);return new UsbHidCommittedDisableLedger(source,fence).OwnsDisabled(id,tree);};action(links,journal);fence();
 }finally{if(links!=null)links.Dispose();if(journal!=null)journal.Dispose();}}
 internal void AttachCommitHook(Store store){if(store==null)throw new ArgumentNullException();store.BeforeLinkedCommit=PublishBeforeCommit;store.BeforeLinkedRetirement=VerifyRetirement;}
 internal void BeforePolicy(P.Request request,P.Snapshot current,P.Transition pending,Action fence){Require(P.Same(current,request.Before)&&pending!=null&&pending.Phase==P.Stage.RecoveryArmed);var verifiedAllowTrees=new Dictionary<string,KeyValuePair<string,string>>(StringComparer.OrdinalIgnoreCase);Open(request,current,pending,fence,(links,journal)=>{
  if(!HasPnp(request)){Require(request.Targets.Length==0);return;}
  Require(journal.Load(request.Digest)==null);var plans=request.Targets.Select(id=>prepare(request,id)).ToArray();
  if(request.Action=="allow"){
   var source=links.Source(request.Digest);var ledger=new UsbHidCommittedDisableLedger(source,fence);
   for(int i=0;i<plans.Length;i++){
    var plan=plans[i];var node=native.Read(plan);if(UsbHidPnpTransaction.CanDisable(node.Status,node.Problem)||node.Problem==48||UsbHidSetupApi.IsUninstalled(node))continue;
    Require(node.Problem==22);var snapshot=source.ReadCurrentCommittedPolicy();var receipt=Array.Find(snapshot.Receipts,r=>string.Equals(r.Instance,plan.Instance,StringComparison.OrdinalIgnoreCase));Require(receipt!=null&&ledger.OwnsDisabled(plan.Instance,receipt.Tree));
    var old=source.ReadAuthenticatedPnpJournal(receipt.PnpDigest);var entry=Array.Find(old.Entries,e=>string.Equals(e.Plan.Instance,plan.Instance,StringComparison.OrdinalIgnoreCase));Require(entry!=null&&entry.Plan.RecoveryConnector==plan.RecoveryConnector&&!string.IsNullOrEmpty(entry.Plan.RecoveryTree));
    var recovery=native as UsbHidPnpTransaction.IRecoveryPnp;Require(recovery!=null);var observed=recovery.ReadRecovery(entry.Plan,fence);Require(UsbHidSetupApi.TreeBinding(observed)==plan.Tree);
    // Original authenticated connector/directed-tree witness covers descendants
    // Windows may have removed while disabled. Fresh prestate remains current.
    plans[i]=new UsbHidSetupApi.Plan(plan.Instance,plan.Topology,plan.Tree,plan.BeforeStatus,plan.BeforeProblem,plan.Disableable,entry.Plan.RecoveryConnector,entry.Plan.RecoveryTree);verifiedAllowTrees.Add(plan.Instance,new KeyValuePair<string,string>(plan.Tree,receipt.Tree));
   }
  }
  new UsbHidPnpTransaction(journal,native).Prepare(request.Digest,request.Action,plans,fence);
 },verifiedAllowTrees);}
 internal void AfterPolicy(P.Request request,P.Snapshot current,P.Transition pending,Action fence){Require(P.Same(current,request.Before)&&pending!=null&&pending.Phase==P.Stage.RecoveryArmed);Open(request,current,pending,fence,(links,journal)=>{if(!HasPnp(request))return;var state=journal.Load(request.Digest);Require(state!=null&&state.Action==request.Action);var plans=state.Entries.Select(e=>e.Plan).ToArray();new UsbHidPnpTransaction(journal,native).ApplyPrepared(request.Digest,request.Action,plans,fence);});}
 internal void PublishBeforeCommit(P.Request request,P.Snapshot current,P.Transition pending,Action fence){Open(request,current,pending,fence,(links,journal)=>{var pnp=HasPnp(request)?journal.Load(request.Digest):null;Require(!HasPnp(request)||pnp!=null);links.PublishBeforeCommit(request,pnp==null?null:pnp.Digest,pnp==null?null:pnp.Binding);});}
 internal void ReconcileAfterCommit(Store store,P.Request request){AttachCommitHook(store);store.WithLinkedReadFence((current,pending,fence)=>ReconcileHeld(request,current,pending,fence));}
 void ReconcileHeld(P.Request request,P.Snapshot current,P.Transition pending,Action fence){Require(P.Same(current,request.After));Open(request,current,pending,fence,(links,journal)=>links.ReconcileCommitted(request,(digest,action,plans)=>new UsbHidPnpTransaction(journal,native).Commit(digest,action,plans,fence)));}
 // Call only AFTER parent policy restoration. It cannot restore policy itself.
 internal void RecoverBefore(P.Request request,P.Snapshot current,P.Transition pending,Action fence){Require(P.Same(current,request.Before)&&pending!=null&&pending.Phase==P.Stage.RecoveryClaimed);Open(request,current,pending,fence,(links,journal)=>{if(!HasPnp(request))return;var state=journal.Load(request.Digest);if(state==null)return;new UsbHidPnpTransaction(journal,native).Recover(request.Digest,request.Action,state.Entries.Select(e=>e.Plan).ToArray(),fence,()=>{fence();Require(P.Same(current,request.Before));return UsbHidPnpTransaction.ParentDecision.BeforeCommitted;});});}
 internal void VerifyRetirement(P.Request request,P.Snapshot current,P.Transition pending,Action fence){if(P.Same(current,request.After))ReconcileHeld(request,current,pending,fence);else Require(P.Same(current,request.Before)&&pending!=null&&pending.Phase==P.Stage.RecoveryClaimed);Open(request,current,pending,fence,(links,journal)=>{if(!HasPnp(request))return;var state=journal.Load(request.Digest);if(P.Same(current,request.Before)){Require(state==null||state.Phase=="Recovered pending physical verification");}else Require(state!=null&&state.Phase=="Committed pending physical verification");});}
}
