$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& (Join-Path $PSScriptRoot 'build-usb-hid-admission-backend.ps1') -ReviewedLiveLinked
$backend=[IO.File]::ReadAllText((Join-Path $root 'artifacts/hid-admission-live-linked/UsbExactBlockBackend.generated.cs'))
$tasks=[IO.File]::ReadAllText((Join-Path $root 'artifacts/hid-admission-live-linked/UsbExactBlockRecoveryTasks.generated.cs'))
$worker=[IO.File]::ReadAllText((Join-Path $root 'artifacts/hid-admission-live-linked/UsbExactBlockWorker.generated.cs'))
$store=[IO.File]::ReadAllText((Join-Path $root 'artifacts/hid-admission-kernel/UsbHidAdmissionFileStore.generated.cs'))
$lifecycle=[IO.File]::ReadAllText((Join-Path $root 'tools/usb/UsbHidDeviceLifecycle.cs'))
$checks=0
function Must([bool]$value,[string]$reason){if(!$value){throw $reason};$script:checks++}
Must ($backend.Contains('lifecycle.AttachCommitHook(store)')) 'Worker/controller must bind native commit and retirement hooks'
Must ($backend.Contains('lifecycle.BeforePolicy(request,request.Before')) 'Before-policy preparation missing'
$write=$backend.Substring($backend.IndexOf(' void Write('))
Must ($write.IndexOf('lifecycle.BeforePolicy(') -lt $write.IndexOf('provider.WriteSaved(')) 'PnP prestate must persist before policy mutation'
Must ($write.IndexOf('lifecycle.AfterPolicy(') -gt $write.IndexOf('provider.Verify(desired)')) 'PnP transition must follow saved/effective finalization'
Must ($write.IndexOf('lifecycle.RecoverBefore(') -gt $write.IndexOf('provider.Verify(desired)')) 'Device rollback must follow authenticated policy restoration'
Must ($backend.Contains('lifecycle.ReconcileAfterCommit(store,request)')) 'SYSTEM committed-candidate recovery must reconcile PnP'
Must ($backend.Contains('WithLinkedReadFence((current,pending,fence)=>lifecycle.VerifyRetirement(request,current,pending,fence))')) 'Task retirement must verify PnP under parent decision lease'
Must ($store.Contains('if(callback==null)throw Refused();') -and $store.Contains('#if SENTINEL_USB_HID_PNP_LINKED')) 'Linked build must refuse absent callbacks'
Must ($store.IndexOf('VerifyLinkedRetirement(current);') -lt $store.IndexOf('File.Delete(pending);')) 'Pending deletion must require in-lease retirement hook'
Must ($lifecycle.Contains('store.BeforeLinkedRetirement=VerifyRetirement;')) 'Native lifecycle must bind retirement hook'
Must ($backend.Contains(('Global'+[char]92+'SentinelHidAdmissionJob-')) -and $backend.Contains('AssignProcessToJobObject') -and $backend.Contains('0x00000004|0x08000000')) 'Named suspended worker containment lost'
Must ($tasks.Contains('SentinelHidAdmission') -and $tasks.Contains('Sentinel-HidAdmission-Recover-')) 'Distinct production root/task names required'
Must ($worker.Contains('IsSystem') -and $worker.Contains('ImageName(hash)')) 'SYSTEM recovery and pinned worker identity required'
Must (!$backend.Contains('provider.Managed(') -and !$backend.Contains('state.Blocked')) 'Deny-set provider semantics leaked into admission backend'
Write-Output "PASS $checks generated live linked source-shape/build contracts; no execution or policy/device changes"
