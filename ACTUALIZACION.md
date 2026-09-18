# Actualizar conservando los datos

El código se guarda en GitHub y la interfaz se publica en Vercel. La API Node y el coordinador de respaldos deben seguir ejecutándose en SRVJC, con acceso a los agentes de los clientes. Vercel no sustituye este proceso.

## Primera migración

1. Detener el proceso del portal (Ctrl+C en su ventana; si se administra con PM2, `pm2 stop jc-portal`). No deben quedar otros procesos del portal usando la misma base.
2. Desde la carpeta del portal, ejecutar `npm run migrate:data` con Node 24.
3. El script crea una copia consistente de SQLite en `C:/ProgramData/JCEnterprise/data`, verifica su integridad y todos los registros, conserva `vault.key` y escribe `JC_DATA_DIR` en `.env`. No sobrescribe destinos existentes ni elimina los originales.
4. Iniciar con `npm start`. Los archivos BAT existentes también cargan ahora `.env` al ejecutar `server.js`.
5. Comprobar el acceso con el usuario habitual y la lista de clientes. Archivar los originales fuera del repositorio después de verificar la migración.

La carpeta privada debe permitir acceso únicamente al usuario que ejecuta Node, SYSTEM y administradores. En esta máquina se preparó `C:/ProgramData/JCEnterprise` con esos permisos. Si cambia la cuenta de ejecución, hay que concederle acceso explícito. No usar una unidad compartida para SQLite.

## Actualizaciones posteriores

1. Ejecutar `npm run backup:data`: crea una copia consistente de SQLite y de la clave en `C:/ProgramData/JCEnterprise/snapshots`. No incluye los archivos de respaldo de clientes ni la sesión de WhatsApp; estos requieren su propia copia.
2. Detener el portal.
3. Actualizar el código desde GitHub. Conservar `.env` y la carpeta privada. Instalar dependencias con `npm ci` y ejecutar `npm test` y `npm run build`; no iniciar si fallan.
4. Iniciar con `npm start` o el gestor que utilices. No volver a ejecutar la migración inicial: se rechazará para proteger el destino existente.

Para recuperar una copia, detener el portal y archivar primero la carpeta de datos actual completa. Restaurar juntos `portal.sqlite` y `vault.key` desde el mismo snapshot en una carpeta vacía y apuntar `JC_DATA_DIR` a ella. No mezclar la base restaurada con archivos WAL/SHM de otra base.

## Conexión pendiente para jcevnzl.space

La API ya existe en `http://127.0.0.1:5000`. Falta publicar un origen HTTPS estable que llegue a SRVJC; se propone `https://api.jcevnzl.space`. Un registro DNS por sí solo no crea ese enlace.

El dominio usa DNS de Vercel. Antes de elegir un túnel, confirmar que su proveedor admite este DNS o preparar la configuración DNS necesaria. No cambiar servidores DNS sin copiar y verificar todos los registros existentes. Alternativamente, alojar la API en un servidor con HTTPS y mantener un coordinador local para alcanzar los agentes.

Cuando la API tenga HTTPS operativo:

1. En `.env`, configurar `JC_ALLOWED_ORIGINS=https://jcevnzl.space,https://www.jcevnzl.space` y `JC_SECURE_COOKIE=1`. Reiniciar Node. Con cookies seguras, usar HTTPS para iniciar sesión; el acceso HTTP desde otros equipos deja de ser apropiado.
2. Ejecutar `node scripts/configure-vercel.mjs https://api.jcevnzl.space`.
3. Publicar los cambios de código en GitHub y desplegar el frontend en el proyecto Vercel del dominio. La configuración actual conserva una URL de ejemplo hasta que exista una API pública real.
4. Verificar que `/api/auth/session` devuelve JSON con 401 sin sesión y que el acceso habitual permite consultar los clientes. Nunca almacenar secretos en variables `VITE_`.

## Archivos que ya estaban en Git

Se deben retirar del seguimiento `data/`, `database.json` y cualquier exportación que contenga datos. `.gitignore` evita nuevas incorporaciones, pero no limpia commits anteriores. Si esos commits llegaron a GitHub, revisar su exposición y sanear el historial coordinadamente; cambiar secretos expuestos. No borrar o reemplazar `vault.key` directamente: primero se deben descifrar y volver a cifrar las credenciales con la nueva clave.
