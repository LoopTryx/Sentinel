$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
# Reuse the identical reviewed operator sources/references; no deployment or run.
. (Join-Path $taskRoot 'tools/build-usb-admission-operator.ps1') -ReviewedExact
& (Join-Path $framework 'csc.exe') @options /target:exe /main:UsbExactReadDiagnostic ('/out:'+(Join-Path $taskRoot 'artifacts/UsbExactReadDiagnostic.exe')) @legacyResources @references $common $ui (Join-Path $PSScriptRoot 'UsbExactBlockProductionReadQualification.cs')
if($LASTEXITCODE -ne 0){throw 'Production read qualification build failed'}
Write-Output 'Built production read qualification; not executed; changes no policy'
