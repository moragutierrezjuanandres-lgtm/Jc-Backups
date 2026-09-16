@echo off
title Servidor JC Enterprise - Iniciar
echo ========================================================
echo       INICIANDO SERVIDOR JC ENTERPRISE
echo ========================================================
echo.
echo Verificando Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js no esta instalado o no se encuentra en el PATH.
    echo.
    pause
    exit /b
)
echo [OK] Node.js detectado.
echo.
echo Iniciando el servidor en el puerto 5000...
echo (Deje esta ventana abierta para mantener el servidor activo)
echo.
node server.js
pause
