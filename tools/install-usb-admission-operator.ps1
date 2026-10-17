#Requires -RunAsAdministrator
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts/Sentinel.UsbGuard.exe'
if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw 'Build the USB Guard operator before installing.'}
Add-Type -Path (Join-Path $root 'tools/usb/DuckyPolicyJournal.cs')
$code=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'SentinelUsbAdmission'
$state=Join-Path $code 'State'
function Assert-ProtectedDirectory([string]$path){
 if(([IO.File]::GetAttributes($path)-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'Reparse directory refused'}
 $acl=Get-Acl -LiteralPath $path
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Untrusted directory owner'}
 foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544') -and ($rule.FileSystemRights -band ([Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership))){throw 'Writable code location refused'}
 }
}
if(!(Test-Path -LiteralPath $code)){[SentinelPolicyDirectory]::Provision($code)}
$codePin=[SentinelPolicyDirectory]::new($code)
try{
 Assert-ProtectedDirectory $code
 $acl=[Security.AccessControl.DirectorySecurity]::new()
 $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
 $acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @('S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow'))
 Set-Acl -LiteralPath $code -AclObject $acl
 if(!(Test-Path -LiteralPath $state)){[SentinelPolicyDirectory]::Provision($state)}
 Assert-ProtectedDirectory $state
 $stateAcl=Get-Acl -LiteralPath $state
 if(!$stateAcl.AreAccessRulesProtected){throw 'State directory must have an isolated DACL'}
 foreach($rule in $stateAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'State directory is not private'}}
 $destination=Join-Path $code 'Sentinel.UsbGuard.exe'
 $temporary=Join-Path $code 'Sentinel.UsbGuard.incoming'
 if(Test-Path -LiteralPath $temporary){throw 'An earlier operator installation needs attention'}
 if((Test-Path -LiteralPath $destination) -and (([IO.File]::GetAttributes($destination)-band [IO.FileAttributes]::ReparsePoint)-ne 0)){throw 'Reparse executable refused'}
 $sourceStream=[IO.FileStream]::new($source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{$destinationStream=[IO.FileStream]::new($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$sourceStream.CopyTo($destinationStream);$destinationStream.Flush($true)}finally{$destinationStream.Dispose()}}finally{$sourceStream.Dispose()}
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash){throw 'Operator installation hash mismatch'}
 if(Test-Path -LiteralPath $destination){
  # Windows PowerShell binds a null backup string as an empty path. Keep an explicit protected backup.
  $backup=Join-Path $code ('Sentinel.UsbGuard.previous-'+[Guid]::NewGuid().ToString('N')+'.exe')
  [IO.File]::Replace($temporary,$destination,$backup)
 }else{[IO.File]::Move($temporary,$destination)}
 Write-Output 'USB Guard operator installed. No USB restrictions have been enabled.'
}finally{$codePin.Dispose()}
