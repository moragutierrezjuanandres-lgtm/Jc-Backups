param([string]$PortalUrl = 'https://www.jcevnzl.space', [string]$InstallRoot = "$env:ProgramFiles\JC Enterprise\Backup Agent")
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$go=Join-Path $repo '..\.tools\go\bin\go.exe'
$data=Join-Path $env:ProgramData 'JCEnterprise\backup-agent'; New-Item -ItemType Directory -Force -Path $data,$InstallRoot | Out-Null
$old=Get-Process -Name 'jc-backup' -ErrorAction SilentlyContinue; if($old){ $old | Stop-Process -Force; Start-Sleep -Milliseconds 500 }
$built=Join-Path $repo 'dist\jc-backup.exe'
$builtBeside=Join-Path $repo 'jc-backup.exe'
if(Test-Path $go){ & $go build -trimpath -ldflags '-s -w -H=windowsgui' -o (Join-Path $InstallRoot 'jc-backup.exe') (Join-Path $repo 'cmd\jc-backup'); if($LASTEXITCODE){throw 'No se pudo compilar el agente.'} }
elseif(Test-Path $built){ Copy-Item $built (Join-Path $InstallRoot 'jc-backup.exe') -Force }
elseif(Test-Path $builtBeside){ Copy-Item $builtBeside (Join-Path $InstallRoot 'jc-backup.exe') -Force }
else { throw 'No se encontró Go ni un binario jc-backup.exe compilado.' }
$resticSource=Join-Path $repo '..\.tools\restic\restic_0.19.1_windows_amd64.exe'
if(Test-Path $resticSource){ Copy-Item $resticSource (Join-Path $InstallRoot 'restic.exe') -Force }
elseif(-not (Test-Path (Join-Path $InstallRoot 'restic.exe'))){ throw 'No se encontró restic.exe. Copie el binario Restic en la carpeta del instalador.' }
$service='JCEnterpriseIsabella'; $bin="`"$InstallRoot\jc-backup.exe`" -service -portal `"$PortalUrl`" -restic `"$InstallRoot\restic.exe`""
sc.exe query $service *> $null; if($LASTEXITCODE -eq 0){ sc.exe stop $service *> $null; sc.exe delete $service *> $null; Start-Sleep -Milliseconds 500 }
sc.exe create $service binPath= $bin start= delayed-auto DisplayName= "JC Enterprise Isabella" | Out-Null
sc.exe description $service "Servicio de respaldos Isabella para JC Enterprise" | Out-Null
sc.exe failure $service actions= restart/60000/restart/60000/""/0 reset= 86400 | Out-Null
sc.exe start $service | Out-Null
$task='JC Enterprise Isabella UI'; schtasks /Create /TN $task /TR "`"$InstallRoot\jc-backup.exe`" -portal `"$PortalUrl`" -restic `"$InstallRoot\restic.exe`"" /SC ONLOGON /F | Out-Null
Start-Process (Join-Path $InstallRoot 'jc-backup.exe') -ArgumentList "-portal $PortalUrl -restic `"$InstallRoot\restic.exe`""; Write-Host "Isabella instalada como servicio. Interfaz: http://127.0.0.1:18443"
