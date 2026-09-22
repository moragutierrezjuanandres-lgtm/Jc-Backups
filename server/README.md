# API local de JC Enterprise

La base PostgreSQL escucha únicamente en `127.0.0.1:5432`. La API escucha en `127.0.0.1:5000`; no se debe abrir PostgreSQL al Internet.

La copia importada se verificó desde `C:/ProgramData/JCEnterprise/snapshots/2026-09-22T20-10-15.239Z/portal.sqlite`. La configuración privada y la clave original están en `C:/ProgramData/JCEnterprise/self-hosted`; esa carpeta no pertenece al repositorio.

Para iniciar después de reiniciar Windows, ejecuta PowerShell como administrador y copia los scripts a `C:/ProgramData/JCEnterprise/self-hosted`, luego ejecuta `install-start-task.ps1`. La tarea solo contiene la ruta del script; las contraseñas permanecen en `api.env`.

Comprobación local:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Antes de cambiar Vercel, hay que conectar el túnel `jc-portal-api` de Cloudflare y publicar un hostname HTTPS que reenvíe a `http://127.0.0.1:5000`. Mantén Neon disponible hasta verificar el login en el hostname nuevo.
