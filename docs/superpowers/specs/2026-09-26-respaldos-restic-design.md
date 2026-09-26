# JC Respaldos: especificacion para implementacion

Estado: propuesta concreta pendiente de revision del usuario. No instalado ni publicado.

## Objetivo y alcance acordado

Integrar respaldos de carpetas de aproximadamente 20 clientes Windows Server 2019, con entre 3 y 25 GB por cliente. Aplicacion sencilla: iniciar sesion con la cuenta del portal, elegir el cliente autorizado, vincular el equipo y configurar carpetas y horario. El servicio funciona sin sesion de Windows y solo establece conexiones salientes HTTPS.

Cada ejecucion tiene un intento inicial y exactamente un reintento de respaldo a los 15 minutos del primer fallo. Tras el segundo fallo se cierra como fallida y aparece un aviso en la ficha del cliente. El siguiente horario crea una ejecucion distinta. Reintentar comunicaciones de control o entregar resultados no inicia otro respaldo.

Retencion inicial propuesta y aceptable como valor editable: siete snapshots exitosos por equipo. No se limita globalmente a 25 GB; es una estimacion de volumen, no una cuota contratada.

## Arquitectura elegida

- Portal React/Vite: adaptar Backups.jsx y el apartado de respaldos de Clients.jsx.
- API Express/PostgreSQL: sustituir la respuesta 503 de /api/backups por rutas reales; preservar autenticacion, permisos y auditoria existentes.
- Coordinador persistente en SRVJC: programacion, ejecuciones pendientes, alertas, catalogo, restauraciones y retencion. Se instala como servicio, fuera de las funciones de Vercel.
- Agente Windows: ejecutable Go con modo servicio nativo SCM y aplicacion de configuracion local. Restic se distribuye como binario independiente con version fija y checksum verificado.
- Receptor: rest-server detras de HTTPS en respaldos.jcevnzl.space, almacenamiento persistente separado por cliente y equipo. Los datos no pasan por Vercel ni por el JSON de la API del portal.

Se conserva el agente antiguo Python/ZIP para consultar y restaurar copias anteriores; no se convierte automaticamente su historial a snapshots Restic ni se borran sus archivos.

## Identidad y vinculacion

La interfaz del agente requiere usuario y clave del portal al abrirla. Usa la misma validacion y restricciones de intentos del servidor, sin duplicar usuarios. La contrasena no se almacena, registra ni se incluye en argumentos de procesos. La sesion de configuracion es corta y separada del servicio.

El usuario elige un cliente al que tenga acceso. Un codigo de un solo uso, limitado a diez minutos y al cliente, vincula un identificador aleatorio de equipo. Se permite mas de un equipo por cliente. Un cliente del portal solo puede gestionar equipos de su propia ficha; los operadores necesitan permiso explicito de respaldos. Tener acceso general a clientes no concede automaticamente restauracion o acceso a claves.

El servicio recibe una credencial de dispositivo revocable, distinta de la cuenta humana, y la guarda protegida por Windows y ACL de su identidad de servicio. El servidor guarda hashes de tokens. Credencial de repositorio y clave de cifrado son distintas y exclusivas por equipo; se almacenan cifradas en una boveda del servidor para permitir restaurar si el equipo se pierde. Se entrega procedimiento de copia independiente de las claves de recuperacion.

No se aceptan destinos de repositorio, cliente ni equipo elegidos libremente por una solicitud del agente: se resuelven desde su identidad autenticada. No se permite ejecutar comandos de shell arbitrarios enviados por el portal.

## Datos y API

Tablas especificas PostgreSQL: backup_devices, backup_enrollments, backup_policies, backup_runs, backup_run_events, backup_snapshots, backup_alerts y backup_restore_jobs. Claves foraneas/logicas a clientId y deviceId, indices de trabajo pendiente, identificadores idempotentes y marcas de tiempo UTC.

Politica: origenes, exclusiones, dias, hora, zona IANA, retencion, modo de consistencia y revision. Ruta inicial de almacenamiento propuesta: D:\JCRespaldos; se confirma en el instalador antes de escribir. Nombres visibles de cliente nunca se usan como rutas fisicas sin normalizar; se emplean identificadores.

API de operador: listar equipos, emitir codigo, guardar politica, solicitar respaldo, consultar ejecuciones/versiones, solicitar restauracion y revocar dispositivo. API de agente: vincular, heartbeat, obtener politica, reclamar orden y enviar eventos/resultados. Todo cambio queda auditado y filtrado por cliente y equipo.

La cola vive en PostgreSQL, con reclamacion atomica y arrendamiento renovable. El agente mantiene un diario local duradero. Repetir una orden devuelve su estado, no lanza otro proceso. Solo una ejecucion por equipo/repositorio simultanea.

## Horarios, desconexion y reintento

El agente recibe una politica versionada y conserva localmente el siguiente horario. Cada ocurrencia se identifica por equipo, politica y fecha/hora programada; el coordinador registra la misma ocurrencia para detectar retrasos. Se define una unica ejecucion en horas duplicadas por cambio horario y se mueve al siguiente instante valido una hora inexistente.

Una orden manual enviada a un equipo desconectado queda pendiente; no consume intentos antes de ser recibida. Si falta conexion al ejecutar un horario local, se registra el primer fallo y se realiza una unica segunda tentativa 15 minutos despues. Si el equipo estaba apagado, se recupera una ocurrencia omitida al arrancar y se informa del retraso, evitando una rafaga de copias de todos los dias perdidos.

Tras un reinicio se reconcilian el diario y los snapshots existentes antes de repetir. Una tentativa iniciada y no completada no se reinicia como intento uno. Si se agotan ambas tentativas, solo una nueva orden manual o el siguiente horario puede crear otro trabajo.

Los heartbeats y resultados usan espera exponencial con limite para comunicarse. Esta reconexion no debe confundirse con mas reintentos de respaldo. Si no se puede informar un fallo por falta de Internet, el portal marca la ocurrencia vencida; recibe el detalle al reconectar.

## Motor, progreso y retencion

Restic ejecuta backup con salida JSON y crea versiones incrementales mediante deduplicacion. Se reportan fase, archivos procesados, bytes procesados, datos agregados al repositorio, snapshot, tiempos y errores; no se presenta el porcentaje del escaneo como porcentaje transferido.

Codigo 0 mas snapshot comprobable: exito. Codigo 3: incompleto y sujeto a la regla de reintento, nunca exito. Otros codigos: fallo clasificado. Un resultado repetido no cambia el contador de intentos. Los snapshots incompletos se distinguen de las siete copias exitosas.

El acceso publico del agente al repositorio permite agregar, pero no eliminar copias anteriores. Un trabajador del servidor realiza retencion y mantenimiento con permisos separados y bloqueo de repositorio. La seleccion para borrar se apoya en ejecuciones verificadas por el servidor, no solo fechas o etiquetas declaradas por un cliente. Los fallos no eliminan el ultimo respaldo valido. Se controlan capacidad y espacio temporal antes de iniciar.

## Consistencia de bases de datos

Archivos ordinarios: captura VSS cuando corresponda. No se declara consistencia de una base de datos solo porque se pudo leer su archivo.

Perfiles previstos: respaldo nativo de SQL Server, exportacion PostgreSQL, respaldo nativo Firebird y procedimiento controlado para a2/DBF. Debe seleccionarse y probarse el perfil del motor instalado antes de habilitar un respaldo de base en uso. Si el perfil es desconocido, la interfaz bloquea la afirmacion de respaldo consistente y solicita configuracion.

Si un perfil requiere detener servicios, los nombres se permiten explicitamente, se recuerda su estado anterior y se garantiza su recuperacion mediante limpieza y reconciliacion tras reinicio. El valor predeterminado nunca detiene servicios desconocidos. Fallos de exportacion, VSS o reanudacion generan error visible.

## Restauracion y avisos

Catalogo por equipo y snapshot; seleccion de archivos/directorios y restauracion por defecto a una carpeta nueva. Sobrescribir datos en uso requiere una accion separada explicita. El trabajador del servidor permite preparar una descarga temporal autorizada si el agente original no esta disponible; protege rutas, permisos y caducidad.

Ficha del cliente: equipo conectado, ultimo contacto, ultima copia exitosa, tamano, proxima ejecucion, historial y avisos. Avisos deduplicados por fallo final, respaldo vencido, desconexion prolongada, falta de espacio o error de restauracion. Los avisos se resuelven al cumplirse su condicion de recuperacion, conservando historial. Canal inicial: portal; correo/WhatsApp no se habilitan sin configurar proveedor y destinatarios.

## Infraestructura pendiente de provisionar

En la revision anterior, respaldos.jcevnzl.space resolvia a Vercel y devolvia DEPLOYMENT_NOT_FOUND. Hay que verificar nuevamente y dirigirlo a un receptor HTTPS real. DNS no recibe ni almacena archivos.

El instalador de servidor solicitara ruta de datos, puerto local, hostname y modalidad de publicacion: IP publica/443 o tunel compatible. Se prueban limites de solicitudes y tiempos de espera antes de usar un tunel. No se modifica el DNS del portal ni se abre PostgreSQL a Internet.

SRVJC requiere servicios reales con arranque automatico para receptor, coordinador y sus dependencias, recuperacion y cierre ordenado. El agente cliente tambien requiere instalacion administrativa una vez. La prueba de instalacion no se sustituye por una comprobacion de salud con la sesion abierta.

La unidad D: tenia aproximadamente 995 GB libres; 500 GB iniciales mas cambios y restauracion temporal pueden superar esa capacidad. Se medira el crecimiento y se configuraran avisos; siete versiones no implican siete copias completas ni un consumo fijo. La copia secundaria del almacenamiento y de las claves se documenta como requisito operativo separado.

## Entregables y aceptacion

1. API y migraciones compatibles con PostgreSQL, sin tocar datos de otros modulos.
2. Agente instalable Windows Server 2019 y aplicacion de acceso/configuracion, con desinstalacion y registros sin secretos.
3. Instalador del receptor/coordinador y guia de DNS, TLS, almacenamiento y recuperacion.
4. Pantalla de respaldos y avisos en la ficha del cliente.
5. Pruebas de aislamiento entre dos clientes y entre dos equipos; credencial revocada; codigo vencido; permisos de restauracion.
6. Pruebas de exactamente dos tentativas, duplicados, reinicio entre intentos, corte de Internet y orden manual desconectada.
7. Respaldo real con Restic de datos de prueba, modificacion/borrado de archivos y segunda version. Restaurar ambas versiones en carpetas vacias y comparar SHA-256. Registrar snapshot, archivos, hashes y resultado.
8. Base de datos de prueba: respaldo consistente, restauracion en instancia separada y validacion funcional del motor elegido.
9. Reiniciar un Windows Server 2019 piloto y SRVJC; verificar ejecucion desde otro equipo antes de abrir sesion. No declarar funcionamiento sin sesion hasta pasar esta prueba.

No se publican cambios ni se configura un cliente real hasta verificar receptor, aislamiento y restauracion. Las credenciales y datos reales no forman parte del repositorio ni del paquete distribuido.
