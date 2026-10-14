$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$probe=Join-Path $repo 'artifacts\usb-native-recovery-engine-test'
New-Item -ItemType Directory -Path (Join-Path $probe 'src') -Force|Out-Null
$provider=(Get-Content (Join-Path $repo 'crates\sentinel-usb\src\policy\windows.rs') -Raw) -replace '(?m)^//!','///'
$provider+=@'
impl WindowsRegistry {
 pub fn isolated(nonce:&str)->Result<Self,Error>{if nonce.len()!=32||!nonce.bytes().all(|b|b.is_ascii_hexdigit()){return Err(Error::Invalid)}Ok(Self{hive:HKEY_CURRENT_USER,path:format!("Software\\SentinelUsbEngineTest\\{nonce}")})}
 pub fn drift(nonce:&str,value:u32)->Result<(),Error>{let registry=Self::isolated(nonce)?;let root=registry.root(true)?.ok_or(Error::Invalid)?;status(unsafe{RegSetValueExW(root.0,wide("DenyDeviceClasses").as_ptr(),0,REG_DWORD,value.to_le_bytes().as_ptr(),4)})}
 pub fn cleanup(nonce:&str)->Result<(),Error>{let mut registry=Self::isolated(nonce)?;if !registry.snapshot()?.is_empty(){return Err(Error::Conflict)}let target=wide(&registry.path);let result=unsafe{RegDeleteTreeW(HKEY_CURRENT_USER,target.as_ptr())};if result==ERROR_FILE_NOT_FOUND{return Ok(())}status(result)}
}
'@
Set-Content (Join-Path $probe 'src\native.rs') $provider
$dependency=(Join-Path $repo 'crates\sentinel-usb').Replace('\','/')
$engine=(Join-Path $repo 'native\usb-broker-engine').Replace('\','/')
@"
[package]
name = "sentinel-usb-native-recovery-engine-test"
version = "0.0.0"
edition = "2024"
[workspace]
[dependencies]
sentinel-usb = {path = "$dependency"}
sentinel-usb-broker-engine = {path = "$engine"}
windows-sys = {version = "0.61.2", features = ["Win32_Foundation", "Win32_Security", "Win32_System_Registry"]}
"@|Set-Content (Join-Path $probe 'Cargo.toml')
@'
use sentinel_usb::policy::{Entry,Registry,InputPolicy,PolicyBackend};
use sentinel_usb::recovery::{Error,Recovery,Store};
use sentinel_usb::journal::JournalStore;
use sentinel_usb_broker_engine::recover_file;
mod native;
fn run()->Result<(),Error>{
 let nonce=std::env::args().nth(1).ok_or(Error::Invalid)?;
 let directory=std::env::current_exe().map_err(|_|Error::Store)?.parent().ok_or(Error::Store)?.to_path_buf();
 let path=directory.join(format!("{nonce}.journal"));
 if std::env::args().nth(2).as_deref()==Some("recover-only"){
  let file=std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store)?;recover_file(file,native::WindowsRegistry::isolated(&nonce)?)?;native::WindowsRegistry::cleanup(&nonce)?;std::fs::remove_file(path).map_err(|_|Error::Store)?;return Ok(())
 }
 let file=std::fs::OpenOptions::new().read(true).write(true).create_new(true).open(&path).map_err(|_|Error::Store)?;
 let ids:Vec<_>=(0..32).map(|i|format!("HID\\SYNTHETIC\\BASELINE{i:02}")).collect();let refs:Vec<_>=ids.iter().map(String::as_str).collect();
 let mut recovery=Recovery::new(JournalStore::from_trusted_file(file)?,PolicyBackend::new(native::WindowsRegistry::isolated(&nonce)?,InputPolicy::new(&refs)?));
 recovery.recover_pending()?;recovery.arm_apply(100,60)?;drop(recovery);
 let mut registry=native::WindowsRegistry::isolated(&nonce)?;native::WindowsRegistry::drift(&nonce,2)?;registry.flush()?;
 let open=||std::fs::OpenOptions::new().read(true).write(true).open(&path).map_err(|_|Error::Store);
 if recover_file(open()?,native::WindowsRegistry::isolated(&nonce)?)!=Err(Error::Conflict){return Err(Error::Invalid)}
 let mut store=JournalStore::from_trusted_file(open()?)?;let mut bytes=[0;4096];if store.load_into(&mut bytes)?.is_none(){return Err(Error::Invalid)}drop(store);
 native::WindowsRegistry::drift(&nonce,1)?;registry.flush()?;
 if !recover_file(open()?,native::WindowsRegistry::isolated(&nonce)?)?{return Err(Error::Invalid)}
 if !registry.snapshot()?.is_empty(){return Err(Error::Conflict)}
 if recover_file(open()?,native::WindowsRegistry::isolated(&nonce)?)?{return Err(Error::Invalid)}
 native::WindowsRegistry::cleanup(&nonce)?;std::fs::remove_file(path).map_err(|_|Error::Store)?;
 println!("Actual native HKCU recovery, drift refusal with journal retained, owned restore/readback/clear and idempotent restart PASS. Machine recovery not invoked.");Ok(())
}
fn main(){if let Err(error)=run(){eprintln!("isolated_native_engine_test_failed: {error:?}");std::process::exit(1)}}
'@|Set-Content (Join-Path $probe 'src\main.rs')
$constants=(Get-Content (Join-Path $repo 'crates\sentinel-usb\src\policy.rs')|Where-Object {$_ -match '^const MAX_(APPROVALS|ENTRIES):'}) -join "`n"
$mainPath=Join-Path $probe 'src\main.rs'
Set-Content $mainPath ($constants+"`n"+(Get-Content $mainPath -Raw))
$nonce=[guid]::NewGuid().ToString('N')
$cargo=Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
$env:PATH=(Join-Path $env:USERPROFILE 'scoop\apps\mingw\current\bin')+';'+$env:PATH
& $cargo build --offline --quiet --manifest-path (Join-Path $probe 'Cargo.toml')
if($LASTEXITCODE -ne 0){throw 'Native recovery-engine test build failed; no scratch registry was created.'}
$target=if($env:CARGO_TARGET_DIR){$env:CARGO_TARGET_DIR}else{Join-Path $probe 'target'}
& (Join-Path $target 'debug\sentinel-usb-native-recovery-engine-test.exe') $nonce
if($LASTEXITCODE -ne 0){throw "Isolated engine test failed; retain scratch recovery namespace SentinelUsbEngineTest/$nonce and its nonce journal for recovery."}
