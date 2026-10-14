param([ValidateSet('Probe','Hold','Restore','Status')][string]$Mode='Probe',[string]$ReceiptPath)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'targeted-hold-core.ps1')
function Get-BoardKeyboard {
 $roots=@(Get-PnpDevice -PresentOnly | Where-Object {$_.InstanceId -match '^USB\\VID_' -and $_.InstanceId -notmatch '&MI_'})
 $board=@($roots|Where-Object {(Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName DEVPKEY_Device_BusReportedDeviceDesc -ErrorAction SilentlyContinue).Data -eq 'RP2040-Zero'})
 if($board.Count -ne 1){throw 'Exactly one RP2040-Zero required'}
 $found=@();foreach($n in @(Get-PnpDevice -PresentOnly -Class Keyboard)){
  $cursor=$n.InstanceId;for($i=0;$i -lt 6;$i++){
   $parent=(Get-PnpDeviceProperty -InstanceId $cursor -KeyName DEVPKEY_Device_Parent -ErrorAction Stop).Data
   if($parent -eq $board[0].InstanceId){$found+=$n;break}
   if(-not $parent -or $parent -eq $cursor){break};$cursor=$parent
  }
 }
 if($found.Count -ne 1){throw 'Exactly one keyboard must correlate to board'}
 return @{keyboard=$found[0].InstanceId;root=$board[0].InstanceId;problem=[int](Get-PnpDeviceProperty -InstanceId $found[0].InstanceId -KeyName DEVPKEY_Device_ProblemCode).Data}
}
function Read-TargetKeyboard($Id){
 return @{id=$Id;class='Keyboard';root=$target.root;problem=[SentinelDuckyNative]::Read($Id,$target.root)}
}
$nativeSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'DuckyNativeBackend.cs'))
if('SentinelDuckyNative' -as [type]){throw 'Native backend already loaded; use a fresh process'};Add-Type -TypeDefinition $nativeSource
$target=Get-BoardKeyboard
if($Mode -eq 'Probe'){
 [pscustomobject]@{device='RP2040-Zero';keyboardInterfaces=1;problem=$target.problem;blocked=($target.problem -eq 22);scope='known_connected_device';firstInputPrevention='unverified'}|ConvertTo-Json
 return
}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Administrator approval required; nothing changed'}
# SYSTEM task uses a self-contained, fixed native enable payload; never loads a workspace script at execution.
$recoveryHost=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
if($target.keyboard -notmatch '^HID\\[A-Za-z0-9_&\\{}#-]+$'){throw 'Target cannot be represented safely'}
if(-not ('SentinelTargetDirectory' -as [type])){
 Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public sealed class SentinelTargetDirectory : IDisposable {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [StructLayout(LayoutKind.Sequential)] struct Info {public uint attributes;public System.Runtime.InteropServices.ComTypes.FILETIME creation,access,write;public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
 [StructLayout(LayoutKind.Sequential)] struct Security {public int size;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref Security security);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 public static void Provision(string path){IntPtr descriptor;uint size;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)",1,out descriptor,out size))throw new InvalidOperationException("Recovery descriptor failed");try{Security security=new Security{size=Marshal.SizeOf(typeof(Security)),descriptor=descriptor,inherit=0};if(!CreateDirectory(path,ref security)&&Marshal.GetLastWin32Error()!=183)throw new InvalidOperationException("Recovery provision failed");}finally{LocalFree(descriptor);}}
 readonly SafeFileHandle handle;
 public SentinelTargetDirectory(string path){handle=CreateFile(path,0x80000000,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);Info info;if(handle.IsInvalid||!GetFileInformationByHandle(handle,out info)||(info.attributes&0x400)!=0||(info.attributes&0x10)==0){handle.Dispose();throw new InvalidOperationException("Unsafe recovery directory");}}
 public void Dispose(){handle.Dispose();}
}
"@
}
$anchors=[Collections.Generic.List[IDisposable]]::new()
try {
foreach($ancestor in @([IO.Path]::GetPathRoot($env:ProgramData),$env:ProgramData)){
 $anchors.Add([SentinelTargetDirectory]::new($ancestor))
 $parentAcl=Get-Acl -LiteralPath $ancestor
 $owner=$parentAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value
 if($owner -notin @('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')){throw 'Untrusted recovery ancestor owner'}
 foreach($rule in $parentAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464') -and -not ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and ($rule.FileSystemRights -band ([Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership))){throw 'Recovery ancestor permits replacement'}
 }
}
$base=Join-Path $env:ProgramData 'SentinelTargetedUsbHold'
[SentinelTargetDirectory]::Provision($base)
if((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Recovery directory must not be a link'}
$anchors.Add([SentinelTargetDirectory]::new($base))
$acl=Get-Acl -LiteralPath $base
if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Recovery owner untrusted'}
if(-not $acl.AreAccessRulesProtected){throw 'Recovery directory has inherited permissions'}
foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Recovery directory permissions too broad'}}
$lock=[IO.FileStream]::new((Join-Path $base '.operation-lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$anchors.Add($lock)
$recoveryEncoded=New-SentinelNativeRestorePayload $nativeSource $target.keyboard $target.root
function New-RestoreTask($Id,$At,$Name){
  $action=New-ScheduledTaskAction -Execute $recoveryHost -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand '+$recoveryEncoded)
 $trigger=New-ScheduledTaskTrigger -Once -At $At -RepetitionInterval (New-TimeSpan -Minutes 1)
 $principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
 Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -ErrorAction Stop|Out-Null
}
if($Mode -eq 'Hold'){
 if($target.problem -ne 0){throw 'Target is already unhealthy or disabled'}
 $existing=@(Get-ChildItem -LiteralPath $base -Filter '*.json')
 if($existing.Count){throw 'Resolve existing hold receipt before another hold'}
 $nonce=[Guid]::NewGuid().ToString('N');$task='Sentinel-Ducky-Restore-'+$nonce
 $stage='recovery-probe-task'
 # Exercise independent scheduled enable on healthy exact target BEFORE disabling.
 New-RestoreTask $target.keyboard ([datetime]::Now.AddSeconds(3)) $task
 try{
  $stage='recovery-probe-result'
  $watch=[Diagnostics.Stopwatch]::StartNew();$ran=$false
  while($watch.Elapsed.TotalSeconds -lt 30){$info=Get-ScheduledTaskInfo -TaskName $task;if($info.LastRunTime -gt [datetime]::Now.AddMinutes(-1) -and $info.LastTaskResult -eq 0){$ran=$true;break};Start-Sleep -Milliseconds 250}
  if(-not $ran){throw 'Independent recovery command probe failed'}
  $stage='recovery-probe-identity'
  if([SentinelDuckyNative]::Read($target.keyboard,$target.root) -ne 0){throw 'Device changed during recovery probe'}
  Unregister-ScheduledTask -TaskName $task -Confirm:$false
  $stage='restore-task-arm'
  $deadline=[datetime]::UtcNow.AddSeconds(120)
  New-RestoreTask $target.keyboard $deadline.ToLocalTime() $task
  $target.nonce=$nonce;$target.restoreDeadline=$deadline;$target.task=$task
  $ReceiptPath=Join-Path $base ($nonce+'.json')
  $provider=@{
   Read={param($id) Read-TargetKeyboard $id}
   Persist={param($record) $bytes=[Text.Encoding]::UTF8.GetBytes(($record|ConvertTo-Json));$file=[IO.FileStream]::new($ReceiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$file.Write($bytes,0,$bytes.Length);$file.Flush($true)}finally{$file.Dispose()}}
   Disable={param($id) if([SentinelDuckyNative]::Disable($id,$target.root) -ne 22){throw 'native_disable_not_verified'}}
   Enable={param($id) if([SentinelDuckyNative]::Enable($id,$target.root) -ne 0){throw 'native_restore_not_verified'}}
  }
  $stage='native-hold'
  $result=Invoke-SentinelTargetHold $target $provider
  [pscustomobject]@{state=$result.state;problem=22;automaticRestoreUtc=$deadline.ToString('o');receipt=$ReceiptPath;firstInputPrevention='unverified'}|ConvertTo-Json
  }catch{
  $detail='error_'+$_.Exception.HResult
  if($_.Exception.Message -match 'native_configuration_error_[0-9]+|Target identity or state changed|Invalid target receipt|Restore deadline invalid|Restore deadline elapsed before disable|invalid_target|not_keyboard|board_ancestry_changed|not_selected_board|native_disable_not_verified|native_restore_not_verified'){$detail=$Matches[0]}
  throw ('Targeted hold failed at '+$stage+'; '+$detail+'; no success claimed')
 }
 return
}
if(-not $ReceiptPath){throw 'Exact receipt path required'}
$path=[IO.Path]::GetFullPath($ReceiptPath)
if([IO.Path]::GetDirectoryName($path) -ine [IO.Path]::GetFullPath($base) -or [IO.Path]::GetFileName($path) -notmatch '^[0-9a-f]{32}\.json$' -or ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Invalid recovery receipt path'}
$r=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
if($r.nonce -notmatch '^[0-9a-f]{32}$' -or $r.task -cne ('Sentinel-Ducky-Restore-'+$r.nonce) -or $r.keyboard -cne $target.keyboard -or $r.root -cne $target.root){throw 'Receipt does not match currently connected board'}
$receipt=@{};foreach($property in $r.PSObject.Properties){$receipt[$property.Name]=$property.Value}
if($Mode -eq 'Status'){[pscustomobject]@{state=$(if($target.problem -eq 22){'held'}elseif($target.problem -eq 0){'enabled'}else{'error'});problem=$target.problem;restoreDeadline=$r.restoreDeadline;taskState=[string](Get-ScheduledTask -TaskName $r.task).State}|ConvertTo-Json;return}
$provider=@{
 Read={param($id) Read-TargetKeyboard $id}
 Enable={param($id) if([SentinelDuckyNative]::Enable($id,$target.root) -ne 0){throw 'native_restore_not_verified'}}
 Complete={param($record) Unregister-ScheduledTask -TaskName $record.task -Confirm:$false;Move-Item -LiteralPath $path -Destination ($path+'.restored')}
}
$result=Invoke-SentinelTargetRestore $receipt $provider
[pscustomobject]@{state=$result.state;problem=0}|ConvertTo-Json
}finally{foreach($anchor in $anchors){$anchor.Dispose()}}
