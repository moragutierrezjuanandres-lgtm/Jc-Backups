$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$PgBin = 'C:\ProgramData\JCEnterprise\postgres-runtime\pgsql\bin'
$PgData = Join-Path $Root 'pgdata'
$ApiDir = Join-Path $Root 'app'
$EnvFile = Join-Path $Root 'api.env'
$BackupRoot = Join-Path $Root 'backup-storage'
$RestServer = Join-Path $Root 'rest-server.exe'
$Restic = Join-Path $Root 'restic.exe'
if (!(Test-Path (Join-Path $PgData 'PG_VERSION'))) { throw "No existe el cluster PostgreSQL en $PgData" }
if (!(Test-Path $EnvFile)) { throw "No existe la configuración privada $EnvFile" }
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
if (!(Test-Path $RestServer)) { throw "No existe $RestServer. Instala el paquete Isabella del servidor." }
if (!(Test-Path $Restic)) { throw "No existe $Restic. Instala el paquete Isabella del servidor." }
$status = & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData 2>&1
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $PgBin 'pg_ctl.exe') start -D $PgData -l (Join-Path $Root 'postgres.log') -o '-p 5432 -h 127.0.0.1' -W | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL. Consulta postgres.log.' }
}
# Un cierre inesperado puede requerir varios minutos de recuperación.
$deadline = (Get-Date).AddMinutes(20)
do {
    & (Join-Path $PgBin 'pg_isready.exe') -h 127.0.0.1 -p 5432 -t 3 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    if ((Get-Date) -ge $deadline) { throw 'PostgreSQL sigue sin estar listo. Consulta postgres.log; no reinicies durante la recuperación.' }
    Start-Sleep -Seconds 5
} while ($true)
try { $health = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 3 } catch { $health = $null }
$apiReady = $health.service -eq 'jc-portal-api' -and $health.status -eq 'ok'
$restartRequest = Join-Path $Root 'restart-api.request'
if ($apiReady -and (Test-Path $restartRequest)) {
    $listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 5000 -State Listen -ErrorAction Stop | Select-Object -First 1
    $apiProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if ($apiProcess.Name -ne 'node.exe' -or $apiProcess.CommandLine -notlike '*server/self-hosted.mjs*') { throw 'El puerto 5000 pertenece a otro proceso; no se reiniciará.' }
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
    $apiReady = $false
}
if (Test-Path $restartRequest) { Remove-Item -LiteralPath $restartRequest -Force }
$receiverReady = $false
try {
    $connection = New-Object System.Net.Sockets.TcpClient
    $connection.Connect('127.0.0.1', 8000)
    $receiverReady = $connection.Connected
} catch {} finally { if ($connection) { $connection.Dispose() } }
if (!$receiverReady) {
    $passwordFile = Join-Path $BackupRoot '.htpasswd'
    if (!(Test-Path $passwordFile)) { New-Item -ItemType File -Path $passwordFile | Out-Null }
    $receiver = Start-Process $RestServer -WorkingDirectory $Root -ArgumentList @('--path', $BackupRoot, '--listen', '127.0.0.1:8000', '--htpasswd-file', $passwordFile, '--private-repos', '--append-only') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Root 'receiver.log') -RedirectStandardError (Join-Path $Root 'receiver-error.log') -PassThru
    Start-Sleep -Milliseconds 500
    if ($receiver.HasExited) { throw 'El receptor de respaldos terminó durante el arranque. Consulta receiver-error.log.' }
}
$env:JC_BACKUP_STORAGE_ROOT = $BackupRoot
$env:JC_BACKUP_RESTIC = $Restic
$env:JC_BACKUP_RECEIVER_URL = 'https://api.jcevnzl.space'
$env:JC_BACKUP_RECEIVER_PORT = '8000'
if ($apiReady) { Write-Output 'API local y receptor disponibles.'; exit 0 }
$api = Start-Process node.exe -WorkingDirectory $ApiDir -ArgumentList @("--env-file=`"$EnvFile`"", 'server/self-hosted.mjs') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Root 'api.log') -RedirectStandardError (Join-Path $Root 'api-error.log') -PassThru
for ($attempt = 0; $attempt -lt 180; $attempt++) {
    if ($api.HasExited) { throw 'La API terminó durante el arranque. Consulta api-error.log.' }
    try { $health = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 } catch { $health = $null }
    if ($health.service -eq 'jc-portal-api' -and $health.status -eq 'ok') { Write-Output 'API local disponible.'; exit 0 }
    Start-Sleep -Seconds 1
}
throw 'La API no respondió a la comprobación de salud. Consulta api-error.log.'
