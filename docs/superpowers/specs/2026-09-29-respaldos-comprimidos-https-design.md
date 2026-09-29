# Respaldos comprimidos por HTTPS

Estado: diseño para revisión. No implementado ni desplegado por este documento.

## Resultado solicitado

Cada equipo Windows envía respaldos comprimidos a SRVJC mediante el dominio,
sin IP fija, Radmin VPN ni conexiones entrantes al equipo. El portal permite
vincular equipos, elegir carpetas, programar, consultar resultados y restaurar.
Se conserva el diseño base de 2026-09-26; este documento concreta la compresión
y sustituye el flujo visible basado en IP por vinculación y conexiones salientes.

## Decisión de almacenamiento

Se continúa con el agente Go y el receptor Restic ya iniciados. Los repositorios
nuevos usan formato 2 y compresión explícita `auto`, aplicada antes del cifrado
y de la transferencia. La política permite `max` para priorizar espacio sobre
CPU/tiempo. No permite desactivar la compresión desde el portal en esta entrega.
La compresión reduce el tamaño según el contenido; no se promete un porcentaje.

Alternativas consideradas: un ZIP completo por ejecución es sencillo de abrir,
pero vuelve a transferir el conjunto y consume espacio temporal; un protocolo
propio de fragmentos exigiría construir y mantener integridad, cifrado y
reanudación. Restic aprovecha el código existente y guarda versiones comprimidas,
cifradas y deduplicadas. Los repositorios se restauran con Restic; no son archivos
ZIP que se puedan abrir directamente. La descarga preparada por el servidor sí
puede entregarse como ZIP, con acceso autorizado y caducidad.

## Flujo del usuario

1. En la ficha del cliente, seleccionar «Vincular equipo» y generar un código
   de un solo uso, válido durante diez minutos.
2. Instalar el agente en el equipo, introducir el dominio y el código, y asignar
   un nombre reconocible al equipo. El código vincula exactamente ese cliente.
3. Configurar carpetas, exclusiones, horario, retención y compresión automática
   o máxima. El destino físico se administra en SRVJC y no lo elige el agente.
4. Ver estado, último contacto, progreso, última copia verificada e historial
   en el portal. «Respaldar ahora» deja una orden pendiente si está desconectado.
5. Restaurar una versión hacia una carpeta nueva o preparar una descarga.

El agente corre como servicio Windows sin requerir una sesión abierta. Su
credencial es propia y revocable; no almacena la contraseña humana del portal.
Las rutas actuales basadas en IP quedan identificadas como sistema antiguo y
no se borran sus copias, configuraciones ni historial.

## Conexiones y receptor

La API de control utiliza el dominio del portal. Los archivos se envían
directamente a `https://respaldos.jcevnzl.space`, cuyo receptor se ejecuta en
SRVJC. Vercel transporta órdenes y estados, no los archivos del respaldo.
La ruta propuesta de almacenamiento es `D:\JCRespaldos`; el instalador valida
existencia, espacio y ACL antes de usarla, y exige elegir otra si no es válida.

Los packs tendrán un objetivo inicial de 16 MiB. Ese objetivo no es un límite
duro de petición: se comprobarán tamaños reales y límites del proxy con el
binario fijado antes de activar clientes. Ante cortes se reintentan peticiones
y se reutilizan bloques ya almacenados/indexados; no se promete reanudación
del byte exacto de una petición interrumpida. Un respaldo incompleto nunca se
presenta como exitoso. Se mantiene un intento inicial y un reintento de respaldo
a los quince minutos, diferenciándolos de reintentos de comunicación.

Cada equipo tiene repositorio y claves propios. El receptor limita al agente
a su repositorio y no le permite eliminar versiones anteriores. La retención
la ejecuta un trabajador local con permisos separados. Las claves recuperables
se guardan cifradas en el servidor y se documenta su copia externa independiente.

## Integración pendiente comprobada

- `lib/cloud-app.js` todavía responde 503 para todo `/api/backups`.
- Hay esquema y repositorio PostgreSQL, pero faltan las rutas de vinculación,
  autenticación de agentes, políticas, reclamación, resultados y restauración.
- El agente tiene piezas de control, diario y ejecución; requiere completar
  instalación, coordinación, progreso y recuperación después de interrupciones.
- El provisionador crea repositorios, pero necesita aceptar los identificadores
  reales de clientes mediante un mapeo seguro, sin convertirlos en rutas libres.
- El portal debe sustituir la conexión por IP y diferenciar tamaño original,
  datos nuevos almacenados y bytes enviados; no equiparar deduplicación con
  porcentaje de compresión o velocidad de transferencia.

## Aceptación antes de activar equipos reales

Pruebas de dos clientes aislados, código vencido/reutilizado, token revocado,
políticas no autorizadas y ausencia de secretos en respuestas y registros.
Respaldar datos sintéticos por el receptor HTTPS, cambiar y eliminar archivos,
crear una segunda versión, restaurar ambas en carpetas vacías y comparar SHA-256.
Comprobar compresión con datos compresibles e incompresibles, cortes de conexión,
reinicio entre tentativas y ausencia de ejecuciones duplicadas.
Probar arranque de los servicios antes de iniciar sesión en Windows.
Las bases de datos en uso requieren un perfil de exportación consistente probado;
copiar archivos abiertos por sí solo no acredita un respaldo recuperable.

## Referencias

- Diseño base: `2026-09-26-respaldos-restic-design.md`.
- Plan existente: `../plans/2026-09-26-respaldos-restic.md`.
- Opciones de compresión y packs: https://github.com/restic/restic/blob/master/doc/man/restic-backup.1
- Recuperación de respaldos interrumpidos: https://github.com/restic/restic/blob/master/doc/faq.rst
