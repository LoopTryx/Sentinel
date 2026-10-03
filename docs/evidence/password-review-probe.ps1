$ErrorActionPreference='Stop'
$exe=Join-Path (Get-Location) 'target/debug/sentinel-cli.exe'
function Invoke-Lesson([string]$id,[string]$choice){
 $si=[Diagnostics.ProcessStartInfo]::new($exe)
 $si.UseShellExecute=$false; $si.RedirectStandardOutput=$true; $si.RedirectStandardError=$true
 foreach($arg in @('academy','password-autopsy',$id,$choice)){$si.ArgumentList.Add($arg)}
 $p=[Diagnostics.Process]::Start($si); $stdout=$p.StandardOutput.ReadToEnd(); $stderr=$p.StandardError.ReadToEnd()
 if(-not $p.WaitForExit(5000)){$p.Kill();throw 'Lesson exceeded test deadline'}
 $code=$p.ExitCode; $p.Dispose()
 return @{code=$code;stdout=$stdout;stderr=$stderr}
}
$ids=@('predictable','reused','unique_generated'); $choices=@('replace_predictable','make_unique','keep_unique')
foreach($i in 0..2){foreach($j in 0..2){
 $out=Invoke-Lesson $ids[$i] $choices[$j]
 if($out.code -ne 0 -or $out.stderr -ne '' -or [Text.Encoding]::UTF8.GetByteCount($out.stdout) -ge 4096){throw 'Success envelope/bound failed'}
 $dto=$out.stdout|ConvertFrom-Json
 if($dto.scenarioId -ne $ids[$i] -or $dto.choice -ne $choices[$j] -or $dto.correct -ne ($i -eq $j) -or $dto.mode -ne 'synthetic_lesson' -or $dto.schemaVersion -ne 1 -or $dto.protectionVerdict -or $dto.realCredentialsAccepted -or $dto.networkAccessed){throw 'Feedback binding/labels failed'}
 $repeat=Invoke-Lesson $ids[$i] $choices[$j]; if($repeat.stdout -ne $out.stdout){throw 'Stateless replay failed'}
}}
foreach($id in @('',('x'*32),('x'*33),('é'*17),'REUSED',"reused`n",'invented-review-marker')){
 $out=Invoke-Lesson $id 'keep_unique'
 if($out.code -ne 1 -or $out.stdout -ne '' -or $out.stderr.Trim() -ne 'Invalid synthetic lesson scenario'){throw 'Invalid ID envelope failed'}
}
foreach($choice in @('', 'invalid-review-choice', 'Keep_unique')){
 $out=Invoke-Lesson 'reused' $choice
 if($out.code -ne 1 -or $out.stdout -ne '' -or $out.stderr.Trim() -ne 'Invalid synthetic lesson choice'){throw 'Invalid choice envelope failed'}
}
'PASS: nine answer bindings; nine deterministic replays; seven invalid IDs; three invalid choices; fixed errors and <4096-byte feedback.'
'Probe uses invented IDs only; no real credential input, file scanning, device access or network.'