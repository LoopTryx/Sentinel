param([switch]$Restrictive,[switch]$Hang)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$probe=Join-Path $repo 'artifacts\usb-recovery-process-probe'
New-Item -ItemType Directory -Path (Join-Path $probe 'src') -Force|Out-Null
# Compile the authoritative native provider; only doc-comment syntax changes.
$provider=Get-Content -LiteralPath (Join-Path $repo 'crates\sentinel-usb\src\policy\windows.rs') -Raw
$provider=$provider -replace '(?m)^//!','///'
$provider+=@'

impl WindowsRegistry {
 pub fn isolated(nonce:&str)->Result<Self,Error>{if nonce.len()!=32||!nonce.bytes().all(|b|b.is_ascii_hexdigit()){return Err(Error::Invalid)}Ok(Self{hive:HKEY_CURRENT_USER,path:format!("Software\\SentinelUsbRecoveryProbe\\{nonce}")})}
 pub fn cleanup(nonce:&str)->Result<(),Error>{let mut registry=Self::isolated(nonce)?;if !registry.snapshot()?.is_empty(){return Err(Error::Conflict)}let target=wide(&registry.path);let result=unsafe{RegDeleteTreeW(HKEY_CURRENT_USER,target.as_ptr())};if result==ERROR_FILE_NOT_FOUND{return Ok(())}status(result)}
}
'@
Set-Content -LiteralPath (Join-Path $probe 'src\native.rs') -Value $provider
$dependency=(Join-Path $repo 'crates\sentinel-usb').Replace('\','/')
@"
[package]
name = "sentinel-usb-recovery-process-probe"
version = "0.0.0"
edition = "2024"
[workspace]
[dependencies]
sentinel-usb = {path = "$dependency"}
windows-sys = {version = "0.61.2", features = ["Win32_Foundation", "Win32_Security", "Win32_System_Registry", "Win32_System_JobObjects", "Win32_System_Threading"]}
"@ | Set-Content -LiteralPath (Join-Path $probe 'Cargo.toml')
@'
use sentinel_usb::policy::{Entry,Registry,InputPolicy,PolicyBackend,RestrictiveApprovalBackend};
use sentinel_usb::recovery::{Backend,Error,Recovery,Store};
use sentinel_usb::journal::JournalStore;
use std::io::{self,Read,Write};
use std::process::{Command,Stdio,Child};
use std::os::windows::process::CommandExt;
use std::time::{Duration,Instant,SystemTime,UNIX_EPOCH};
mod native;
fn now()->Result<u64,Error>{Ok(SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_|Error::Invalid)?.as_secs())}
fn message(text:&str)->Result<(),Error>{println!("{text}");io::stdout().flush().map_err(|_|Error::Store)}
struct TestBackend(Box<dyn Backend>);
impl Backend for TestBackend {
 fn capture_into(&mut self,out:&mut[u8])->Result<usize,Error>{self.0.capture_into(out)}
 fn apply_if_unchanged(&mut self,record:&[u8])->Result<(),Error>{self.0.apply_if_unchanged(record)}
 fn verify_applied(&mut self)->Result<(),Error>{self.0.verify_applied()}
 fn restore_if_owned(&mut self,record:&[u8])->Result<(),Error>{self.0.restore_if_owned(record)}
 fn verify_restored(&mut self,record:&[u8])->Result<(),Error>{self.0.verify_restored(record)}
}
fn backend(nonce:&str,restrictive:bool)->Result<TestBackend,Error>{
 let registry=native::WindowsRegistry::isolated(nonce)?;let baseline=InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE"])?;
 if restrictive{let next=InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE","HID\\SYNTHETIC\\TEMPORARY"])?;Ok(TestBackend(Box::new(RestrictiveApprovalBackend::new(registry,baseline,next)?)))}else{Ok(TestBackend(Box::new(PolicyBackend::new(registry,baseline))))}
}
struct OwnedBroker(Child);
impl Drop for OwnedBroker{fn drop(&mut self){let _=self.0.kill();let _=self.0.wait();}}
struct OwnedJob(windows_sys::Win32::Foundation::HANDLE);
impl Drop for OwnedJob{fn drop(&mut self){unsafe{windows_sys::Win32::Foundation::CloseHandle(self.0);}}}
fn supervise(nonce:&str,restrictive:bool,hang:bool,path:&std::path::Path)->Result<(),Error>{
 use windows_sys::Win32::System::JobObjects::*;use std::os::windows::io::AsRawHandle;
 let executable=std::env::current_exe().map_err(|_|Error::Platform)?;
 let mut command=Command::new(executable);command.arg("arm").arg(nonce);if restrictive{command.arg("restrictive");}
 command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
 let mut broker=OwnedBroker(command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|_|Error::Platform)?);
 let raw=unsafe{CreateJobObjectW(std::ptr::null(),std::ptr::null())};if raw.is_null(){return Err(Error::Platform)}let _job=OwnedJob(raw);
 let mut info:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=unsafe{std::mem::zeroed()};info.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if unsafe{SetInformationJobObject(raw,JobObjectExtendedLimitInformation,&info as *const _ as *const _,std::mem::size_of_val(&info) as u32)}==0||unsafe{AssignProcessToJobObject(raw,broker.0.as_raw_handle())}==0{return Err(Error::Platform)}
 let mut output=broker.0.stdout.take().ok_or(Error::Platform)?;let(tx,rx)=std::sync::mpsc::sync_channel(2);
 std::thread::spawn(move||{for _ in 0..2{let mut text=Vec::new();let result=loop{let mut byte=[0u8];if output.read_exact(&mut byte).is_err(){break Err(Error::Platform)}if byte[0]==b'\n'{break String::from_utf8(text).map_err(|_|Error::Invalid)}if text.len()>=64{break Err(Error::Invalid)}text.push(byte[0]);};if tx.send(result).is_err(){break}}});
 if rx.recv_timeout(Duration::from_secs(5)).map_err(|_|Error::Platform)??!="ready"{return Err(Error::Platform)}
 let input=broker.0.stdin.as_mut().ok_or(Error::Platform)?;input.write_all(b"apply\n").map_err(|_|Error::Platform)?;input.flush().map_err(|_|Error::Platform)?;
 if rx.recv_timeout(Duration::from_secs(5)).map_err(|_|Error::Platform)??!="armed"{return Err(Error::Platform)}
 message("watching")?;
 // Dedicated guardian owns this exact child. The broker deliberately waits with
 // its journal locked; monotonic expiry terminates only that owned test child.
 if !hang{broker.0.kill().map_err(|_|Error::Platform)?;broker.0.wait().map_err(|_|Error::Platform)?;}
 std::thread::sleep(Duration::from_secs(3));if hang{if broker.0.try_wait().map_err(|_|Error::Platform)?.is_some(){return Err(Error::Platform)}
 broker.0.kill().map_err(|_|Error::Platform)?;broker.0.wait().map_err(|_|Error::Platform)?;}
 let file=std::fs::OpenOptions::new().read(true).write(true).open(path).map_err(|_|Error::Store)?;
 let mut recovery=Recovery::new(JournalStore::from_trusted_file(file)?,backend(nonce,restrictive)?);
 if !recovery.recover_due(now()?)?{return Err(Error::Conflict)}message("recovered")
}
fn run()->Result<(),Error>{
 let args:Vec<_>=std::env::args().collect();if args.len()!=3&&args.len()!=4{return Err(Error::Invalid)}let mode=&args[1];let nonce=&args[2];let restrictive=args.get(3).map(String::as_str)==Some("restrictive");if args.len()==4&&!restrictive{return Err(Error::Invalid)}
 let registry=native::WindowsRegistry::isolated(nonce)?;
 let directory=std::env::current_exe().map_err(|_|Error::Store)?.parent().ok_or(Error::Store)?.join("scratch");std::fs::create_dir_all(&directory).map_err(|_|Error::Store)?;
 use std::os::windows::fs::MetadataExt;
 if std::fs::symlink_metadata(&directory).map_err(|_|Error::Store)?.file_attributes()&0x400!=0{return Err(Error::Store)}
 let path=directory.join(format!("{nonce}.journal"));
 let baseline_path=directory.join(format!("{nonce}-baseline.journal"));
 let policy=InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE"])?;
 if mode=="setup"&&restrictive{let file=std::fs::OpenOptions::new().read(true).write(true).create_new(true).open(&baseline_path).map_err(|_|Error::Store)?;let mut initial=Recovery::new(JournalStore::from_trusted_file(file)?,PolicyBackend::new(registry,policy));initial.recover_pending()?;initial.arm_apply(now()?,30)?;return message("baseline")}
 if mode=="cleanup"{if restrictive{let file=std::fs::OpenOptions::new().read(true).write(true).open(&baseline_path).map_err(|_|Error::Store)?;let mut initial=Recovery::new(JournalStore::from_trusted_file(file)?,PolicyBackend::new(registry,policy));initial.recover_pending()?;drop(initial);std::fs::remove_file(&baseline_path).map_err(|_|Error::Store)?;}return native::WindowsRegistry::cleanup(nonce)}
 if mode=="check"{let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;let mut store=JournalStore::from_trusted_file(file)?;let mut bytes=[0;4096];if store.load_into(&mut bytes)?.is_some(){return Err(Error::Conflict)}if restrictive{backend(nonce,true)?.capture_into(&mut bytes)?;}else{let mut registry=registry;if !registry.snapshot()?.is_empty(){return Err(Error::Conflict)}}return message("restored")}
 if mode=="recover"{let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;let store=JournalStore::from_trusted_file(file)?;let mut recovery=Recovery::new(store,backend(nonce,restrictive)?);recovery.recover_pending()?;return message("recovered")}
 if mode=="arm"{
  let file=std::fs::OpenOptions::new().read(true).write(true).create_new(true).open(&path).map_err(|_|Error::Store)?;
  let store=JournalStore::from_trusted_file(file)?;let mut recovery=Recovery::new(store,backend(nonce,restrictive)?);recovery.recover_pending()?;message("ready")?;
  let mut line=String::new();io::stdin().read_line(&mut line).map_err(|_|Error::Store)?;if line.trim()!="apply"{return Err(Error::Invalid)}
  recovery.arm_apply(now()?,2)?;message("armed")?;
  line.clear();io::stdin().read_line(&mut line).map_err(|_|Error::Store)?;return Err(Error::Busy)
 }
 if mode=="guard"||mode=="guard-crash"{return supervise(nonce,restrictive,mode=="guard",&path)}
 if mode!="watch"{return Err(Error::Invalid)}message("watching")?;let deadline=Instant::now()+Duration::from_secs(10);
 loop{
  if Instant::now()>=deadline{return Err(Error::Busy)}
  let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;
  match JournalStore::from_trusted_file(file){
   Err(Error::Busy)=>{std::thread::sleep(Duration::from_millis(25));continue},Err(error)=>return Err(error),
   Ok(store)=>{let mut recovery=Recovery::new(store,backend(nonce,restrictive)?);if recovery.recover_due(now()?)?{return message("recovered")}}
  }
  std::thread::sleep(Duration::from_millis(25));
 }
}
fn main(){if let Err(error)=run(){eprintln!("isolated_probe_failed: {error:?}");std::process::exit(1)}}
'@ | Set-Content -LiteralPath (Join-Path $probe 'src\main.rs')
$constants=(Get-Content (Join-Path $repo 'crates\sentinel-usb\src\policy.rs')|Where-Object {$_ -match '^const MAX_(APPROVALS|ENTRIES):'}) -join "`n"
$mainPath=Join-Path $probe 'src\main.rs'
Set-Content $mainPath ($constants+"`n"+(Get-Content $mainPath -Raw))
$env:CARGO_TARGET_DIR=Join-Path $probe 'target'
$env:RUSTUP_TOOLCHAIN='1.98.1-x86_64-pc-windows-gnu'
$cargo=Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
& $cargo build --offline --manifest-path (Join-Path $probe 'Cargo.toml') *> (Join-Path $probe 'build.log')
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $probe 'build.log') -Tail 20;throw 'Recovery probe build failed'}
$exe=Join-Path $probe 'target\debug\sentinel-usb-recovery-process-probe.exe'
$nonce=[Guid]::NewGuid().ToString('N')
function Start-Probe([string]$Role){$p=[Diagnostics.Process]::new();$p.StartInfo.FileName=$exe;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardInput=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.ArgumentList.Add($Role);$p.StartInfo.ArgumentList.Add($nonce);if($Restrictive){$p.StartInfo.ArgumentList.Add('restrictive')};if(-not $p.Start()){throw 'Probe start failed'};return $p}
function Read-Marker($Process,[string]$Expected){$line=$Process.StandardOutput.ReadLineAsync();if(-not $line.Wait(5000) -or $line.Result -ne $Expected){throw ('Probe handshake failed: '+$Expected)}}
$broker=$null;$watchdog=$null;$successful=$false
try{
 $extra=@();if($Restrictive){$extra=@('restrictive')}
 if($Restrictive){& $exe setup $nonce @extra;if($LASTEXITCODE -ne 0){throw 'Restrictive scratch baseline setup failed'}}
 $role=if($Hang){'guard'}else{'guard-crash'};$watchdog=Start-Probe $role;Read-Marker $watchdog 'watching'
 Read-Marker $watchdog 'recovered';if(-not $watchdog.WaitForExit(5000) -or $watchdog.ExitCode -ne 0){throw 'Independent recovery failed'}
 & $exe check $nonce @extra;if($LASTEXITCODE -ne 0){throw 'Native restored state differs'}
 & $exe cleanup $nonce @extra;if($LASTEXITCODE -ne 0){throw 'Owned scratch key cleanup refused'}
 $successful=$true
 $scenario=if($Hang){'simulated hang'}else{'child-process crash'}
 if($Restrictive){Write-Output "Actual $scenario -> independent watchdog preserved restrictive baseline; native HKCU readback/journal clear PASS. Explicit scratch cleanup followed. No HKLM or device policy changed."}else{Write-Output "Actual $scenario -> independent watchdog -> native HKCU restoration and journal clear PASS. No HKLM or device policy changed."}
}finally{
 foreach($p in @($broker,$watchdog)){if($p){try{if(-not $p.HasExited){$p.Kill();[void]$p.WaitForExit(5000)}}finally{$p.Dispose()}}}
 if(-not $successful){
  $recovery=$null
  try{$primaryJournal=Join-Path (Split-Path -Parent $exe) ('scratch\'+$nonce+'.journal');if(Test-Path -LiteralPath $primaryJournal){$recovery=Start-Probe 'recover';Read-Marker $recovery 'recovered';if(-not $recovery.WaitForExit(5000) -or $recovery.ExitCode -ne 0){throw 'Recovery failed'}};& $exe cleanup $nonce @extra;if($LASTEXITCODE -ne 0){throw 'Cleanup refused'}}
  catch{[pscustomobject]@{baselineJournal=(Join-Path (Split-Path -Parent $exe) ('scratch\'+$nonce+'-baseline.journal'));state='test_recovery_required';nonce=$nonce;registry=('HKCU:\Software\SentinelUsbRecoveryProbe\'+$nonce);journal=(Join-Path (Split-Path -Parent $exe) ('scratch\'+$nonce+'.journal'))}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $probe 'retained-test-recovery.json');Write-Warning 'Retained inert test state; recovery coordinates recorded in artifacts/usb-recovery-process-probe/retained-test-recovery.json.'}
  finally{if($recovery){try{if(-not $recovery.HasExited){$recovery.Kill();[void]$recovery.WaitForExit(5000)}}finally{$recovery.Dispose()}}}
 }
}
