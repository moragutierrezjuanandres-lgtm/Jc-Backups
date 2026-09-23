$ErrorActionPreference = 'Stop'
$Script = 'C:\ProgramData\JCEnterprise\self-hosted\start-stack.ps1'
if (!(Test-Path $Script)) { throw 'Copia primero los scripts a la carpeta de ejecución.' }
$Startup = [Environment]::GetFolderPath('Startup')
if (!$Startup) { throw 'No se encontró la carpeta de inicio del usuario.' }
$LinkPath = Join-Path $Startup 'JC Enterprise servidor.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($LinkPath)
$Shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $Script + '"'
$Shortcut.WorkingDirectory = Split-Path $Script
$Shortcut.WindowStyle = 7
$Shortcut.Save()
if (!(Test-Path $LinkPath)) { throw 'No se pudo crear el acceso de inicio.' }
Write-Output "Inicio al entrar en Windows instalado: $LinkPath"
