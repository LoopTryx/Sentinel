$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& (Join-Path $PSScriptRoot 'build-usb-hid-admission-kernel.ps1') -GenerateOnly|Out-Null
function One([string]$s,[string]$a,[string]$b){if(([regex]::Matches($s,[regex]::Escape($a))).Count -ne 1){throw "Lifecycle fixture shape changed: $a"};return $s.Replace($a,$b)}
$s=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'UsbHidLinkedStoreQualification.cs'))
$s=$s.Replace('UsbHidLinkedStoreQualification','UsbHidLifecycleQualification').Replace('--protected-private-linked','--protected-private-lifecycle')
$s=One $s 'static int checks;' 'static int checks;static UsbHidDeviceLifecycle lifecycle;'
$s=One $s 'sealed class ModeledPnp:UsbHidPnpTransaction.IPnp {' 'sealed class ModeledPnp:UsbHidPnpTransaction.IPnp,UsbHidPnpTransaction.IRecoveryPnp { public UsbHidSetupApi.Node ReadRecovery(UsbHidSetupApi.Plan p,Action fence){fence();return Read(p);}public UsbHidSetupApi.Result ChangeRecovery(UsbHidSetupApi.Plan p,bool enable,Action fence){return Change(p,enable,fence);}'
$s=One $s 'var native=new ModeledPnp();P.Request blockA;' 'var native=new ModeledPnp();lifecycle=UsbHidDeviceLifecycle.Private(nonce,native,(q,id)=>{var node=native.Read(new UsbHidSetupApi.Plan(id,q.TopologyHash,"unused"));return new UsbHidSetupApi.Plan(id,q.TopologyHash,UsbHidSetupApi.TreeBinding(node),node.Status,node.Problem,node.Disableable,"synthetic-connector",UsbHidSetupApi.RecoveryTreeBinding(node));});P.Request blockA;'
$start=$s.IndexOf(' static void Commit(');$end=$s.IndexOf(' static bool Own(')
if($start -lt 0 -or $end -le $start){throw 'Lifecycle methods fixture shape changed'}
$methods=@'
 static void Commit(Store store,P.Request q,ModeledPnp native,bool loseReply){store.WritePrepared(q);store.AdvancePending(q.Digest,P.Stage.Prepared,P.Stage.RecoveryArmed);store.WithWriterFence(q,false,fence=>{var pending=new P.Transition(q,P.Stage.RecoveryArmed);lifecycle.BeforePolicy(q,q.Before,pending,fence);lifecycle.AfterPolicy(q,q.Before,pending,fence);});store.AdvancePending(q.Digest,P.Stage.RecoveryArmed,P.Stage.Applied);store.AdvancePending(q.Digest,P.Stage.Applied,P.Stage.PolicyVerified);lifecycle.AttachCommitHook(store);store.CommitCandidate(q.Digest,q.Before,q.After);Check(P.Same(store.ReadCommitted(),q.After));if(loseReply)return;Reconcile(store,q,native);}
 static void Reconcile(Store store,P.Request q,ModeledPnp native){lifecycle.ReconcileAfterCommit(store,q);store.WithLinkedReadFence((current,pending,fence)=>lifecycle.VerifyRetirement(q,current,pending,fence));store.AdvancePending(q.Digest,P.Stage.PolicyVerified,P.Stage.Committed);store.BeforeLinkedRetirement=null;Refuse(()=>store.RetirePending(q.Digest));lifecycle.AttachCommitHook(store);store.RetirePending(q.Digest);Check(store.ReadPending()==null);}
'@
$s=$s.Substring(0,$start)+$methods+"`r`n"+$s.Substring($end)
$rollback=@'
 stage=6;var rollback=Request(releaseA.After,"block",new string[0],new[]{A});store.WritePrepared(rollback);store.AdvancePending(rollback.Digest,P.Stage.Prepared,P.Stage.RecoveryArmed);store.WithWriterFence(rollback,false,fence=>{var pending=new P.Transition(rollback,P.Stage.RecoveryArmed);lifecycle.BeforePolicy(rollback,rollback.Before,pending,fence);lifecycle.AfterPolicy(rollback,rollback.Before,pending,fence);});Check(native.Disabled[A]);store.ClaimRecovery(rollback.Digest);store.WithWriterFence(rollback,true,fence=>{var pending=new P.Transition(rollback,P.Stage.RecoveryClaimed);lifecycle.RecoverBefore(rollback,rollback.Before,pending,fence);lifecycle.VerifyRetirement(rollback,rollback.Before,pending,fence);});store.RetirePending(rollback.Digest);Check(!native.Disabled[A]&&native.Disabled[B]);
 stage=7;var request=
'@
$s=One $s 'stage=6;var request=' $rollback
$s=$s.Replace('actual protected parent store/link/PnP file assertions','actual protected lifecycle parent/link/PnP journal assertions').Replace('native PnP modeled;','worker lifecycle used; native PnP modeled;')
$generated=Join-Path $root 'artifacts/UsbHidLifecycleQualification.generated.cs'
[IO.File]::WriteAllText($generated,$s)
$sources=@('artifacts/hid-admission-kernel/UsbHidAdmissionTransaction.generated.cs','artifacts/hid-admission-kernel/UsbHidAdmissionFileStore.generated.cs','tools/usb/UsbHidDeviceLifecycle.cs','tools/usb/UsbHidParentCommitLinks.cs','tools/usb/UsbHidAdmissionPolicy.cs','tools/usb/UsbHidCommittedDisableLedger.cs','tools/usb/UsbHidPnpFileJournal.cs','tools/usb/UsbHidPnpTransaction.cs','tools/usb/UsbHidSetupApi.cs','tools/usb/UsbExactBlockState.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs')|ForEach-Object{Join-Path $root $_}
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbHidLifecycleQualification.exe'
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_LINK_PRIVATE,SENTINEL_USB_HID_JOURNAL_PRIVATE,SENTINEL_USB_HID_PNP_LINKED,SENTINEL_USB_HID_LIFECYCLE_PRIVATE ('/out:'+$target) $sources $generated
if($LASTEXITCODE -ne 0){throw 'Device lifecycle qualification build failed'}
Write-Output ('Built '+$target+' --protected-private-lifecycle; explicit elevation required; no fixture executed')
