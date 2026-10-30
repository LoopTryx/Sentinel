$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$test=Join-Path $root 'artifacts/AiHistoryTest.cs'
@'
using System;using System.IO;using System.Text;
class Test {static int Main(){var path=Path.Combine(Path.GetTempPath(),"SentinelHistoryTest-"+Guid.NewGuid().ToString("N"));try{var store=new SentinelAiHistory(path);string data="{\"schemaVersion\":1,\"chats\":[{\"id\":\"a\",\"title\":\"test\",\"messages\":[{\"id\":\"m\",\"role\":\"user\",\"text\":\"private sample\"}]}]}";store.Save(data);if(store.Load()!=data)throw new Exception("roundtrip");if(Encoding.UTF8.GetString(File.ReadAllBytes(path)).Contains("private sample"))throw new Exception("plaintext");File.WriteAllText(path,"tampered");bool refused=false;try{store.Load();}catch{refused=true;}if(!refused)throw new Exception("tamper accepted");store.Clear();Console.WriteLine("PASS DPAPI roundtrip, no plaintext, tamper refusal, delete");return 0;}finally{if(File.Exists(path))File.Delete(path);}}}
'@ | Set-Content -LiteralPath $test
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$exe=Join-Path $root 'artifacts/AiHistoryTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$exe) /r:System.Security.dll /r:System.Web.Extensions.dll (Join-Path $root 'apps/desktop/SentinelAiHistory.cs') $test
if($LASTEXITCODE){throw 'History test build failed'}
& $exe
if($LASTEXITCODE){throw 'History test failed'}
