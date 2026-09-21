# Datos y API en servidor propio

## Objetivo

Permitir que el portal `jcevnzl.space` siga publicado en Vercel, pero que la API y los datos operativos de JC se sirvan desde el servidor permanente de la empresa. La migración debe reducir el consumo de Neon, conservar los datos actuales y permitir volver temporalmente a Neon si la transición falla.

## Arquitectura aprobada

- **Frontend:** Vercel continúa sirviendo la aplicación web.
- **API:** proceso Node/Express en el servidor de la empresa, detrás de HTTPS.
- **Datos:** PostgreSQL en el mismo servidor (o en un servicio local administrado), con acceso de red privado para la API.
- **Archivos:** fotos de evidencias y PDFs en almacenamiento de archivos del servidor; la base conserva metadatos y rutas.
- **Acceso:** el navegador llama a un único origen de API configurado por variable de entorno. PostgreSQL no se expone públicamente.
- **Continuidad:** Neon queda como respaldo de lectura/exportación durante la migración y no se elimina hasta validar el nuevo servicio.

## Flujo de datos

El navegador solicita `https://api.jcevnzl.space` (o el subdominio equivalente) por HTTPS. La API valida sesión, permisos y origen, consulta PostgreSQL y devuelve únicamente los datos autorizados. Las escrituras usan transacciones y control de revisión como la implementación actual. Las subidas de imágenes se validan por tipo y tamaño, se guardan fuera de PostgreSQL y se registran en la ficha o reporte.

## Seguridad y operación

- Certificado TLS automático y renovación comprobada.
- Firewall: solo puertos HTTPS públicos; PostgreSQL escucha en localhost o red privada.
- Variables sensibles fuera del repositorio: clave de sesión, clave de bóveda y credenciales de base.
- Copias diarias de PostgreSQL y archivos, con una copia externa y una prueba periódica de restauración.
- Registro de errores y endpoint de salud sin exponer datos.
- Mantener un interruptor de configuración para volver a Neon durante la validación.

## Migración y reversión

1. Exportar Neon a un formato verificable y obtener conteos por colección.
2. Levantar PostgreSQL/API en el servidor sin cambiar el dominio público.
3. Importar los datos y comparar revisión, colecciones y usuarios.
4. Probar inicio de sesión, clientes, tickets, reportes y archivos en un entorno de prueba.
5. Cambiar Vercel para usar la API del servidor y validar tráfico real.
6. Mantener Neon sin modificaciones durante el periodo de observación.
7. Si falla la API propia, restaurar la variable de origen para volver a Neon sin perder el frontend.

## Criterios de aceptación

- El usuario puede iniciar sesión desde `jcevnzl.space` y consultar clientes/tickets.
- Las escrituras sobreviven al reinicio de la API y del servidor.
- Un reporte con foto se puede generar y consultar después de reiniciar.
- PostgreSQL no es accesible desde Internet.
- Existe una copia restaurable reciente y un procedimiento documentado de reversión.
- El portal no realiza sondeos agresivos que mantengan el servicio innecesariamente activo.

## Fuera de alcance

No se elimina Neon, no se contrata un plan de pago y no se cambia el dominio hasta completar las pruebas y confirmar la operación del servidor.
