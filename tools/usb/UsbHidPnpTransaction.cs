using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

// Storage implementation MUST authenticate protected records and atomically flush
// CompareExchange before returning. This class supplies no in-memory production store.
public sealed class UsbHidPnpTransaction {
 public interface IJournal {
  State Load(string requestDigest);
  void CompareExchange(long expectedRevision,State durableState);
  // Authenticated prior successful Sentinel disable, bound to this current tree.
  bool OwnsDisabled(string instance,string treeBinding);
 }
 public interface IPnp {
  UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan plan);
  UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan plan,bool enable,Action fence);
 }
 public interface IRecoveryPnp {
  UsbHidSetupApi.Node ReadRecovery(UsbHidSetupApi.Plan plan,Action fence);
  UsbHidSetupApi.Result ChangeRecovery(UsbHidSetupApi.Plan plan,bool enable,Action fence);
 }
 public sealed class NativePnp:IPnp,IRecoveryPnp { public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan plan){return UsbHidSetupApi.Inspect(plan);} public UsbHidSetupApi.Node ReadRecovery(UsbHidSetupApi.Plan plan,Action fence){return UsbHidSetupApi.InspectRecovery(plan,fence);} public UsbHidSetupApi.Result ChangeRecovery(UsbHidSetupApi.Plan plan,bool enable,Action fence){return UsbHidSetupApi.ExecuteRecovery(plan,enable,fence);} public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan plan,bool enable,Action fence){return UsbHidSetupApi.Execute(plan,enable,fence);} }
 public sealed class Entry {
  public readonly UsbHidSetupApi.Plan Plan;public readonly uint BeforeStatus,BeforeProblem;public readonly bool BeforeDisableable,Intent,Observed,Restored;public readonly string BeforeTree,AfterTree,Outcome;
  public Entry(UsbHidSetupApi.Plan plan,uint status,uint problem,bool disableable,string tree,bool intent,bool observed,string after,string outcome,bool restored){Plan=plan;BeforeStatus=status;BeforeProblem=problem;BeforeDisableable=disableable;BeforeTree=tree;Intent=intent;Observed=observed;AfterTree=after;Outcome=outcome;Restored=restored;}
  internal Entry Update(bool intent,bool observed,string tree,string outcome,bool restored){return new Entry(Plan,BeforeStatus,BeforeProblem,BeforeDisableable,BeforeTree,intent,observed,tree,outcome,restored);}
 }
 public sealed class State {
  public readonly string Digest,Action,Binding,Phase;public readonly long Revision;readonly Entry[] entries;public Entry[] Entries{get{return (Entry[])entries.Clone();}}
  public State(string digest,string action,string binding,string phase,long revision,Entry[] records){Digest=digest;Action=action;Binding=binding;Phase=phase;Revision=revision;entries=(Entry[])records.Clone();}
 }
 readonly IJournal journal;readonly IPnp pnp;
 public UsbHidPnpTransaction(IJournal storage,IPnp native){if(storage==null||native==null)throw new ArgumentNullException();journal=storage;pnp=native;}
 public static bool CanDisable(uint status,uint problem){return problem==0&&(status&8)!=0;}
 static void ValidDigest(string d){if(d==null||d.Length!=64)throw new InvalidOperationException("invalid_request_digest");foreach(char c in d)if(!Uri.IsHexDigit(c))throw new InvalidOperationException("invalid_request_digest");}
 static string RequestBinding(string action,UsbHidSetupApi.Plan[] plans){if(action!="block"&&action!="allow")throw new InvalidOperationException("invalid_pnp_action");if(plans==null||plans.Length==0||plans.Length>8)throw new InvalidOperationException("invalid_pnp_targets");var ids=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var lines=new List<string>();foreach(var p in plans){if(p==null||!ids.Add(p.Instance))throw new InvalidOperationException("ambiguous_pnp_targets");lines.Add(p.Instance.ToUpperInvariant()+"\n"+p.Topology+"\n"+p.Tree+"\n"+(p.RecoveryConnector??"<missing>")+"\n"+(p.RecoveryTree??"<missing>"));}lines.Sort(StringComparer.Ordinal);using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(action+"\n"+string.Join("\n--\n",lines.ToArray())))).Replace("-","");}
  static void ValidateEntries(State state,UsbHidSetupApi.Plan[] plans){var expected=new Dictionary<string,UsbHidSetupApi.Plan>(StringComparer.OrdinalIgnoreCase);foreach(var p in plans)expected.Add(p.Instance,p);var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var e in state.Entries){UsbHidSetupApi.Plan p;if(e==null||e.Plan==null||!seen.Add(e.Plan.Instance)||!expected.TryGetValue(e.Plan.Instance,out p)||p.Topology!=e.Plan.Topology||p.Tree!=e.Plan.Tree||p.RecoveryConnector!=e.Plan.RecoveryConnector||p.RecoveryTree!=e.Plan.RecoveryTree||e.BeforeTree!=p.Tree||(e.Observed&&(!e.Intent||string.IsNullOrEmpty(e.AfterTree)))||(e.Restored&&!e.Intent)||(e.Intent&&state.Action=="block"&&!CanDisable(e.BeforeStatus,e.BeforeProblem))||(e.Intent&&state.Action=="allow"&&e.BeforeProblem!=22))throw new InvalidOperationException("pnp_journal_record_mismatch");}if(seen.Count!=expected.Count)throw new InvalidOperationException("pnp_journal_targets_mismatch");}
 State Save(State before,Entry[] entries,string phase,Action fence){fence();var next=new State(before.Digest,before.Action,before.Binding,phase,checked(before.Revision+1),entries);journal.CompareExchange(before.Revision,next);return next;}
 // The parent must arm independent authenticated recovery before Prepare and
 // retain its decision/writer fence across policy application and ApplyPrepared.
 public State Prepare(string digest,string action,UsbHidSetupApi.Plan[] plans,Action fence){
  ValidDigest(digest);if(fence==null)throw new ArgumentNullException("fence");string binding=RequestBinding(action,plans);fence();if(journal.Load(digest)!=null)throw new InvalidOperationException("existing_pnp_transaction_requires_recovery");
  var entries=new Entry[plans.Length];for(int i=0;i<plans.Length;i++){fence();var n=pnp.Read(plans[i]);string tree=UsbHidSetupApi.TreeBinding(n);if(!UsbHidSetupApi.IsSafeTree(n)||!string.Equals(n.Id,plans[i].Instance,StringComparison.OrdinalIgnoreCase)||tree!=plans[i].Tree)throw new InvalidOperationException("stale_pnp_tree");
   if(action=="allow"&&!CanDisable(n.Status,n.Problem)&&n.Problem!=48&&(n.Problem!=22||!journal.OwnsDisabled(n.Id,tree)))throw new InvalidOperationException("not_sentinel_disabled");entries[i]=new Entry(plans[i],n.Status,n.Problem,n.Disableable,tree,false,false,null,"Unchanged",false);}
  var state=new State(digest,action,binding,"Prepared",0,entries);fence();journal.CompareExchange(-1,state);return state;
 }
 UsbHidSetupApi.Node TransitionRead(Entry e,Action fence){var native=pnp as IRecoveryPnp;return native!=null&&!string.IsNullOrEmpty(e.Plan.RecoveryConnector)&&!string.IsNullOrEmpty(e.Plan.RecoveryTree)?native.ReadRecovery(e.Plan,fence):pnp.Read(e.Plan);}
 public State ApplyPrepared(string digest,string action,UsbHidSetupApi.Plan[] plans,Action fence){
  ValidDigest(digest);if(fence==null)throw new ArgumentNullException("fence");fence();var state=journal.Load(digest);if(state==null||state.Digest!=digest||state.Action!=action||state.Binding!=RequestBinding(action,plans)||state.Phase!="Prepared")throw new InvalidOperationException("prepared_pnp_binding_mismatch");ValidateEntries(state,plans);var entries=state.Entries;
  for(int i=0;i<entries.Length;i++){
   var e=entries[i];fence();var before=TransitionRead(e,fence);if(!UsbHidSetupApi.IsSafeTree(before)||!string.Equals(before.Id,e.Plan.Instance,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("pnp_prestate_changed");
   var recoveryNative=pnp as IRecoveryPnp;bool witnessed=recoveryNative!=null&&!string.IsNullOrEmpty(e.Plan.RecoveryConnector)&&!string.IsNullOrEmpty(e.Plan.RecoveryTree);if(!witnessed&&UsbHidSetupApi.TreeBinding(before)!=e.BeforeTree)throw new InvalidOperationException("pnp_prestate_changed");
   // A policy denial is not a Sentinel SetupAPI disable: no disable ownership
   // receipt is minted and recovery leaves restoration to the parent policy.
   if(action=="block"&&before.Problem==48){entries[i]=e.Update(false,false,UsbHidSetupApi.TreeBinding(before),"Policy restricted",false);state=Save(state,entries,"Applying",fence);continue;}
   if(action=="allow"&&CanDisable(before.Status,before.Problem)){entries[i]=e.Update(false,false,UsbHidSetupApi.TreeBinding(before),"Policy restored",false);state=Save(state,entries,"Applying",fence);continue;}
   if(action=="block"&&!CanDisable(e.BeforeStatus,e.BeforeProblem)){if(before.Status!=e.BeforeStatus||before.Problem!=e.BeforeProblem)throw new InvalidOperationException("originally_disabled_state_changed");continue;}
   if(action=="block"&&(!CanDisable(before.Status,before.Problem)||!e.BeforeDisableable||!before.Disableable))throw new InvalidOperationException("pnp_disable_unavailable");
   if(action=="allow"&&(e.BeforeProblem!=22||before.Problem!=22))throw new InvalidOperationException("not_sentinel_disabled");
   entries[i]=e.Update(true,false,null,"Intent",false);state=Save(state,entries,"Applying",fence);
   var result=witnessed?recoveryNative.ChangeRecovery(e.Plan,action=="allow",fence):pnp.Change(e.Plan,action=="allow",fence);fence();var after=TransitionRead(e,fence);if(!UsbHidSetupApi.IsSafeTree(after))throw new InvalidOperationException("pnp_posttree_unsafe");entries[i]=entries[i].Update(true,true,UsbHidSetupApi.TreeBinding(after),result.State,false);state=Save(state,entries,"Applying",fence);
   if(result.State=="Failed")throw new InvalidOperationException("pnp_transition_failed");
  }
  return Save(state,entries,"Applied pending physical verification",fence);
 }
 public State Apply(string digest,string action,UsbHidSetupApi.Plan[] plans,Action fence){Prepare(digest,action,plans,fence);return ApplyPrepared(digest,action,plans,fence);} // Called only after the parent has durably committed the matching policy decision.
 public State Commit(string digest,string action,UsbHidSetupApi.Plan[] plans,Action commitFence){ValidDigest(digest);if(commitFence==null)throw new ArgumentNullException("commitFence");commitFence();var state=journal.Load(digest);if(state==null||state.Digest!=digest||state.Action!=action||state.Binding!=RequestBinding(action,plans)||state.Phase!="Applied pending physical verification")throw new InvalidOperationException("pnp_commit_binding_mismatch");ValidateEntries(state,plans);return Save(state,state.Entries,"Committed pending physical verification",commitFence);}
 public enum ParentDecision { Unverified, BeforeCommitted, CandidateCommitted }
 public State Recover(string digest,string action,UsbHidSetupApi.Plan[] plans,Action recoveryFence,Func<ParentDecision> authenticatedParentDecision){
  ValidDigest(digest);if(recoveryFence==null)throw new ArgumentNullException("recoveryFence");recoveryFence();var state=journal.Load(digest);if(state==null)throw new InvalidOperationException("missing_pnp_journal");if(state.Digest!=digest||state.Action!=action||state.Binding!=RequestBinding(action,plans))throw new InvalidOperationException("pnp_journal_binding_mismatch");if(state.Phase=="Committed pending physical verification"){if(authenticatedParentDecision==null)throw new InvalidOperationException("parent_decision_required");ValidateEntries(state,plans);recoveryFence();if(authenticatedParentDecision()!=ParentDecision.CandidateCommitted)throw new InvalidOperationException("committed_pnp_recovery_forbidden");recoveryFence();return state;}if(state.Phase=="Recovered pending physical verification")return state;
  ValidateEntries(state,plans);
  // Same protected parent writer fence must cover this decision and journal CAS.
  // A lost reply after the parent commit must never reverse committed device state.
  if(authenticatedParentDecision==null)throw new InvalidOperationException("parent_decision_required");
  recoveryFence();var parent=authenticatedParentDecision();recoveryFence();
  if(parent==ParentDecision.CandidateCommitted){
   if(state.Phase!="Applied pending physical verification")throw new InvalidOperationException("committed_parent_pnp_phase_mismatch");
   return Save(state,state.Entries,"Committed pending physical verification",()=>{recoveryFence();if(authenticatedParentDecision()!=ParentDecision.CandidateCommitted)throw new InvalidOperationException("parent_decision_changed");});
  }
  if(parent!=ParentDecision.BeforeCommitted)throw new InvalidOperationException("parent_decision_unverified");
  Action originalFence=recoveryFence;
  recoveryFence=()=>{originalFence();if(authenticatedParentDecision()!=ParentDecision.BeforeCommitted)throw new InvalidOperationException("parent_decision_changed");};
  var entries=state.Entries;if(entries.Length!=plans.Length)throw new InvalidOperationException("pnp_journal_targets_mismatch");
  for(int i=entries.Length-1;i>=0;i--){var e=entries[i];if(!e.Intent||e.Restored)continue;if(action=="block"&&!CanDisable(e.BeforeStatus,e.BeforeProblem))throw new InvalidOperationException("invalid_disable_journal");
   recoveryFence();var recoveryNative=pnp as IRecoveryPnp;var n=recoveryNative==null?pnp.Read(e.Plan):recoveryNative.ReadRecovery(e.Plan,recoveryFence);string tree=UsbHidSetupApi.TreeBinding(n);if(!UsbHidSetupApi.IsSafeTree(n)||(recoveryNative==null&&tree!=e.BeforeTree&&tree!=e.AfterTree))throw new InvalidOperationException("recovery_tree_changed");bool enable=action=="block";
   // The inverse is idempotent and limited to the authenticated intent target.
   if((enable&&n.Problem==22)||(!enable&&CanDisable(n.Status,n.Problem))){var currentPlan=new UsbHidSetupApi.Plan(e.Plan.Instance,e.Plan.Topology,tree);var result=recoveryNative==null?pnp.Change(currentPlan,enable,recoveryFence):recoveryNative.ChangeRecovery(e.Plan,enable,recoveryFence);if(result.State=="Failed")throw new InvalidOperationException("pnp_recovery_failed");}
   recoveryFence();var restored=recoveryNative==null?pnp.Read(e.Plan):recoveryNative.ReadRecovery(e.Plan,recoveryFence);if(enable?!CanDisable(restored.Status,restored.Problem):restored.Problem!=22)throw new InvalidOperationException("pnp_recovery_unverified");
   entries[i]=e.Update(true,e.Observed,e.AfterTree,e.Outcome,true);state=Save(state,entries,"Recovering",recoveryFence);
  }
  return Save(state,entries,"Recovered pending physical verification",recoveryFence);
 }
}
