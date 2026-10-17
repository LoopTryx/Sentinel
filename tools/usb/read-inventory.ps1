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
        $cursor=$id;$evidence='unresolved';$physicalRoot='';$visited=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        for($depth=0;$depth -lt 12;$depth++){
            if(-not $cursor -or $cursor.Length -gt 512 -or -not $visited.Add($cursor) -or -not $map.ContainsKey($cursor)){break}
            if($cursor -match '^(USB|USBSTOR)\\'){$evidence='os_reported'}
            if($cursor -match '^USB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}[^\\]*\\[^\\]+$' -and $cursor -notmatch '&MI_'){$physicalRoot=$cursor;break}
            if($cursor -match '^(BTH|BTHENUM|ACPI|PCI)\\'){if($evidence -ne 'os_reported'){$evidence='not_usb'};break}
            $cursor=[string]$map[$cursor].Parent
        }
        if($evidence -eq 'not_usb'){continue}
        if($evidence -eq 'unresolved' -or -not $physicalRoot){$partial=$true}
        $kind=switch([string]$row.Class){'DiskDrive'{'storage'}'Keyboard'{'hid_keyboard'}'Mouse'{'hid_mouse'}'HIDClass'{'hid_other'}'Net'{'network'}default{'other'}}
        # Only a resolved physical USB parent groups functions. Container IDs are not authority.
        $groupKey=if($physicalRoot){'root:'+ $physicalRoot}else{'node:'+ $id}
        if(-not $groups.Contains($groupKey)){
            if($groups.Count -ge 64){$omitted=[Math]::Min(512,$omitted+1);$partial=$true;continue}
            $groups[$groupKey]=[pscustomobject]@{ref=('device-'+($groups.Count+1));usbEvidence=$evidence;interfaces=[Collections.Generic.HashSet[string]]::new();name=''}
        }
        $name=[string]$row.DisplayName
        if($physicalRoot -and $map[$physicalRoot].DisplayName){$name=[string]$map[$physicalRoot].DisplayName}
        $name=($name -replace '[^\x20-\x7E]','').Trim()
        if($name.Length -gt 80){$name=$name.Substring(0,80)}
        if($name -and $name -notmatch '^(HID[- ]|USB Input Device|USB Composite Device|USB Mass Storage Device|USB Root Hub|Generic USB)'){$groups[$groupKey].name=$name}
        [void]$groups[$groupKey].interfaces.Add($kind)
    }
    $devices=@($groups.Values|ForEach-Object{$item=[ordered]@{ref=$_.ref;usbEvidence=$_.usbEvidence;interfaces=@($_.interfaces|Sort-Object)};if($_.name){$item['name']=$_.name};[pscustomobject]$item})
    [pscustomobject]@{schemaVersion=1;mode='observation_only';state=$(if($partial -or $omitted -gt 0){'partial'}else{'observed'});observedAt=$ObservedAt.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ');omitted=$omitted;devices=$devices}
}
function Get-SentinelUsbSnapshot {
    $ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue'
    try{
        $watch=[Diagnostics.Stopwatch]::StartNew();$partial=$false;$omitted=0
        $nodes=@(Get-PnpDevice -PresentOnly -ErrorAction Stop|Select-Object -First 513)
        if($nodes.Count -gt 512){$nodes=@($nodes|Select-Object -First 512);$partial=$true;$omitted=1}
        $rows=@{};foreach($node in $nodes){$id=[string]$node.InstanceId;if($id.Length -le 512 -and $id -and $id -notmatch '[*?\[\]]'){$rows[$id]=[pscustomobject]@{Id=$id;Class=[string]$node.Class;Parent='';Container=''}}else{$partial=$true}}
        $candidates=@($rows.Values|Where-Object{$_.Id -match '^(USB|USBSTOR|HID)\\' -or $_.Class -in @('Keyboard','Mouse','HIDClass')}|Sort-Object @{Expression={switch($_.Class){'DiskDrive'{0}'Keyboard'{1}'HIDClass'{2}'Mouse'{3}default{4}}}}|Select-Object -First 129)
        if($candidates.Count -gt 128){$partial=$true;$omitted++;$candidates=@($candidates|Select-Object -First 128)}
        $queried=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase);$queries=0
        foreach($candidate in $candidates){
            $cursor=$candidate.Id
            for($depth=0;$depth -lt 12;$depth++){
                if($queries -ge 256 -or $watch.ElapsedMilliseconds -ge 8000){$partial=$true;break}
                if(-not $cursor -or $cursor.Length -gt 512 -or $cursor -match '[*?\[\]]' -or -not $queried.Add($cursor)){break}
                $queries++
                try{
                    $properties=@(Get-PnpDeviceProperty -InstanceId $cursor -KeyName @('DEVPKEY_Device_Parent','DEVPKEY_Device_ContainerId') -ErrorAction Stop)
                    if(-not $rows.ContainsKey($cursor)){
                        if($rows.Count -ge 512){$partial=$true;break}
                        $rows[$cursor]=[pscustomobject]@{Id=$cursor;Class='';Parent='';Container=''}
                    }
                    foreach($property in $properties){if([string]$property.InstanceId -ne $cursor){$partial=$true;continue};if($property.KeyName -eq 'DEVPKEY_Device_Parent'){$rows[$cursor].Parent=[string]$property.Data}elseif($property.KeyName -eq 'DEVPKEY_Device_ContainerId'){$rows[$cursor].Container=[string]$property.Data}elseif($property.KeyName -eq 'DEVPKEY_Device_BusReportedDeviceDesc'){if($rows[$cursor].PSObject.Properties['DisplayName']){$rows[$cursor].DisplayName=[string]$property.Data}else{$rows[$cursor]|Add-Member -NotePropertyName DisplayName -NotePropertyValue ([string]$property.Data)}}}
                    # Optional names must not invalidate ancestry on nodes lacking this property.
                    if($cursor -match '^USB\\VID_' -and $queries -lt 256 -and $watch.ElapsedMilliseconds -lt 8000){
                        $queries++
                        $reported=Get-PnpDeviceProperty -InstanceId $cursor -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue
                        if($reported -and [string]$reported.InstanceId -eq $cursor -and $reported.Data){$rows[$cursor]|Add-Member -NotePropertyName DisplayName -NotePropertyValue ([string]$reported.Data) -Force}
                    }
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
