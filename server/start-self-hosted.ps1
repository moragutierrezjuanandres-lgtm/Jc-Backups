$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$PgBin = 'C:\ProgramData\JCEnterprise\postgres-runtime\pgsql\bin'
$PgData = Join-Path $Root 'pgdata'
$ApiDir = Join-Path $Root 'app'
$EnvFile = Join-Path $Root 'api.env'
if (!(Test-Path (Join-Path $PgData 'PG_VERSION'))) { throw "No existe el cluster PostgreSQL en $PgData" }
if (!(Test-Path $EnvFile)) { throw "No existe la configuración privada $EnvFile" }
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
if ($health.service -eq 'jc-portal-api' -and $health.status -eq 'ok') { Write-Output 'API local disponible.'; exit 0 }
$api = Start-Process node.exe -WorkingDirectory $ApiDir -ArgumentList @("--env-file=`"$EnvFile`"", 'server/self-hosted.mjs') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Root 'api.log') -RedirectStandardError (Join-Path $Root 'api-error.log') -PassThru
for ($attempt = 0; $attempt -lt 180; $attempt++) {
    if ($api.HasExited) { throw 'La API terminó durante el arranque. Consulta api-error.log.' }
    try { $health = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 } catch { $health = $null }
    if ($health.service -eq 'jc-portal-api' -and $health.status -eq 'ok') { Write-Output 'API local disponible.'; exit 0 }
    Start-Sleep -Seconds 1
}
throw 'La API no respondió a la comprobación de salud. Consulta api-error.log.'
