param([string]$FfmpegPath = 'ffmpeg')
$ErrorActionPreference = 'Stop'
$sounds = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\ui\src\assets\sounds'
# Keep the original recordings. Remove silence only at the edges, retaining a
# short onset/tail; PCM avoids introducing MP3 encoder padding again.
$edge = 'silenceremove=start_periods=1:start_duration=0.001:start_threshold=-45dB:start_silence=0.005:detection=peak:window=0.002'
$tail = 'silenceremove=start_periods=1:start_duration=0.001:start_threshold=-45dB:start_silence=0.03:detection=peak:window=0.002'
foreach ($name in @('open', 'button', 'notification', 'error', 'navigation')) {
    $inputFile = Join-Path $sounds ($name + '.mp3')
    $outputFile = Join-Path $sounds ($name + '.wav')
    & $FfmpegPath -hide_banner -loglevel error -y -i $inputFile -af ($edge + ',areverse,' + $tail + ',areverse') -ar 48000 -c:a pcm_s16le $outputFile
    if ($LASTEXITCODE -ne 0) { throw ('Could not trim sound: ' + $name) }
}
