@echo off
title Servidor JC Enterprise - Configurar y Desplegar
echo ========================================================
echo       CONFIGURACION Y DESPLIEGUE DEL PORTAL JC
echo ========================================================
echo.

:: 1. Verificar Node.js
echo [1/5] Verificando instalacion de Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js LTS desde https://nodejs.org/
    echo e intenta correr este archivo de nuevo.
    echo.
    pause
    exit /b
)
echo [OK] Node.js detectado.
echo.

:: 2. Instalar dependencias
echo [2/5] Instalando dependencias del proyecto (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR al instalar las dependencias. Verifique su conexion a internet.
    pause
    exit /b
)
echo [OK] Dependencias instaladas con exito.
echo.

:: 3. Compilar React
echo [3/5] Compilando frontend (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR durante la compilacion de Vite.
    pause
    exit /b
)
echo [OK] Compilacion completada.
echo.

:: 4. Configurar PM2
echo [4/5] Configurando gestor de procesos PM2...
call pm2 -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando PM2 globalmente...
    call npm install -g pm2
)
echo [OK] PM2 listo.

echo Iniciando el servidor en segundo plano con PM2...
call pm2 delete jc-portal >nul 2>&1
call pm2 start server.js --name "jc-portal"
call pm2 save
echo.
echo [OK] Servidor iniciado en segundo plano.
echo.

:: 5. Mostrar IPs locales
echo [5/5] Buscando la direccion IP local de esta PC...
echo --------------------------------------------------------
ipconfig | findstr /i "IPv4"
echo --------------------------------------------------------
echo.
echo DESPLIEGUE COMPLETADO CON EXITO!
echo.
echo El servidor ya esta corriendo de fondo en el puerto 5000.
echo.
echo Para acceder desde esta PC:
echo -> http://localhost:5000
echo.
echo Para acceder desde otros dispositivos en la red de la oficina:
echo -> http://[IP_de_arriba]:5000
echo.
echo ========================================================
pause
