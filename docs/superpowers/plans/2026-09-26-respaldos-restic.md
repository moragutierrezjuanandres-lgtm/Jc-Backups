# JC Respaldos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar agente Windows, receptor y modulo del portal con respaldo cifrado, dos tentativas como maximo y restauracion comprobada.

**Architecture:** React y Express/PostgreSQL conservan usuarios y clientes existentes. Coordinador persistente y rest-server reciben conexiones salientes del agente Go/Restic; Vercel no transporta los archivos. La implementacion se divide en tres entregas comprobables: API/coordinador, agente/receptor y portal/piloto.

**Tech Stack:** Node 24, Express 4, PostgreSQL, React 18, Go, Windows SCM, Restic y rest-server; PGlite para pruebas de API y PostgreSQL real para concurrencia.

**Spec:** ../specs/2026-09-26-respaldos-restic-design.md (aprobada por el usuario).

## Global Constraints

- Windows Server 2019; servicio sin sesion y sin puertos entrantes en clientes.
- Un intento inicial y exactamente un reintento de respaldo a los 15 minutos del primer fallo.
- Retencion predeterminada: siete snapshots exitosos por equipo, editable.
- Datos estimados: 3 a 25 GB por cliente, aproximadamente 20 clientes; no imponer una cuota universal de 25 GB.
- Usuarios del portal para la aplicacion; token revocable propio para el servicio; nunca conservar contrasenas humanas.
- HTTPS con validacion de certificado; repositorio y clave independientes por equipo; autorizacion por cliente en cada ruta.
- Respaldos incompletos nunca son exitosos; ningun borrado ni restauracion sobre archivos originales por defecto.
- No publicar ni activar clientes reales antes de verificar aislamiento y restauracion.
- Trabajar en el worktree existente jc-self-hosted, que esta limpio y contiene la especificacion. No modificar el checkout jc-enterprise-portal con cambios ajenos pendientes.
- Go no aparece instalado en PATH: preparar SDK oficial portable y registrar version/checksum durante la entrega del agente. No asumir disponibles Restic, receptor, DNS ni certificados.

## Review Focus

- Rutas Windows con espacios, Unicode, UNC, junctions y destinos dentro de origen: prueba en tarea 5.
- Reinicio tras crear snapshot pero antes de confirmar resultado: reconciliacion sin tercera tentativa, tarea 3/5.
- Horario duplicado/inexistente y reloj cambiado: una ocurrencia estable, tarea 3.
- Equipo perdido o revocado y restauracion desde otro equipo: tarea 6.
- Disco receptor lleno, retencion simultanea y snapshot parcial: tarea 4/6.

## Contratos compartidos

`Device`: id UUID, clientId, label, status(active|revoked), lastSeenAt UTC, policyRevision.
`Policy`: id UUID, deviceId, revision, sourceDirs[], excludes[], days[0..6], time HH:mm, timezone IANA, retentionSuccessfulCount(default 7), consistencyProfile.
`Run`: id UUID, deviceId, policyRevision, occurrenceKey unique, status(queued|running|retry_wait|succeeded|failed|overdue), attemptsStarted 0..2, retryAt UTC|null, snapshotId|null, leaseUntil UTC|null.
`RunEvent`: id UUID, runId, attempt 1|2, sequence integer, kind(start|progress|result), payload; resultado contiene exitCode, snapshotId, processedBytes, addedBytes, errorCode y message sin secretos.
`RestoreJob`: id, clientId, deviceId, snapshotId, paths[], status, destination(new-directory|download), expiresAt.
Importes, tamanos y tiempos son numericos; se formatean solo en interfaz. El servidor deriva clientId desde el dispositivo autenticado.

### Tarea 1: Persistencia y migracion PostgreSQL (entrega API)

**Files:** crear lib/backup/schema.js, lib/backup/repository.js, tests/backup-store.test.mjs; modificar lib/postgres.js.
**Interfaces:** `initializeBackupSchema(pool)`, `BackupRepository(pool)` con `enqueue(deviceId, occurrenceKey, policyRevision)`, `claim(deviceId, now)`, `appendEvent(deviceId, event, now)`. Usar transacciones y constraints; no colecciones JSON para colas.
- [ ] Crear pruebas: enqueue repetido devuelve mismo id; intentos fuera de 0..2 se rechazan; evento repetido no altera estado; rollback no deja trabajos huerfanos.
- [ ] Ejecutar `node --test tests/backup-store.test.mjs`; confirmar fallo por ausencia de implementacion.
- [ ] Crear tablas de la especificacion y consultas parametrizadas; migracion aditiva e idempotente. Claim atomico con bloqueo y duracion de lease documentada de 120 segundos.
- [ ] Repetir pruebas en PGlite; probar dos reclamaciones simultaneas sobre PostgreSQL aislado: solo una obtiene el trabajo.
- [ ] Commit exclusivo de esta tarea: `feat: add durable backup storage`.

### Tarea 2: Acceso, dispositivos y vinculacion

**Files:** crear lib/backup/auth.js, lib/backup/routes.js, tests/backup-auth.test.mjs; modificar lib/cloud-app.js, lib/access.js.
**Interfaces:** `installBackupRoutes(app,{store,repository,vaultKey,authorize})`; compartir la validacion de login existente mediante extraccion pequena, manteniendo comportamiento y limites. Rutas `/api/backups/devices`, `/api/backups/enrollments`, `/api/backup-agent/enroll`, `/api/backup-agent/heartbeat`, `/api/backup-agent/policy`, `/api/backup-agent/claim`, `/api/backup-agent/events`.
- [ ] Pruebas fallidas: cuenta incorrecta 401, sin permiso 403, cliente A no lee B, codigo vencido/reutilizado rechazado, revocacion efectiva, eventos para otro equipo rechazados, secretos ausentes de respuestas de operador.
- [ ] Ejecutar `node --test tests/backup-auth.test.mjs` y registrar los fallos esperados.
- [ ] Implementar codigo aleatorio de diez minutos almacenado como hash, token de agente aleatorio almacenado como hash, secretos de repositorio cifrados con AES-GCM y contexto clientId/deviceId. Evitar permiso automatico solo por ver clientes.
- [ ] Ejecutar pruebas nuevas y `node --test tests/cloud.test.mjs`; adaptar exclusivamente la prueba antigua que esperaba 503 en respaldos para el nuevo modo habilitado/deshabilitado.
- [ ] Commit: `feat: authenticate and enroll backup devices`.

### Tarea 3: Programador, dos tentativas y alertas

**Files:** crear lib/backup/scheduler.js, lib/backup/run-state.js, lib/backup/alerts.js, server/backup-coordinator.mjs, tests/backup-scheduler.test.mjs.
**Interfaces:** `nextOccurrence(policy, afterUTC)`, `transition(run,event,now)`, `tick({repository,clock})`. Rutas de operador POST `/api/backups/runs` y GET `/api/backups/alerts`.
- [ ] Pruebas con reloj inyectado: primer fallo fija retryAt=now+900000; antes de esa fecha no reclama; segundo fallo es terminal; reinicio conserva contador; duplicados no gastan intentos; orden manual desconectada permanece queued; un nuevo horario crea nuevo run.
- [ ] Agregar casos America/Caracas y cambio DST: una ejecucion en hora duplicada y siguiente instante valido para hora inexistente; reloj hacia atras no duplica occurrenceKey.
- [ ] Ejecutar `node --test tests/backup-scheduler.test.mjs` antes de implementar y confirmar fallos.
- [ ] Implementar coordinador persistente con cierre ordenado, alertas deduplicadas y reconciliacion de ocurrencias omitidas. Heartbeat cada 30 segundos; desconexion tras 120 segundos; atraso inicial de aviso 30 minutos, configurable. Sin tercera tentativa al recuperar comunicaciones.
- [ ] Repetir pruebas, incluyendo snapshot existente con resultado no confirmado y reinicio entre intentos.
- [ ] Commit: `feat: schedule backups with one retry and client alerts`.

### Tarea 4: Receptor aislado y aprovisionamiento

**Files:** crear server/backup-receiver/provision.mjs, server/backup-receiver/config.example.json, server/backup-receiver/Install-Receiver.ps1, tests/backup-receiver.test.mjs.
**Interfaces:** `provisionRepository({clientId,deviceId,storageRoot})` devuelve repositoryId y endpoint autorizado. Username unico `<clientId>_<deviceId>` para rest-server private-repos; mapear a ese espacio persistente, no compartir credencial por cliente.
- [ ] Pruebas fallidas: traversal bloqueado, usuario A no accede a repositorio B, agente no borra snapshot, credencial revocada falla, almacenamiento no usa TEMP.
- [ ] Implementar aprovisionamiento idempotente, rest-server autenticado append-only/private-repos, directorio de datos configurable y acceso administrativo local separado. Restic y receptor fijados por version/checksum oficial.
- [ ] Instalador verifica ACL, espacio, servicios y certificado; muestra configuracion DNS requerida sin cambiarla automaticamente. Elegir HTTPS directo o tunel en la instalacion, comprobando sus limites. Servicios con recuperacion y logs rotados.
- [ ] Ejecutar `node --test tests/backup-receiver.test.mjs` contra receptor temporal con dos cuentas y comprobar error de disco lleno sin perder snapshots anteriores.
- [ ] Commit: `feat: provision isolated restic receiver`.

### Tarea 5: Agente y aplicacion Windows

**Files:** crear agent/go.mod, agent/cmd/jc-backup/main.go, agent/internal/{service,control,journal,runner,ui,secrets}/ con archivos .go y pruebas *_test.go; agent/Install-Agent.ps1, agent/Uninstall-Agent.ps1, agent/build.ps1.
**Interfaces:** `Runner.Backup(ctx, Run, Policy) -> Result`, `Control.Claim(ctx) -> Run`, `Journal.StartAttempt(runId,attempt)`, `Journal.StoreResult(Result)`; JSON coincide con contratos compartidos. SCM y DPAPI solo en archivos *_windows.go.
- [ ] Preparar SDK oficial; escribir pruebas fallidas para exactamente dos lanzamientos, diario persistido antes de arrancar Restic, resultado persistido antes de enviarlo y no guardar contrasena del usuario.
- [ ] Implementar runner con argumentos separados (sin shell), JSON de Restic, timeout/cancelacion y clasificacion 0/3/error. Validar carpetas con espacios/Unicode, UNC, junctions y exclusion del destino/cache propio.
- [ ] Implementar servicio SCM automatico y recuperacion; interfaz local de configuracion autenticada con portal, protegida contra accesos remotos/CSRF, sin exponer el token del servicio. Mostrar cliente, equipo, carpetas, horario y estado.
- [ ] Guardar secretos bajo identidad de servicio con DPAPI/ACL. Para UNC, instalador exige una identidad con permisos verificables; no prometer acceso de LocalSystem a cualquier recurso de red.
- [ ] Ejecutar `go test ./...` en agent, compilar ejecutable Windows y probar instalacion/desinstalacion en VM Server 2019 sin sesion. Simular perdida de red, reinicio y recuperacion de resultados sin otra copia.
- [ ] Commit: `feat: add Windows backup service and setup app`.

### Tarea 6: Consistencia, versiones, restauracion y retencion

**Files:** crear agent/internal/consistency/ con perfiles y pruebas; lib/backup/restore.js, lib/backup/retention.js, server/backup-maintenance.mjs, tests/backup-restore.test.mjs.
**Interfaces:** `Prepare(ctx, profile, sources) -> Capture` y `Capture.Close()`; `requestRestore(identity, RestoreJob)`; `retainVerifiedSnapshots(repositoryId,count)`.
- [ ] Pruebas fallidas: exportacion fallida nunca crea exito; VSS fallido bloquea perfil que lo requiere; servicios solo se reinician si estaban activos; perfil DB desconocido no se declara consistente.
- [ ] Implementar archivos/VSS y perfiles SQL Server, PostgreSQL, Firebird y a2/DBF con herramientas nativas y configuracion local permitida. No aceptar comandos arbitrarios desde API. Probar cada perfil en fixture del motor antes de habilitarlo.
- [ ] Implementar listado de snapshots y archivos, restauracion a carpeta nueva y descarga temporal autorizada desde servidor. Revocacion de agente no impide recuperacion autorizada desde boveda. Bloquear traversal y sobrescritura implicita.
- [ ] Retener siete snapshots exitosos por defecto, basados en registro verificado del servidor; no confiar en fecha enviada por agente. Excluir mantenimiento concurrente y conservar ultimo valido ante fallo.
- [ ] Ejecutar `node --test tests/backup-restore.test.mjs` y pruebas Go; restaurar dos versiones reales y comparar SHA-256; restaurar base en instancia separada.
- [ ] Commit: `feat: verify and restore versioned backups`.

### Tarea 7: Portal y ficha del cliente

**Files:** modificar src/views/Backups.jsx, src/views/Clients.jsx; crear src/components/BackupAlerts.jsx, src/components/BackupPolicyForm.jsx, src/components/BackupHistory.jsx, src/css/backups.css, tests/backup-ui.test.mjs.
**Interfaces:** consumo exclusivo de rutas autorizadas /api/backups; la UI no recibe claves de repositorio. GET `/api/backups` pagina equipos/ejecuciones; GET `/api/backups/snapshots` y POST `/api/backups/restores` usan filtros validados en servidor.
- [ ] Pruebas fallidas: dos equipos de un cliente separados; ausencia de datos no muestra exito; error parcial visible; doble clic en Respaldar ahora no duplica orden; fallo final visible en ficha; permisos denegados no muestran datos de otro cliente.
- [ ] Implementar vinculacion, politica, zona horaria, retencion, estado/ultimo contacto, historial, progreso y restauracion. Mantener consulta de respaldos antiguos distinguida del nuevo motor.
- [ ] Ejecutar pruebas y `npm run build`; comprobar en navegador escritorio/movil con fixtures ficticios. No introducir datos reales en capturas ni pruebas.
- [ ] Commit: `feat: integrate backup controls into client profiles`.

### Tarea 8: Paquete y piloto de aceptacion

**Files:** crear scripts/package-backup-release.mjs, docs/backups/INSTALL.md, docs/backups/RESTORE-DRILL.md, tests/backup-e2e.test.mjs; modificar .gitignore para excluir claves, repositorios y resultados privados.
- [ ] Crear prueba E2E contra servicios y repositorios temporales: dos clientes, dos equipos, vincular, programar, copiar, modificar/borrar, copiar otra vez, restaurar ambas versiones y comparar hashes. Guardar evidencia sin secretos.
- [ ] Ejecutar `npm test`, `go test ./...`, build del portal y paquete Windows con manifiesto de versiones/checksums; comprobar que no contiene credenciales, datos de produccion ni .env.
- [ ] Preparar instalador de SRVJC que valide dependencias como servicios reales, cierre ordenado y recuperacion. No declarar automatico por una prueba con sesion abierta.
- [ ] Solicitar solo los valores externos pendientes en instalacion: directorio receptor, DNS/TLS/modalidad de publicacion y motor del cliente piloto. Configurar un piloto antes de los veinte clientes.
- [ ] Probar reinicio del receptor y Windows Server 2019 antes de abrir sesion, Internet cortado, dos fallos/aviso y restauracion real. Registrar bloqueos de infraestructura como pendientes, nunca como aprobados.
- [ ] Commit: `test: package and verify backup recovery workflow`; entregar paquete, instrucciones y resultados medidos. Publicacion solo tras cumplir las comprobaciones.

## Revision propia del plan

Cobertura: vinculacion/acceso (2), horarios/reintento/avisos (3), DNS/almacenamiento (4), servicio/aplicacion (5), consistencia/restauracion/retencion (6), portal (7), paquete y prueba sin sesion (8). Riesgos del Review Focus incluidos en tareas respectivas. No usar datos o claves de produccion para tests. No afirmar un tiempo de entrega antes de resolver SDK, receptor y piloto.
