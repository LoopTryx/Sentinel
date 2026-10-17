param([switch]$Native)
$ErrorActionPreference='Stop'
if($Native){throw 'Use independently reviewed native qualification executable with Windows approval'}
# Framework compilation and pure validation only. Native mutation qualification
# requires its separately reviewed executable and explicit Windows approval.
& (Join-Path $PSScriptRoot 'build-usb-admission-journal-test.ps1')