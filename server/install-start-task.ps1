$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$Script = Join-Path $Root 'start-stack.ps1'
if (!(Test-Path $Script)) { throw "Copia start-stack.ps1 a $Root" }
$TaskName = 'JC Enterprise local API'
$Command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Script`""
schtasks.exe /Create /TN $TaskName /SC ONLOGON /TR $Command /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Windows no pudo registrar la tarea. Ejecuta este instalador como administrador.' }
schtasks.exe /Query /TN $TaskName | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar la tarea registrada.' }
Write-Output "Tarea creada: $TaskName"
