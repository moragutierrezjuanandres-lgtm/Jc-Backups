# API local de JC Enterprise

La base PostgreSQL escucha únicamente en `127.0.0.1:5432`. La API escucha en `127.0.0.1:5000`; no se debe abrir PostgreSQL al Internet.

La copia importada se verificó desde `C:/ProgramData/JCEnterprise/snapshots/2026-09-22T20-10-15.239Z/portal.sqlite`. La configuración privada y la clave original están en `C:/ProgramData/JCEnterprise/self-hosted`; esa carpeta no pertenece al repositorio.

Copia los scripts a `C:/ProgramData/JCEnterprise/self-hosted` y ejecuta `install-user-startup.ps1` para iniciar PostgreSQL, API y túnel cuando este usuario entra en Windows. No necesita administrador. Esto **requiere iniciar sesión en Windows después de reiniciar**; no equivale a un servicio que arranca sin sesión. `start-stack.ps1` permite comprobar el arranque manualmente. Las credenciales permanecen en `api.env` y `tunnel-token`, dentro de la carpeta privada.

Como alternativa, `install-start-task.ps1` registra una tarea al iniciar sesión y exige privilegios de administrador; comprueba el resultado real antes de anunciar éxito. No instales ambos mecanismos.

Comprobación local:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

El túnel `jc-portal-api` publica `https://api.jcevnzl.space` hacia `http://127.0.0.1:5000`. Vercel conserva `/api` en el mismo dominio mediante una reescritura HTTPS, para conservar las cookies seguras. Verifica el certificado y `/api/health` públicos antes de promover el despliegue. Conserva Neon y la copia SQLite hasta verificar el inicio de sesión.
