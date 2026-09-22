$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$Script = Join-Path $Root 'start-self-hosted.ps1'
if (!(Test-Path $Script)) { throw "Copia start-self-hosted.ps1 a $Root" }
$TaskName = 'JC Enterprise local API'
$Command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Script`""
schtasks.exe /Create /TN $TaskName /SC ONLOGON /TR $Command /F | Out-Host
Write-Output "Tarea creada: $TaskName"
