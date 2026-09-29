param([string]$PortalUrl = 'https://www.jcevnzl.space', [string]$InstallRoot = "$env:ProgramFiles\JC Enterprise\Backup Agent")
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$go=Join-Path $repo '..\.tools\go\bin\go.exe'
if(-not (Test-Path $go)){ throw 'No se encontró Go en .tools; ejecute build.ps1 primero.' }
$data=Join-Path $env:ProgramData 'JCEnterprise\backup-agent'; New-Item -ItemType Directory -Force -Path $data,$InstallRoot | Out-Null
& $go build -trimpath -ldflags '-s -w' -o (Join-Path $InstallRoot 'jc-backup.exe') (Join-Path $repo 'cmd\jc-backup'); if($LASTEXITCODE){throw 'No se pudo compilar el agente.'}
Copy-Item (Join-Path $repo '..\.tools\restic\restic_0.19.1_windows_amd64.exe') (Join-Path $InstallRoot 'restic.exe') -Force
$task='JC Enterprise Backup Agent'; schtasks /Create /TN $task /TR "`"$InstallRoot\jc-backup.exe`" -portal $PortalUrl -restic `"$InstallRoot\restic.exe`"" /SC ONSTART /RU SYSTEM /RL LIMITED /F | Out-Null
Start-Process (Join-Path $InstallRoot 'jc-backup.exe') -ArgumentList "-portal $PortalUrl -restic `"$InstallRoot\restic.exe`""; Write-Host "Isabella disponible en http://127.0.0.1:18443"
