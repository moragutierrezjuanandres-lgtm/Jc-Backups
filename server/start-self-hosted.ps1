$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$PgBin = 'C:\ProgramData\JCEnterprise\postgres-runtime\pgsql\bin'
$PgData = Join-Path $Root 'pgdata'
$ApiDir = Join-Path $Root 'app'
$EnvFile = Join-Path $Root 'api.env'
if (!(Test-Path (Join-Path $PgData 'PG_VERSION'))) { throw "No existe el cluster PostgreSQL en $PgData" }
if (!(Test-Path $EnvFile)) { throw "No existe la configuración privada $EnvFile" }
$status = & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData 2>&1
if ($LASTEXITCODE -ne 0) { & (Join-Path $PgBin 'pg_ctl.exe') start -D $PgData -l (Join-Path $Root 'postgres.log') -o '-p 5432 -h 127.0.0.1' | Out-Null }
$api = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*server/self-hosted.mjs*' }
if (!$api) { Start-Process node.exe -WorkingDirectory $ApiDir -ArgumentList @('--env-file='+$EnvFile,'server/self-hosted.mjs') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Root 'api.log') -RedirectStandardError (Join-Path $Root 'api-error.log') }
