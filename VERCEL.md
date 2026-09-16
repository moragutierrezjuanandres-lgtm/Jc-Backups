# Publicar JC Enterprise en Vercel

## Arquitectura preparada

```text
Navegador / app Android
        │ HTTPS
        ▼
Vercel: interfaz React (Vite)
        │ /api/* → rewrite HTTPS
        ▼
Servidor JC: Node.js 24 + SQLite + programador + WhatsApp opcional
        │ Red local / Radmin VPN, órdenes firmadas
        ▼
Agente de cada cliente (Windows, puerto 8091)
        │ Copia y verifica
        ▼
Carpeta de destino / recurso compartido
```

**Vercel aloja la interfaz.** El servidor JC permanece en Windows, con almacenamiento persistente y conexión a los clientes. No suba el servidor SQLite ni intente ejecutar Radmin, las tareas de Windows o el navegador de WhatsApp dentro de una función de Vercel. Subir solo la interfaz sin un backend accesible muestra la pantalla de acceso, pero no permite iniciar sesión ni respaldar.

## 1. Preparar el servidor

Requisitos: Node.js 24, carpeta de datos persistente, Radmin VPN conectado y permiso de red hacia los agentes. Conserve una copia del código y de `database.json` antes del primer inicio.

```powershell
cd "C:\Users\morag\Documents\DOCUMENTOS SERVER\Jce\jc-enterprise-portal"
npm ci
npm run build
npm start
```

En el primer inicio se importa `database.json` a `data/portal.sqlite`, con contraseñas de acceso convertidas a hashes. El JSON original no se modifica y deja de ser la base activa. Los usuarios existentes mantienen sus contraseñas; cámbielas desde Administración si eran predeterminadas o débiles. Los nuevos usuarios requieren al menos 10 caracteres.

Guarde `data/portal.sqlite` y `data/vault.key` juntos en las copias del servidor. La clave es necesaria para recuperar las nuevas credenciales cifradas. Para una copia consistente de SQLite, detenga el servidor o utilice la API de backup de SQLite; no copie únicamente el archivo principal mientras haya escrituras WAL.

## 2. Dar al backend una dirección HTTPS estable

Necesita, por ejemplo, `https://api.tudominio.com` que llegue a `http://localhost:5000` en su servidor. Puede usar su proxy HTTPS existente o un túnel con dominio estable. Una IP Radmin `26.x.x.x` no es una dirección pública accesible desde Vercel.

Si usa Cloudflare Tunnel: cree el túnel desde Cloudflare One, instale su conector en el servidor Windows y agregue una ruta pública con hostname `api.tudominio.com`, servicio HTTP y URL `localhost:5000`. Use un túnel con nombre/dominio estable; una URL temporal cambia y obliga a reconfigurar Vercel. Siga las instrucciones del proveedor para que el conector arranque con Windows. No se abre el puerto 8091 a Internet: ese puerto es solo para portal → agente en la red privada.

Configure en el proceso **del backend**:

```powershell
$env:JC_ALLOWED_ORIGINS='https://portal.tudominio.com,https://tu-proyecto.vercel.app'
$env:JC_SECURE_COOKIE='1'
$env:JC_HOST='127.0.0.1'
$env:JC_TIMEZONE='America/Caracas'
npm start
```

Use los dominios exactos del frontend. Las URLs de preview que no estén en esta lista no podrán enviar cambios ni iniciar sesión. Las variables anteriores duran esa sesión de PowerShell: configúrelas también en el servicio/gestor de procesos que use para el arranque automático. `JC_SECURE_COOKIE=1` requiere HTTPS; omítala al probar únicamente por HTTP local.

No active una pantalla de login HTML adicional delante de `/api/*` sin configurar acceso entre servicios: el proxy de Vercel necesita recibir JSON del backend, no la pantalla de acceso de otro proveedor.

## 3. Configurar el enlace de Vercel

Desde `jc-enterprise-portal`, reemplace el ejemplo por el dominio HTTPS real:

```powershell
node scripts/configure-vercel.mjs https://api.tudominio.com
```

Este comando modifica la primera regla de `vercel.json`. Las peticiones `/api/*` se envían al backend manteniendo una sola dirección para el navegador. El frontend no contiene contraseñas ni secretos de agentes. No es necesario configurar `VITE_API_URL`.

## 4. Exportar únicamente la interfaz

```powershell
npm run export:frontend
```

Se crea `Jce/_deploy/jc-vercel-frontend`. Esa carpeta contiene React, recursos públicos y la configuración de Vercel. **No contiene la base de datos, los agentes, las sesiones de WhatsApp ni las claves.** El resto de esta guía asume que publica esa exportación.

### Desde GitHub y el panel de Vercel

1. Cree un repositorio privado con el contenido de `jc-vercel-frontend` (solo esa carpeta).
2. En Vercel, use **Add New → Project** e importe el repositorio.
3. Seleccione **Vite** como Framework Preset.
4. Root Directory: raíz del repositorio, o la subcarpeta si lo incluyó dentro de otro repositorio.
5. Build Command: `npm run build`. Output Directory: `dist`. Node.js: `24.x`.
6. Pulse **Deploy** y copie el dominio asignado, por ejemplo `https://tu-proyecto.vercel.app`.
7. Añada ese dominio exacto a `JC_ALLOWED_ORIGINS` del servidor y reinicie el backend. Si configuró un dominio propio, añádalo también.

### Alternativa: CLI, sin GitHub

```powershell
cd "C:\Users\morag\Documents\DOCUMENTOS SERVER\Jce\_deploy\jc-vercel-frontend"
npm install
npm run build
npx vercel login
npx vercel
```

Pruebe la URL de preview (añádala primero a los orígenes permitidos del backend). Cuando todo funcione:

```powershell
npx vercel --prod
```

## 5. Comprobar la publicación

- Abrir `/api/auth/session` sin sesión debe devolver JSON con HTTP 401, no HTML ni 404. Esto verifica el enlace con el backend.
- Iniciar sesión con una cuenta existente y navegar por Clientes, Soporte y Respaldos.
- Crear un registro de prueba y comprobar que se conserva al recargar y desde otra sesión.
- Preparar el agente de un cliente piloto, descargar el instalador e instalarlo en ese equipo.
- Conectar por IP, ejecutar una copia de prueba y restaurarla en una carpeta vacía antes de confiarle datos operativos.
- Confirmar que un agente desconectado se muestra como no disponible y no como respaldo exitoso.

## Actualizaciones

Después de editar el portal: compile, ejecute las pruebas y vuelva a ejecutar `npm run export:frontend`; después actualice el repositorio publicado o ejecute la CLI desde la exportación. **Publicar Vercel no actualiza el backend de Windows ni los agentes instalados**: actualícelos por separado cuando cambie su código. Los EXE/APK existentes tampoco se reconstruyen al compilar Vite.

## Fuentes oficiales

- Vite en Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Proxy mediante rewrites: https://vercel.com/docs/routing/rewrites
- Límites de ejecución: https://vercel.com/docs/functions/limitations
- Túneles con Cloudflare: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-local-tunnel/

La plantilla incluye `api-jc.example.com` como marcador. No se ha publicado ningún sitio ni configurado ningún dominio real automáticamente.
