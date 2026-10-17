[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]
param()
& "$PSScriptRoot/set-enrolled-rp2040.ps1" -Action Enable @PSBoundParameters
