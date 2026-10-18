using System;

// Pure decision engine. These interfaces are trusted native seams, not browser
// authorization. A real provider must protect/pin storage and gate every native
// save on the pending request/phase, including the RecoveryClaimed writer fence.
public sealed class UsbExactBlockTransaction {
 public enum Status {Unchecked,PolicyVerified,RecoveryRequired}
 public interface IDurableStore {
  UsbExactBlockState.Snapshot ReadCommitted();
  UsbExactBlockState.Transition ReadPending();
  // Atomic CAS: pending absent AND committed equals request.Before.
  void WritePrepared(UsbExactBlockState.Request request);
  void AdvancePending(string requestDigest,UsbExactBlockState.Stage expected,UsbExactBlockState.Stage next);
  // Shares the same protected decision lock with ClaimRecovery. Requires pending
  // PolicyVerified and exact before state, then atomically replaces committed
  // state. A lost reply is resolved by reading the committed generation/digest.
  void CommitCandidate(string requestDigest,UsbExactBlockState.Snapshot before,UsbExactBlockState.Snapshot after);
  // Durably fences late commits/writers before returning current committed state.
  // Idempotent for an already RecoveryClaimed request. Never adopts a candidate.
  UsbExactBlockState.Snapshot ClaimRecovery(string requestDigest);
  void RetirePending(string requestDigest);
 }
 public interface INativeAuthority {
  void ConsumeOwnerProof(UsbExactBlockState.Request request);
  void VerifyFreshExternalScope(UsbExactBlockState.Request request);
 }
 public interface INativeBackend {
  // Null means the authenticated pre-feature baseline, not arbitrary empty HKLM.
  void VerifyPolicy(UsbExactBlockState.Snapshot expected);
  void PrepareIndependentRecovery(UsbExactBlockState.Request request);
  void VerifyIndependentRecovery(UsbExactBlockState.Request request);
  void ApplyCandidate(UsbExactBlockState.Request request);
  void StopProducersAndVerifyQuiescent(UsbExactBlockState.Request request);
  // Only valid after the store's RecoveryClaimed fence. Restore exactly before,
  // preserving its blocks and all authenticated unrelated policy.
  void RestoreBefore(UsbExactBlockState.Request request);
  // Idempotent exact task retirement, verified quiescent; never removes policy.
  void RetireIndependentRecovery(UsbExactBlockState.Request request);
 }
 public interface IClock {DateTime UtcNow{get;}}
 readonly IDurableStore store;readonly INativeBackend backend;readonly INativeAuthority authority;readonly IClock clock;readonly object sync=new object();Status status=Status.Unchecked;DateTime lastUtc=DateTime.MinValue;
 public Status CurrentStatus{get{lock(sync)return status;}}
 public UsbExactBlockTransaction(IDurableStore durableStore,INativeBackend nativeBackend,INativeAuthority nativeAuthority,IClock nativeClock){if(durableStore==null||nativeBackend==null||nativeAuthority==null||nativeClock==null)throw Refused();store=durableStore;backend=nativeBackend;authority=nativeAuthority;clock=nativeClock;}
 static InvalidOperationException Refused(){return new InvalidOperationException("Exact USB block transition refused");}
 void Live(UsbExactBlockState.Request request){DateTime now=clock.UtcNow;if(now.Kind!=DateTimeKind.Utc||now<lastUtc||now<request.IssuedUtc||now>=request.RollbackDeadlineUtc)throw Refused();lastUtc=now;}
 void State(UsbExactBlockState.Snapshot expected){if(!UsbExactBlockState.Same(store.ReadCommitted(),expected))throw Refused();}
 void Pending(UsbExactBlockState.Request request,UsbExactBlockState.Stage phase){var actual=store.ReadPending();if(actual==null||actual.Request.Digest!=request.Digest||actual.Phase!=phase)throw Refused();}
 void Advance(UsbExactBlockState.Request request,UsbExactBlockState.Stage expected,UsbExactBlockState.Stage next){Pending(request,expected);store.AdvancePending(request.Digest,expected,next);Pending(request,next);}
 public void Apply(UsbExactBlockState.Request request){lock(sync){
  status=Status.RecoveryRequired;if(request==null||store.ReadPending()!=null)throw Refused();State(request.Before);backend.VerifyPolicy(request.Before);Live(request);
  authority.ConsumeOwnerProof(request);authority.VerifyFreshExternalScope(request);Live(request);State(request.Before);if(store.ReadPending()!=null)throw Refused();
  store.WritePrepared(request);Pending(request,UsbExactBlockState.Stage.Prepared);
  backend.PrepareIndependentRecovery(request);backend.VerifyIndependentRecovery(request);Advance(request,UsbExactBlockState.Stage.Prepared,UsbExactBlockState.Stage.RecoveryArmed);
  Live(request);State(request.Before);authority.VerifyFreshExternalScope(request);backend.VerifyIndependentRecovery(request);Pending(request,UsbExactBlockState.Stage.RecoveryArmed);
  backend.ApplyCandidate(request);Advance(request,UsbExactBlockState.Stage.RecoveryArmed,UsbExactBlockState.Stage.Applied);
  backend.VerifyPolicy(request.After);authority.VerifyFreshExternalScope(request);Live(request);State(request.Before);Advance(request,UsbExactBlockState.Stage.Applied,UsbExactBlockState.Stage.PolicyVerified);
  Live(request);store.CommitCandidate(request.Digest,request.Before,request.After);State(request.After);
  // No deadline check after this durable decision: committed blocks do not expire.
  Advance(request,UsbExactBlockState.Stage.PolicyVerified,UsbExactBlockState.Stage.Committed);
  backend.StopProducersAndVerifyQuiescent(request);backend.VerifyPolicy(request.After);State(request.After);Pending(request,UsbExactBlockState.Stage.Committed);
  backend.RetireIndependentRecovery(request);Pending(request,UsbExactBlockState.Stage.Committed);State(request.After);store.RetirePending(request.Digest);
  if(store.ReadPending()!=null)throw Refused();backend.VerifyPolicy(request.After);State(request.After);status=Status.PolicyVerified;
 }}
 public void Recover(){lock(sync){
  status=Status.RecoveryRequired;var pending=store.ReadPending();if(pending==null){var current=store.ReadCommitted();backend.VerifyPolicy(current);State(current);status=Status.PolicyVerified;return;}
  var request=pending.Request;var beforeClaim=store.ReadCommitted();if(!UsbExactBlockState.Same(beforeClaim,request.Before)&&!UsbExactBlockState.Same(beforeClaim,request.After))throw Refused();
  var decision=store.ClaimRecovery(request.Digest);Pending(request,UsbExactBlockState.Stage.RecoveryClaimed);
  bool committed=UsbExactBlockState.Same(decision,request.After);if(!committed&&!UsbExactBlockState.Same(decision,request.Before))throw Refused();
  State(decision);backend.StopProducersAndVerifyQuiescent(request);State(decision);Pending(request,UsbExactBlockState.Stage.RecoveryClaimed);
  if(!committed)backend.RestoreBefore(request);backend.VerifyPolicy(decision);State(decision);Pending(request,UsbExactBlockState.Stage.RecoveryClaimed);
  backend.RetireIndependentRecovery(request);State(decision);Pending(request,UsbExactBlockState.Stage.RecoveryClaimed);store.RetirePending(request.Digest);
  if(store.ReadPending()!=null)throw Refused();backend.VerifyPolicy(decision);State(decision);status=Status.PolicyVerified;
 }}
}
