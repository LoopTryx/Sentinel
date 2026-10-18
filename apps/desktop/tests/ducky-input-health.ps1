$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$fixture=Join-Path $root 'artifacts/DuckyInputHealthTest.cs'
@'
class InputHealthTest {
 static int Main(){
  var property=typeof(DuckyInputHealth).GetField("CM_DRP_CLASSGUID",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static);if(property==null||(uint)property.GetRawConstantValue()!=9)return 6;
  if(DuckyInputHealth.Classify(true,true,false,false)!="input_missing")return 1;
  if(DuckyInputHealth.Classify(true,true,true,true)!="input_error")return 2;
  if(DuckyInputHealth.Classify(true,true,true,false)!="ready")return 3;
  if(DuckyInputHealth.Classify(false,false,false,false)!="disconnected")return 4;
  if(DuckyInputHealth.Classify(true,false,true,false)!="input_error")return 5;
  return 0;
 }
}
'@ | Set-Content -LiteralPath $fixture
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe ('/out:'+(Join-Path $root 'artifacts/DuckyInputHealthTest.exe')) (Join-Path $root 'apps/desktop/DuckyInputHealth.cs') $fixture
if($LASTEXITCODE -ne 0){throw 'Input health compile failed'}
& (Join-Path $root 'artifacts/DuckyInputHealthTest.exe')
if($LASTEXITCODE -ne 0){throw 'Parent-only recovery was accepted'}
Write-Output 'Ducky parent-only, missing HID, failed child and disconnected recovery regressions PASS; no policy changed'
