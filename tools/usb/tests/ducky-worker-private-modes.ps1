$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'ducky-worker-task.ps1') -BuildOnly
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$exe=Join-Path $root 'artifacts/DuckyWorkerHangFixture.exe'
$now=[datetime]::UtcNow
foreach($mode in @('private-baseline','private-hold','private-release','private-held','private-released')){
 $argsText=$mode+' '+[guid]::NewGuid().ToString('N')+' 5 '+$now.AddSeconds(5).Ticks+' '+$now.AddSeconds(30).Ticks+' system'
 $p=Start-Process -FilePath $exe -ArgumentList $argsText -PassThru -WindowStyle Hidden
 if(-not $p.WaitForExit(5000) -or $p.ExitCode -ne 11){throw ('Private worker mode must reject a non-SYSTEM caller before policy access: '+$mode)}
}
Write-Output 'Private native worker modes reject non-SYSTEM callers before policy access PASS'
