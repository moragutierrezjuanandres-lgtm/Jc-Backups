$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
$PgBin = 'C:\ProgramData\JCEnterprise\postgres-runtime\pgsql\bin'
$PgData = Join-Path $Root 'pgdata'
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*server/self-hosted.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
& (Join-Path $PgBin 'pg_ctl.exe') stop -D $PgData -m fast
