$ErrorActionPreference='Stop'
Add-Type -Path "$PSScriptRoot/../UsbSavedAdmissionEntry.cs"
$exe='C:\Users\LENOVO LOQ\.codex\worktrees\db54\CyberShield\target\debug\sentinel-usb-policy-plan.exe'
if(!(Test-Path $exe)){throw 'Build canonical Rust policy compiler first'}
$id=[Text.Encoding]::ASCII.GetBytes('USB\SYNTHETIC\INTERFACE')
$record=[Text.Encoding]::ASCII.GetBytes('SNTINP03')+[byte]1+[byte]$id.Length+$id
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new($exe);$p.StartInfo.UseShellExecute=$false;$p.StartInfo.RedirectStandardInput=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.CreateNoWindow=$true
try {
 [void]$p.Start();$p.StandardInput.BaseStream.Write($record,0,$record.Length);$p.StandardInput.Close()
 $memory=[IO.MemoryStream]::new();try{$p.StandardOutput.BaseStream.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose()}
 if(!$p.WaitForExit(5000)-or $p.ExitCode -ne 0){throw 'Canonical compiler failed'}
 [IO.File]::WriteAllBytes((Join-Path $PSScriptRoot '../../../artifacts/usb-admission-private-plan.bin'),$bytes)
 $values=[UsbSavedAdmissionEntry]::DecodePlan($bytes)
 if($values.Length -ne 6){throw 'Canonical plan mismatch'}
 foreach($invalid in @([byte[]]($bytes+[byte]0),[byte[]]($bytes[0..8]))){$refused=$false;try{[UsbSavedAdmissionEntry]::DecodePlan($invalid)}catch{$refused=$true};if(!$refused){throw 'Malformed plan accepted'}}
 Write-Output 'PASS actual Rust policy compiler to native saved-entry decoder; malformed/trailing plans refused; no policy writes'
}finally{if(!$p.HasExited){$p.Kill()};$p.Dispose()}
