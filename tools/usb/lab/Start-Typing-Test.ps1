param([string]$ExpectedSha256)
$ErrorActionPreference='Stop'
$volumes=@(Get-Volume | Where-Object {$_.FileSystemLabel -eq 'CIRCUITPY' -and $_.DriveLetter -and $_.DriveLetter -ne 'E' -and $_.DriveType -eq 'Removable'})
if($volumes.Count -ne 1){throw 'Connect exactly one CIRCUITPY test board. E: is excluded.'}
$letter=[string]$volumes[0].DriveLetter
$root=$letter+':\'
$code=Join-Path $root 'code.py'
if(-not $ExpectedSha256){$ExpectedSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'duck-code.py')).Hash}
if($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $code).Hash -ne $ExpectedSha256){throw 'The connected board does not contain the prepared text-only test.'}
$marker=Join-Path $root 'SENTINEL-LAB-ARM.txt'
if(Test-Path -LiteralPath $marker){throw 'An old approval marker exists. Resolve it before reconnecting for a new test.'}
Write-Host 'Reconnect the board first. Open a blank Notepad document.'
Read-Host 'Press Enter here to approve ONE text-only test, then focus Notepad within ten seconds' | Out-Null
try{
 if((Get-Volume -DriveLetter $letter).FileSystemLabel -ne 'CIRCUITPY'){throw 'Board changed'}
 [IO.File]::WriteAllText($marker,'SECONDARY-WINDOWS-NOTEPAD-TEST',[Text.UTF8Encoding]::new($false))
 Write-Host 'Focus Notepad now. The board will type QUACK text only.'
 Start-Sleep -Seconds 15
}finally{
 if((Get-Volume -DriveLetter $letter -ErrorAction SilentlyContinue).FileSystemLabel -eq 'CIRCUITPY' -and (Test-Path -LiteralPath $marker) -and (Get-Content -LiteralPath $marker -Raw) -eq 'SECONDARY-WINDOWS-NOTEPAD-TEST'){
  Remove-Item -LiteralPath $marker
 }
}
Write-Host 'Approval removed. Record whether text actually appeared; silence alone does not prove blocking.'
