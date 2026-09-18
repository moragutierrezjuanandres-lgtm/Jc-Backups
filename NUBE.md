# Portal en Vercel con Neon

La API de `api/index.js` sirve autenticación, sesiones, clientes, usuarios, tickets, proyectos y credenciales. PostgreSQL es el almacenamiento persistente; no depende de archivos SQLite en Vercel. Las mutaciones bloquean la fila de revisión dentro de una transacción para proteger los cambios concurrentes entre instancias. Las sesiones y el límite de intentos se guardan en PostgreSQL.

## Configuración

- Proyecto Vercel: `jc-portal`, equipo `moragutierrezjuanandres-9293`.
- Dominios: `jcevnzl.space` y `www.jcevnzl.space`.
- Neon: `jce-network`, conectado únicamente a Production.
- `DATABASE_URL`: variable de Neon, solo del servidor.
- `JC_VAULT_KEY`: contenido del `vault.key` original, codificado en base64 y guardado como variable sensible de Production. Cambiarlo arbitrariamente impediría descifrar las credenciales existentes.

## Migración inicial

1. Vincular la CLI con el proyecto existente (`vercel link --project jc-portal --scope moragutierrezjuanandres-9293`).
2. Las variables sensibles de Production no se pueden descargar: Vercel entrega marcadores `[SENSITIVE]`. No desactivar esa protección. Para la importación inicial se configura una clave temporal aleatoria `JC_IMPORT_TOKEN`, guardada fuera del repositorio y en Vercel como secreto.
3. Después de publicar la API, ejecutar `node scripts/import-cloud.mjs`. Crea una copia consistente de SQLite, envía las colecciones con hashes existentes al endpoint HTTPS autenticado `/api/setup/import` y compara los datos importados. El endpoint solo admite una base vacía y rechaza sobrescribir una base existente. Las sesiones locales no se trasladan: los usuarios inician sesión de nuevo. Eliminar la variable temporal al verificar el resultado y volver a desplegar para deshabilitar el endpoint. `import-neon.mjs` es la alternativa para quien disponga de una conexión PostgreSQL local autorizada.
4. Guardar `JC_VAULT_KEY` en Production y publicar la API junto con la interfaz.
5. Verificar `/api/health`, acceso sin sesión rechazado, inicio de sesión existente y datos del cliente. Usar el portal en la nube como fuente de datos principal desde el cambio; no alternar ediciones entre la base local y Neon.

## Límites de esta etapa

El coordinador de respaldos por VPN y el bot WhatsApp siguen siendo procesos del servidor local. La API en Vercel devuelve un mensaje explícito para respaldos mientras no se conecte un coordinador saliente. No afirma haber creado copias ni intenta acceder a las IP privadas desde Vercel. La conexión del coordinador es una etapa posterior a recuperar el acceso al portal, solicitada por el usuario como trabajo paso a paso.

Los datos originales y snapshots permanecen en `C:/ProgramData/JCEnterprise`. Ninguno debe enviarse con el código ni publicarse en GitHub. La limpieza del seguimiento de Git no elimina copias de commits históricos.

## Validación

`npm test` incluye las pruebas de SQLite, migración y API cloud con un motor PostgreSQL local de prueba. Las pruebas cloud verifican autenticación, permisos, reversión de transacciones, conflictos, cifrado entre instancias, límites de intentos y revocación de sesiones. `npm run build` genera la interfaz.

`npm run export:frontend` mantiene su nombre por compatibilidad, pero ahora exporta también la API cloud y sus módulos necesarios, sin los datos ni los procesos locales.
