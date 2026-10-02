param([switch]$Smoke)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms
. (Join-Path $PSScriptRoot 'ScanJob.ps1')
$script:scanJob = $null

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cli = Join-Path $root 'target\debug\sentinel-cli.exe'
$fixture = Get-Content -Raw (Join-Path $root 'data\fixtures\status.json') | ConvertFrom-Json

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Title="Sentinel" Width="1040" Height="700" MinWidth="760" MinHeight="540" Background="#0B1220" Foreground="#E8EEF8" WindowStartupLocation="CenterScreen">
  <Grid>
    <Grid.ColumnDefinitions><ColumnDefinition Width="205"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
    <Border Background="#111D30" BorderBrush="#26354A" BorderThickness="0,0,1,0">
      <DockPanel Margin="18,25,16,18">
        <StackPanel DockPanel.Dock="Top">
          <TextBlock Text="SENTINEL" FontSize="21" FontWeight="Bold" Foreground="#7CD7E8" Margin="4,0,0,4"/>
          <TextBlock Text="Local preview" FontSize="12" Foreground="#9EB0C8" Margin="4,0,0,24"/>
          <ListBox Name="Navigation" Background="Transparent" BorderThickness="0" Foreground="#E8EEF8" FontSize="15" SelectedIndex="0">
            <ListBoxItem Content="Overview"/><ListBoxItem Content="Files"/><ListBoxItem Content="Devices"/><ListBoxItem Content="Wi-Fi"/><ListBoxItem Content="Web"/><ListBoxItem Content="Vault"/><ListBoxItem Content="Messages"/><ListBoxItem Content="Learning"/><ListBoxItem Content="Settings"/>
          </ListBox>
        </StackPanel>
        <TextBlock DockPanel.Dock="Bottom" Text="No active protection service" Foreground="#F4B17A" TextWrapping="Wrap" FontSize="12" Margin="4,10,0,0"/>
      </DockPanel>
    </Border>
    <ScrollViewer Grid.Column="1" VerticalScrollBarVisibility="Auto">
      <StackPanel Margin="32,28,32,28">
        <TextBlock Name="PageTitle" Text="Overview" FontSize="29" FontWeight="Bold"/>
        <TextBlock Name="PageSubtitle" Text="Local status preview. No active protection service is installed." Foreground="#A9B9D1" FontSize="14" Margin="0,8,0,25" TextWrapping="Wrap"/>
        <Border Name="StatusCard" Background="#15243A" CornerRadius="12" Padding="20" Margin="0,0,0,18">
          <StackPanel>
            <TextBlock Text="CURRENT COVERAGE" Foreground="#7CD7E8" FontWeight="Bold" FontSize="12"/>
            <TextBlock Text="Unavailable" FontSize="23" FontWeight="SemiBold" Margin="0,7,0,4"/>
            <TextBlock Text="Fixture status only. No live agent connection or system protection." Foreground="#B7C6D9" TextWrapping="Wrap"/>
          </StackPanel>
        </Border>
        <Border Name="DetailCard" Background="#15243A" CornerRadius="12" Padding="20" Margin="0,0,0,18">
          <StackPanel>
            <TextBlock Name="DetailHeading" Text="Capability status" FontSize="18" FontWeight="SemiBold" Margin="0,0,0,10"/>
            <TextBlock Name="DetailText" TextWrapping="Wrap" LineHeight="25" Foreground="#C4D1E1"/>
          </StackPanel>
        </Border>
        <Border Name="FileCard" Background="#15243A" CornerRadius="12" Padding="20" Visibility="Collapsed">
          <StackPanel>
            <TextBlock Text="Read-only file or folder scan" FontSize="18" FontWeight="SemiBold" Margin="0,0,0,7"/>
            <TextBlock Text="Select a file or folder. This limited local preview does not quarantine or grant USB access." TextWrapping="Wrap" Foreground="#B7C6D9" Margin="0,0,0,14"/>
                        <WrapPanel>
              <Button Name="ScanButton" Content="Choose file and scan" Width="185" Height="38" Margin="0,0,10,8" Background="#237C91" Foreground="White" BorderThickness="0"/>
              <Button Name="FolderButton" Content="Choose folder and scan" Width="185" Height="38" Margin="0,0,10,8"/>
              <Button Name="CancelButton" Content="Cancel scan" Width="120" Height="38" Margin="0,0,0,8" IsEnabled="False"/>
            </WrapPanel>
            <ProgressBar Name="ScanProgress" Height="8" IsIndeterminate="True" Visibility="Collapsed"/>
            <TextBlock Name="ScanResult" Text="No file selected." TextWrapping="Wrap" Foreground="#D9E5F4" Margin="0,16,0,0"/>
          </StackPanel>
        </Border>
      </StackPanel>
    </ScrollViewer>
  </Grid>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader($xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)
$navigation = $window.FindName('Navigation')
$title = $window.FindName('PageTitle')
$subtitle = $window.FindName('PageSubtitle')
$detail = $window.FindName('DetailText')
$detailHeading = $window.FindName('DetailHeading')
$fileCard = $window.FindName('FileCard')
$scanButton = $window.FindName('ScanButton')
$scanResult = $window.FindName('ScanResult')
$folderButton = $window.FindName('FolderButton')
$cancelButton = $window.FindName('CancelButton')
$scanProgress = $window.FindName('ScanProgress')

$pages = @{
  'Overview' = 'File scanner: read-only preview available on the Files page.`nUSB storage gate: untested.`nUSB HID gate: untested.`nWeb shield: extension harness only; no native host connection.'
  'Files' = 'A selected file can be checked with the bounded local scanner. Coverage remains partial and the full signature engine is inactive.'
  'Devices' = 'USB storage hold and HID input gate are untested. No policy is changed in this preview.'
  'Wi-Fi' = 'Passive Wi-Fi observations are not connected to this desktop window yet.'
  'Web' = 'Chrome extension harness is separate. A native host connection has not been verified.'
  'Vault' = 'Encrypted vault is unavailable. Do not enter valuable credentials.'
  'Messages' = 'Mail and chat analysis is unavailable.'
  'Learning' = 'Lessons are unavailable in this desktop preview.'
  'Settings' = 'Privacy and provider controls are unavailable. No provider requests or policy changes are enabled.'
}

$navigation.Add_SelectionChanged({
  $page = [string]$navigation.SelectedItem.Content
  $title.Text = $page
  $subtitle.Text = if ($page -eq 'Files') { 'User-selected local scan with partial coverage.' } else { 'Local preview. Missing capabilities are shown as unavailable.' }
  $detailHeading.Text = if ($page -eq 'Overview') { 'Capability status' } else { "$page status" }
  $detail.Text = $pages[$page].Replace('`n', [Environment]::NewLine)
  $fileCard.Visibility = if ($page -eq 'Files') { 'Visible' } else { 'Collapsed' }
})
$navigation.SelectedIndex = 1
$navigation.SelectedIndex = 0

function Start-SelectedScan([string]$Path, [string]$Kind) {
  if ($script:scanJob) { return }
  if (-not (Test-Path -LiteralPath $cli)) {
    $scanResult.Text = 'Scanner executable is unavailable. Build sentinel-cli before scanning.'
    return
  }
  try {
    $script:scanJob = Start-SentinelProcessJob -Executable $cli -Arguments @('scan', $Kind, $Path)
    $script:scanKind = $Kind
    $scanButton.IsEnabled = $false
    $folderButton.IsEnabled = $false
    $cancelButton.IsEnabled = $true
    $scanProgress.Visibility = 'Visible'
    $scanResult.Text = 'Scanning selected item. Coverage remains partial; percentage progress is unavailable.'
    $timer.Start()
  } catch {
    $scanResult.Text = 'Scanner could not start. Coverage: incomplete.'
  }
}
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(100)
$timer.Add_Tick({
  if (-not $script:scanJob) { return }
  try {
    $state = Get-SentinelProcessJob $script:scanJob
    if ($state -eq 'Running') {
      $scanResult.Text = if ($script:scanJob.StopReason) {
        'Stopping scan. No completed result is available.'
      } else {
        'Scanning selected item... Elapsed: {0:N0}s. Coverage: partial; percentage progress unavailable.' -f $script:scanJob.Clock.Elapsed.TotalSeconds
      }
      return
    }
    if ($state -eq 'Completed') {
      $report = ConvertFrom-SentinelScanReport $script:scanJob.Output $script:scanKind
      if ($report.mode -ne 'local_read_only_preview' -or $report.coverage -ne 'partial' -or $null -eq $report.result) {
        throw 'Unexpected scanner report'
      }
      $result = $report.result
      $lines = @('Coverage: partial (local read-only preview)', "Files checked: $($result.filesChecked); skipped: $($result.filesSkipped); access errors: $($result.accessErrors)", "Full signature engine active: $($result.fullSignatureEngineActive)")
      if ($script:scanKind -eq 'file') {
        $lines += "State: $($result.state)"
        $lines += "SHA-256: $($result.sha256)"
      } else {
        $lines += "Traversal finished: $($result.complete); limits reached: $($result.limitReached)"
        $lines += "Findings recorded: $(@($result.findings).Count)"
      }
      $scanResult.Text = $lines -join [Environment]::NewLine
    } else {
      $scanResult.Text = "$state. Coverage: incomplete. No completed result is available."
    }
  } catch {
    $scanResult.Text = 'Scan failed or its report was invalid. Coverage: incomplete.'
  }
  $timer.Stop()
  Close-SentinelProcessJob $script:scanJob
  $script:scanJob = $null
  $scanButton.IsEnabled = $true
  $folderButton.IsEnabled = $true
  $cancelButton.IsEnabled = $false
  $scanProgress.Visibility = 'Collapsed'
})
$scanButton.Add_Click({
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = 'Choose a file for a read-only Sentinel scan'
  $dialog.CheckFileExists = $true
  try {
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      Start-SelectedScan $dialog.FileName 'file'
    }
  } finally { $dialog.Dispose() }
})
$folderButton.Add_Click({
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = 'Choose a folder for a bounded read-only scan'
  $dialog.ShowNewFolderButton = $false
  try {
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      Start-SelectedScan $dialog.SelectedPath 'directory'
    }
  } finally { $dialog.Dispose() }
})
$cancelButton.Add_Click({
  try {
    Stop-SentinelProcessJob $script:scanJob
    $cancelButton.IsEnabled = $false
  } catch { $scanResult.Text = 'Could not stop the scanner. Waiting for the bounded timeout.' }
})
$window.Add_Closed({
  $timer.Stop()
  Close-SentinelProcessJob $script:scanJob
  $script:scanJob = $null
})
if ($Smoke) {
  $handle = (New-Object System.Windows.Interop.WindowInteropHelper($window)).EnsureHandle()
  [pscustomobject]@{ title = $window.Title; handle = $handle.ToInt64(); coverage = $fixture.assessment.coverage } | ConvertTo-Json -Compress
  $window.Close()
  exit 0
}

[void]$window.ShowDialog()
