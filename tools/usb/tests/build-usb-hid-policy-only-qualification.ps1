$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'build-usb-hid-lifecycle-qualification.ps1')
$s=[IO.File]::ReadAllText($generated).Replace('UsbHidLifecycleQualification','UsbHidPolicyOnlyQualification')
$s=One $s 'sealed class ModeledPnp:UsbHidPnpTransaction.IPnp,UsbHidPnpTransaction.IRecoveryPnp {' 'sealed class ModeledPnp:UsbHidPnpTransaction.IPnp,UsbHidPnpTransaction.IRecoveryPnp,UsbHidPnpTransaction.IPolicyReadPnp { internal bool Uninstalled;public UsbHidSetupApi.Node ReadPolicyTransition(UsbHidSetupApi.Plan p,Action fence){fence();return Read(p);}'
$s=One $s 'public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan p){bool off;' 'public UsbHidSetupApi.Node Read(UsbHidSetupApi.Plan p){if(Uninstalled)return new UsbHidSetupApi.Node(p.Instance,"UninstalledUsbHid",new[]{@"USB\Class_03"},true,0x2000,28,null);bool off;'
$s=One $s 'public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan p,bool enable,Action fence){fence();' 'public UsbHidSetupApi.Result Change(UsbHidSetupApi.Plan p,bool enable,Action fence){if(Uninstalled)throw new InvalidOperationException("policy_only_native_mutation_forbidden");fence();'
$s=One $s 'internal bool Uninstalled;' 'internal bool Uninstalled,NonDisableable;'
$s=One $s 'new[]{@"USB\Class_03"},true,off?0u:8u' 'new[]{@"USB\Class_03"},!NonDisableable,off?0u:8u'
$s=One $s 'if(Uninstalled)throw new InvalidOperationException("policy_only_native_mutation_forbidden");' 'if(Uninstalled||NonDisableable)throw new InvalidOperationException("policy_only_native_mutation_forbidden");'
$extra=@"
 stage=7;string C=@"USB\VID_0004&PID_0001\SYNTHETIC_C";native.Uninstalled=true;var policyOnly=Request(releaseA.After,"allow",new[]{A,C},new[]{C});Commit(store,policyOnly,native,false);Check(store.ReadCommitted().ExternalApprovals.Contains(C));Check(!Own(store,C)&&Own(store,B));native.Uninstalled=false;releaseA=policyOnly;
 stage=8;native.NonDisableable=true;var denyC=Request(releaseA.After,"block",new[]{A},new[]{C});Commit(store,denyC,native,false);Check(!store.ReadCommitted().ExternalApprovals.Contains(C));Check(!Own(store,C)&&Own(store,B));var allowC=Request(denyC.After,"allow",new[]{A,C},new[]{C});Commit(store,allowC,native,false);Check(store.ReadCommitted().ExternalApprovals.Contains(C));Check(!Own(store,C)&&Own(store,B));native.NonDisableable=false;releaseA=allowC;
 stage=9;var request=
"@
$s=One $s 'stage=7;var request=' $extra
$s=One $s 'var request=Request(releaseA.After,"block",new string[0],new[]{A});' 'var request=Request(releaseA.After,"block",new[]{C},new[]{A});'
$generated=Join-Path $root 'artifacts/UsbHidPolicyOnlyQualification.generated.cs'
[IO.File]::WriteAllText($generated,$s)
$target=Join-Path $root 'artifacts/UsbHidPolicyOnlyQualification.exe'
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_LINK_PRIVATE,SENTINEL_USB_HID_JOURNAL_PRIVATE,SENTINEL_USB_HID_PNP_LINKED,SENTINEL_USB_HID_LIFECYCLE_PRIVATE ('/out:'+$target) $sources $generated
if($LASTEXITCODE -ne 0){throw 'Policy-only linked fixture build failed'}
Write-Output ('Built '+$target+' --protected-private-lifecycle; synthetic protected journals only; no fixture executed')
