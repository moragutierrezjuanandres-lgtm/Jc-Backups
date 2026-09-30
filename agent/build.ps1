$ErrorActionPreference='Stop'
$go=Join-Path $PSScriptRoot '..\.tools\go\bin\go.exe'
if(-not(Test-Path $go)){throw 'Go no encontrado'}
Push-Location $PSScriptRoot
try {
  Push-Location (Join-Path $PSScriptRoot '..')
  try { npm run build:agent-ui; if($LASTEXITCODE){throw 'No se pudo empaquetar la interfaz Isabella'} } finally { Pop-Location }
  & $go test ./...
  if($LASTEXITCODE){throw 'Pruebas Go fallaron'}
  New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'dist')|Out-Null
  & $go build -trimpath -ldflags '-s -w -H=windowsgui' -o (Join-Path $PSScriptRoot 'dist\jc-backup.exe') ./cmd/jc-backup
  if($LASTEXITCODE){throw 'Build falló'}
} finally {Pop-Location}
