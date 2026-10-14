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
windows-sys = {version = "0.61.2", features = ["Win32_Foundation", "Win32_Security", "Win32_System_Registry"]}
"@ | Set-Content -LiteralPath (Join-Path $probe 'Cargo.toml')
@'
use sentinel_usb::policy::{Entry,Registry,InputPolicy,PolicyBackend};
use sentinel_usb::recovery::{Error,Recovery,Store};
use sentinel_usb::journal::JournalStore;
use std::io::{self,Write};
use std::time::{Duration,Instant,SystemTime,UNIX_EPOCH};
mod native;
fn now()->Result<u64,Error>{Ok(SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_|Error::Invalid)?.as_secs())}
fn message(text:&str)->Result<(),Error>{println!("{text}");io::stdout().flush().map_err(|_|Error::Store)}
fn run()->Result<(),Error>{
 let args:Vec<_>=std::env::args().collect();if args.len()!=3{return Err(Error::Invalid)}let mode=&args[1];let nonce=&args[2];
 let registry=native::WindowsRegistry::isolated(nonce)?;
 let directory=std::env::current_exe().map_err(|_|Error::Store)?.parent().ok_or(Error::Store)?.join("scratch");std::fs::create_dir_all(&directory).map_err(|_|Error::Store)?;
 use std::os::windows::fs::MetadataExt;
 if std::fs::symlink_metadata(&directory).map_err(|_|Error::Store)?.file_attributes()&0x400!=0{return Err(Error::Store)}
 let path=directory.join(format!("{nonce}.journal"));
 let policy=InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE"])?;
 if mode=="cleanup"{return native::WindowsRegistry::cleanup(nonce)}
 if mode=="check"{let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;let mut store=JournalStore::from_trusted_file(file)?;let mut bytes=[0;4096];if store.load_into(&mut bytes)?.is_some(){return Err(Error::Conflict)}let mut registry=registry;if !registry.snapshot()?.is_empty(){return Err(Error::Conflict)}return message("restored")}
 if mode=="recover"{let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;let store=JournalStore::from_trusted_file(file)?;let mut recovery=Recovery::new(store,PolicyBackend::new(registry,policy));recovery.recover_pending()?;return message("recovered")}
 if mode=="arm"{
  let file=std::fs::OpenOptions::new().read(true).write(true).create_new(true).open(&path).map_err(|_|Error::Store)?;
  let store=JournalStore::from_trusted_file(file)?;let mut recovery=Recovery::new(store,PolicyBackend::new(registry,policy));recovery.recover_pending()?;message("ready")?;
  let mut line=String::new();io::stdin().read_line(&mut line).map_err(|_|Error::Store)?;if line.trim()!="apply"{return Err(Error::Invalid)}
  recovery.arm_apply(now()?,2)?;message("armed")?;
  line.clear();io::stdin().read_line(&mut line).map_err(|_|Error::Store)?;return Err(Error::Busy)
 }
 if mode!="watch"{return Err(Error::Invalid)}message("watching")?;let deadline=Instant::now()+Duration::from_secs(10);
 loop{
  if Instant::now()>=deadline{return Err(Error::Busy)}
  let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;
  match JournalStore::from_trusted_file(file){
   Err(Error::Busy)=>{std::thread::sleep(Duration::from_millis(25));continue},Err(error)=>return Err(error),
   Ok(store)=>{let registry=native::WindowsRegistry::isolated(nonce)?;let policy=InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE"])?;let mut recovery=Recovery::new(store,PolicyBackend::new(registry,policy));if recovery.recover_due(now()?)?{return message("recovered")}}
  }
  std::thread::sleep(Duration::from_millis(25));
 }
}
fn main(){if run().is_err(){eprintln!("isolated_probe_failed");std::process::exit(1)}}
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
function Start-Probe([string]$Role){$p=[Diagnostics.Process]::new();$p.StartInfo.FileName=$exe;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardInput=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.ArgumentList.Add($Role);$p.StartInfo.ArgumentList.Add($nonce);if(-not $p.Start()){throw 'Probe start failed'};return $p}
function Read-Marker($Process,[string]$Expected){$line=$Process.StandardOutput.ReadLineAsync();if(-not $line.Wait(5000) -or $line.Result -ne $Expected){throw ('Probe handshake failed: '+$Expected)}}
$broker=$null;$watchdog=$null;$successful=$false
try{
 $broker=Start-Probe 'arm';Read-Marker $broker 'ready'
 $watchdog=Start-Probe 'watch';Read-Marker $watchdog 'watching'
 $broker.StandardInput.WriteLine('apply');$broker.StandardInput.Flush();Read-Marker $broker 'armed'
 # Kill only the test-owned broker after its disposable HKCU delta is durable.
 $broker.Kill();if(-not $broker.WaitForExit(5000)){throw 'Probe broker did not exit'}
 Read-Marker $watchdog 'recovered';if(-not $watchdog.WaitForExit(5000) -or $watchdog.ExitCode -ne 0){throw 'Independent recovery failed'}
 & $exe check $nonce;if($LASTEXITCODE -ne 0){throw 'Native restored state differs'}
 & $exe cleanup $nonce;if($LASTEXITCODE -ne 0){throw 'Owned scratch key cleanup refused'}
 $successful=$true
 Write-Output 'Actual child-process crash -> independent watchdog -> native HKCU restoration and journal clear PASS. No HKLM or device policy changed.'
}finally{
 foreach($p in @($broker,$watchdog)){if($p){try{if(-not $p.HasExited){$p.Kill();[void]$p.WaitForExit(5000)}}finally{$p.Dispose()}}}
 if(-not $successful){
  $recovery=$null
  try{$recovery=Start-Probe 'recover';Read-Marker $recovery 'recovered';if(-not $recovery.WaitForExit(5000) -or $recovery.ExitCode -ne 0){throw 'Recovery failed'};& $exe cleanup $nonce;if($LASTEXITCODE -ne 0){throw 'Cleanup refused'}}
  catch{[pscustomobject]@{state='test_recovery_required';nonce=$nonce;registry=('HKCU:\Software\SentinelUsbRecoveryProbe\'+$nonce);journal=(Join-Path (Split-Path -Parent $exe) ('scratch\'+$nonce+'.journal'))}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $probe 'retained-test-recovery.json');Write-Warning 'Retained inert test state; recovery coordinates recorded in artifacts/usb-recovery-process-probe/retained-test-recovery.json.'}
  finally{if($recovery){try{if(-not $recovery.HasExited){$recovery.Kill();[void]$recovery.WaitForExit(5000)}}finally{$recovery.Dispose()}}}
 }
}
