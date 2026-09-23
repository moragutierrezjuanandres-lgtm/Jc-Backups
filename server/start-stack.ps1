$ErrorActionPreference = 'Stop'
$Root = 'C:\ProgramData\JCEnterprise\self-hosted'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'start-self-hosted.ps1')
if ($LASTEXITCODE -ne 0) { throw 'La API no pudo arrancar; el túnel no se iniciará.' }
try { $ready = Invoke-WebRequest 'http://127.0.0.1:20241/ready' -UseBasicParsing -TimeoutSec 3 } catch { $ready = $null }
if ($ready.StatusCode -eq 200) { Write-Output 'API y túnel disponibles.'; exit 0 }
if (!(Test-Path (Join-Path $Root 'tunnel-token'))) { throw 'Falta tunnel-token en la configuración privada.' }
$connector = Start-Process -FilePath 'C:\Program Files (x86)\cloudflared\cloudflared.exe' -ArgumentList @('tunnel', '--no-autoupdate', '--metrics', '127.0.0.1:20241', '--logfile', (Join-Path $Root 'tunnel.log'), 'run', '--token-file', (Join-Path $Root 'tunnel-token')) -WindowStyle Hidden -PassThru
for ($attempt = 0; $attempt -lt 120; $attempt++) {
    if ($connector.HasExited) { throw 'El conector terminó. Consulta tunnel.log.' }
    try { $ready = Invoke-WebRequest 'http://127.0.0.1:20241/ready' -UseBasicParsing -TimeoutSec 3 } catch { $ready = $null }
    if ($ready.StatusCode -eq 200) { Write-Output 'API y túnel disponibles.'; exit 0 }
    Start-Sleep -Seconds 1
}
throw 'El túnel no confirmó su conexión. Consulta tunnel.log.'
