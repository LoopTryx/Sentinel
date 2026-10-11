param([switch]$Worker)
# Read-only present-device inventory. No volume enumeration, file reads or policy actions.
function New-SentinelUnavailableSnapshot {
    [pscustomobject]@{schemaVersion=1;mode='observation_only';state='unavailable';observedAt=[datetime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ');omitted=0;devices=@()}
}
function ConvertTo-SentinelUsbSnapshot {
    param([AllowEmptyCollection()][object[]]$Rows=@(),[datetime]$ObservedAt=[datetime]::UtcNow,[switch]$DiscoveryPartial,[int]$InitialOmitted=0)
    $partial=[bool]$DiscoveryPartial;$omitted=[Math]::Max(0,[Math]::Min(512,$InitialOmitted));$map=@{};$ordered=[Collections.Generic.List[object]]::new()
    foreach($row in $Rows){
        if($ordered.Count -ge 512){$omitted=[Math]::Min(512,$omitted+1);$partial=$true;break}
        $id=[string]$row.Id
        if(-not $id -or $id.Length -gt 512 -or $id -match '[*?\[\]]' -or $map.ContainsKey($id)){$partial=$true;continue}
        $map[$id]=$row;$ordered.Add($row)
    }
    $groups=[ordered]@{}
    foreach($row in $ordered){
        $id=[string]$row.Id
        if($id -notmatch '^(USB|USBSTOR|HID)\\' -and [string]$row.Class -notin @('Keyboard','Mouse','HIDClass')){continue}
        $cursor=$id;$evidence='unresolved';$visited=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        for($depth=0;$depth -lt 8;$depth++){
            if($cursor -match '^(USB|USBSTOR)\\'){$evidence='os_reported';break}
            if($cursor -match '^(BTH|BTHENUM|ACPI|PCI)\\'){$evidence='not_usb';break}
            if(-not $visited.Add($cursor) -or -not $map.ContainsKey($cursor)){break}
            $cursor=[string]$map[$cursor].Parent
            if(-not $cursor -or $cursor.Length -gt 512){break}
        }
        if($evidence -eq 'not_usb'){continue}
        if($evidence -eq 'unresolved'){$partial=$true}
        $kind=switch([string]$row.Class){'DiskDrive'{'storage'}'Keyboard'{'hid_keyboard'}'Mouse'{'hid_mouse'}'HIDClass'{'hid_other'}'Net'{'network'}default{'other'}}
        $container=[guid]::Empty;$validContainer=[guid]::TryParse([string]$row.Container,[ref]$container) -and $container -ne [guid]::Empty
        # Unresolved ancestry never joins another device merely by a claimed container.
        $groupKey=if($validContainer -and $evidence -eq 'os_reported'){'container:'+ $container.ToString()}else{'node:'+ $id}
        if(-not $validContainer){$partial=$true}
        if(-not $groups.Contains($groupKey)){
            if($groups.Count -ge 64){$omitted=[Math]::Min(512,$omitted+1);$partial=$true;continue}
            $groups[$groupKey]=[pscustomobject]@{ref=('device-'+($groups.Count+1));usbEvidence=$evidence;interfaces=[Collections.Generic.HashSet[string]]::new()}
        }
        [void]$groups[$groupKey].interfaces.Add($kind)
    }
    $devices=@($groups.Values|ForEach-Object{[pscustomobject]@{ref=$_.ref;usbEvidence=$_.usbEvidence;interfaces=@($_.interfaces|Sort-Object)}})
    [pscustomobject]@{schemaVersion=1;mode='observation_only';state=$(if($partial -or $omitted -gt 0){'partial'}else{'observed'});observedAt=$ObservedAt.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ');omitted=$omitted;devices=$devices}
}
function Get-SentinelUsbSnapshot {
    $ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue'
    try{
        $watch=[Diagnostics.Stopwatch]::StartNew();$partial=$false;$omitted=0
        $nodes=@(Get-PnpDevice -PresentOnly -ErrorAction Stop|Select-Object -First 513)
        if($nodes.Count -gt 512){$nodes=@($nodes|Select-Object -First 512);$partial=$true;$omitted=1}
        $rows=@{};foreach($node in $nodes){$id=[string]$node.InstanceId;if($id.Length -le 512 -and $id -and $id -notmatch '[*?\[\]]'){$rows[$id]=[pscustomobject]@{Id=$id;Class=[string]$node.Class;Parent='';Container=''}}else{$partial=$true}}
        $candidates=@($rows.Values|Where-Object{$_.Id -match '^(USB|USBSTOR|HID)\\' -or $_.Class -in @('Keyboard','Mouse','HIDClass')}|Select-Object -First 129)
        if($candidates.Count -gt 128){$partial=$true;$omitted++;$candidates=@($candidates|Select-Object -First 128)}
        $queried=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase);$queries=0
        foreach($candidate in $candidates){
            $cursor=$candidate.Id
            for($depth=0;$depth -lt 8;$depth++){
                if($queries -ge 256 -or $watch.ElapsedMilliseconds -ge 8000){$partial=$true;break}
                if(-not $cursor -or $cursor.Length -gt 512 -or $cursor -match '[*?\[\]]' -or -not $queried.Add($cursor)){break}
                $queries++
                try{
                    $properties=@(Get-PnpDeviceProperty -InstanceId $cursor -KeyName @('DEVPKEY_Device_Parent','DEVPKEY_Device_ContainerId') -ErrorAction Stop)
                    if(-not $rows.ContainsKey($cursor)){
                        if($rows.Count -ge 512){$partial=$true;break}
                        $rows[$cursor]=[pscustomobject]@{Id=$cursor;Class='';Parent='';Container=''}
                    }
                    foreach($property in $properties){if([string]$property.InstanceId -ne $cursor){$partial=$true;continue};if($property.KeyName -eq 'DEVPKEY_Device_Parent'){$rows[$cursor].Parent=[string]$property.Data}elseif($property.KeyName -eq 'DEVPKEY_Device_ContainerId'){$rows[$cursor].Container=[string]$property.Data}}
                    $cursor=$rows[$cursor].Parent
                }catch{$partial=$true;break}
            }
        }
        ConvertTo-SentinelUsbSnapshot -Rows @($rows.Values) -DiscoveryPartial:$partial -InitialOmitted $omitted
    }catch{New-SentinelUnavailableSnapshot}
}
if($MyInvocation.InvocationName -eq '.'){return}
if($Worker){
    $snapshot=Get-SentinelUsbSnapshot
    ConvertTo-Json -InputObject $snapshot -Depth 6 -Compress
    exit 0
}
# Put potentially stalled PnP queries in an owned process with a total deadline.
$process=[Diagnostics.Process]::new()
try{
    $process.StartInfo.FileName=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $process.StartInfo.Arguments='-NoProfile -NonInteractive -File "'+$PSCommandPath+'" -Worker'
    $process.StartInfo.UseShellExecute=$false;$process.StartInfo.CreateNoWindow=$true
    $process.StartInfo.RedirectStandardOutput=$true;$process.StartInfo.RedirectStandardError=$true
    if(-not $process.Start()){throw 'discovery unavailable'}
    # The trusted worker emits only fixed-schema, bounded, redacted fields.
    $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    if(-not $process.WaitForExit(10000)){throw 'discovery timeout'}
    if(-not $stdout.Wait(1000) -or -not $stderr.Wait(1000) -or $process.ExitCode -ne 0){throw 'discovery unavailable'}
    $text=$stdout.Result
    if($text.Length -gt 32768){throw 'discovery oversized'}
    $text.Trim()
}catch{ConvertTo-Json -InputObject (New-SentinelUnavailableSnapshot) -Depth 6 -Compress}
finally{try{if(-not $process.HasExited){$process.Kill();[void]$process.WaitForExit(1500)}}catch{};$process.Dispose()}
