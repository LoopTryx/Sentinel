using System;
using System.Collections.Generic;
using System.Security.Cryptography;using System.Text;

// A receipt is a reference to authenticated durable decisions, never standalone
// file authority. Production wiring MUST provide the protected parent backend.
internal sealed class UsbHidCommittedDisableLedger:UsbHidPnpFileJournal.ICommittedDisableLedger {
 internal const int MaxReceipts=256;
 internal interface IAuthenticatedSource {
  PolicySnapshot ReadCurrentCommittedPolicy();
  ParentCommit ReadCommittedParentGeneration(long generation);
  UsbHidPnpTransaction.State ReadAuthenticatedPnpJournal(string digest);
 }
 internal sealed class Receipt {
  internal readonly string Instance,Tree,PnpDigest,PnpBinding,ParentDigest;internal readonly long Generation;
  internal Receipt(string id,string tree,string pnpDigest,string pnpBinding,string parentDigest,long generation){Instance=id;Tree=tree;PnpDigest=pnpDigest;PnpBinding=pnpBinding;ParentDigest=parentDigest;Generation=generation;}
 }
 internal sealed class PolicySnapshot {
  internal readonly long Generation;internal readonly string Digest;internal readonly bool Pending;readonly Receipt[] receipts;internal Receipt[] Receipts{get{return (Receipt[])receipts.Clone();}}
  internal PolicySnapshot(long generation,string digest,bool pending,Receipt[] current){Generation=generation;Digest=digest;Pending=pending;receipts=(Receipt[])current.Clone();}
 }
 internal sealed class ParentCommit {
  internal readonly long Generation;internal readonly string Digest,Action,PnpDigest,PnpBinding;readonly string[] targets;internal string[] Targets{get{return (string[])targets.Clone();}}
  internal ParentCommit(long generation,string digest,string action,string pnpDigest,string pnpBinding,string[] exactTargets){Generation=generation;Digest=digest;Action=action;PnpDigest=pnpDigest;PnpBinding=pnpBinding;targets=(string[])exactTargets.Clone();}
 }
 readonly IAuthenticatedSource source;readonly Action fence;
 internal UsbHidCommittedDisableLedger(IAuthenticatedSource authenticatedSource,Action authenticatedFence){if(authenticatedSource==null||authenticatedFence==null)throw new ArgumentNullException();source=authenticatedSource;fence=authenticatedFence;}
 static void Require(bool value){if(!value)throw new InvalidOperationException("committed_disable_authority_unverified");}
 static bool Hex(string text){if(text==null||text.Length!=64)return false;foreach(char c in text)if(!Uri.IsHexDigit(c))return false;return true;}
  static string JournalBinding(UsbHidPnpTransaction.State state){var lines=new List<string>();foreach(var e in state.Entries){Require(e!=null&&e.Plan!=null);lines.Add(e.Plan.Instance.ToUpperInvariant()+"\n"+e.Plan.Topology+"\n"+e.Plan.Tree);}lines.Sort(StringComparer.Ordinal);using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(state.Action+"\n"+string.Join("\n--\n",lines.ToArray())))).Replace("-","");}
 static void Validate(PolicySnapshot snapshot){Require(snapshot!=null&&snapshot.Generation>=0&&Hex(snapshot.Digest)&&!snapshot.Pending&&snapshot.Receipts.Length<=MaxReceipts);var ids=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var r in snapshot.Receipts){Require(r!=null&&r.Generation>0&&r.Generation<=snapshot.Generation&&Hex(r.PnpDigest)&&Hex(r.PnpBinding)&&Hex(r.ParentDigest)&&!string.IsNullOrEmpty(r.Instance)&&!string.IsNullOrEmpty(r.Tree)&&r.Tree.Length<=24576);UsbExactBlockState.ValidateId(r.Instance.ToUpperInvariant());Require(ids.Add(r.Instance));}}
 public bool OwnsDisabled(string instance,string treeBinding){
  if(string.IsNullOrEmpty(instance)||string.IsNullOrEmpty(treeBinding))throw new ArgumentNullException();fence();var current=source.ReadCurrentCommittedPolicy();Validate(current);Receipt receipt=null;foreach(var r in current.Receipts)if(string.Equals(r.Instance,instance,StringComparison.OrdinalIgnoreCase))receipt=r;
  bool owns=false;if(receipt!=null&&receipt.Tree==treeBinding){
   fence();var parent=source.ReadCommittedParentGeneration(receipt.Generation);Require(parent!=null&&parent.Generation==receipt.Generation&&parent.Digest==receipt.ParentDigest&&parent.Action=="block"&&parent.PnpDigest==receipt.PnpDigest&&parent.PnpBinding==receipt.PnpBinding&&parent.Targets.Length>0&&parent.Targets.Length<=8);
   var targets=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(string target in parent.Targets){Require(!string.IsNullOrEmpty(target)&&targets.Add(target));UsbExactBlockState.ValidateId(target.ToUpperInvariant());}Require(targets.Contains(instance));
   fence();var journal=source.ReadAuthenticatedPnpJournal(parent.PnpDigest);Require(journal!=null&&journal.Digest==parent.PnpDigest&&journal.Binding==parent.PnpBinding&&journal.Action=="block"&&journal.Phase=="Committed pending physical verification"&&journal.Revision>=1&&journal.Entries.Length==targets.Count&&string.Equals(JournalBinding(journal),journal.Binding,StringComparison.OrdinalIgnoreCase));
   UsbHidPnpTransaction.Entry selected=null;var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var e in journal.Entries){Require(e!=null&&e.Plan!=null&&targets.Contains(e.Plan.Instance)&&seen.Add(e.Plan.Instance));if(string.Equals(e.Plan.Instance,instance,StringComparison.OrdinalIgnoreCase))selected=e;}
   Require(selected!=null&&selected.Intent&&selected.Observed&&!selected.Restored&&selected.BeforeDisableable&&selected.Plan.Disableable==selected.BeforeDisableable&&selected.Plan.BeforeStatus==selected.BeforeStatus&&selected.Plan.BeforeProblem==selected.BeforeProblem&&UsbHidPnpTransaction.CanDisable(selected.BeforeStatus,selected.BeforeProblem)&&selected.BeforeTree==selected.Plan.Tree&&selected.AfterTree==receipt.Tree&&(selected.Outcome=="Pending verification"||selected.Outcome=="Blocked"));owns=true;
  }
  fence();var after=source.ReadCurrentCommittedPolicy();Validate(after);Require(after.Generation==current.Generation&&after.Digest==current.Digest);fence();return owns;
 }
 // Pure parent-state construction, not a persistence/authority operation.
 // The parent must durably commit this projection with its matching transaction.
 internal static Receipt[] RemoveSelectedForAllow(Receipt[] current,string[] selected){Require(current!=null&&current.Length<=MaxReceipts&&selected!=null&&selected.Length>0&&selected.Length<=8);var remove=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var id in selected){Require(!string.IsNullOrEmpty(id)&&remove.Add(id));UsbExactBlockState.ValidateId(id.ToUpperInvariant());}var keep=new List<Receipt>();var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(var r in current){Require(r!=null&&seen.Add(r.Instance));if(!remove.Contains(r.Instance))keep.Add(r);}return keep.ToArray();}
}

