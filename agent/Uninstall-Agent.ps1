param([string]$InstallRoot = "$env:ProgramFiles\JC Enterprise\Backup Agent")
$ErrorActionPreference='Stop'; schtasks /Delete /TN 'JC Enterprise Backup Agent' /F 2>$null; if(Test-Path $InstallRoot){Remove-Item $InstallRoot -Recurse -Force}; Write-Host 'Agente desinstalado. Los datos protegidos permanecen en ProgramData.'
