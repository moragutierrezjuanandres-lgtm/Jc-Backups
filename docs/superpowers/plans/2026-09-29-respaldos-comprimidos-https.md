# Respaldos comprimidos por HTTPS — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el envío de respaldos comprimidos desde equipos Windows hacia SRVJC por HTTPS y su gestión/restauración desde el portal.

**Architecture:** Mantener el agente Go/Restic y PostgreSQL existentes. La API autentica usuarios y dispositivos; un coordinador persistente administra las ejecuciones y un receptor separado recibe archivos. Sustituir el formulario basado en IP por vinculación con código.

**Tech Stack:** Node 24, Express, PostgreSQL/PGlite, React/Vite, Go/Windows SCM, Restic formato 2 y rest-server.

**Spec:** `../specs/2026-09-29-respaldos-comprimidos-https-design.md`, aprobado por «hazlo» el 29 de septiembre. Complementa el plan `2026-09-26-respaldos-restic.md`; sus ocho tareas y pruebas siguen siendo obligatorias. Este documento precisa diferencias y orden sobre el código existente, sin dar por completadas tareas por la mera existencia de archivos.

## Global Constraints

- HTTPS saliente desde clientes; sin IP fija, VPN ni puertos entrantes.
- Compresión explícita `auto` predeterminada, `max` opcional; repositorio formato 2.
- Packs con objetivo de 16 MiB; verificar tamaño real y compatibilidad del túnel.
- Una tentativa inicial y un reintento de respaldo a los 15 minutos; comunicación e intento de respaldo son contadores diferentes.
- Siete versiones exitosas por equipo por defecto; conservación y mantenimiento solo desde el servidor.
- Copias independientes por equipo, credenciales revocables y claves recuperables cifradas.
- Proponer `D:\JCRespaldos`; validar directorio, espacio y permisos en el instalador antes de escribir datos.
- No activar clientes reales antes de probar aislamiento, HTTPS y restauración.
- Conservar datos, agentes y copias antiguos; trabajar en `jc-self-hosted` sin modificar el checkout original.

## Review Focus

1. Los clientId existentes son texto, no necesariamente UUID: mapeo determinista a una identidad segura de repositorio, tarea A.
2. `backupsAllowed` actualmente permite acceso por permiso general de clientes: comprobar permisos explícitos y aislamiento antes de montar nuevas rutas, tarea B.
3. Corte después de crear un snapshot y antes de confirmar resultado: reconciliar sin crear una tercera tentativa, tarea C.
4. El runner de VSS reconstruye argumentos: conservar compresión, exclusiones, etiquetas y tamaño de packs también en este perfil, tarea A.
5. Código existente no equivale a servicio instalado: verificar arranque sin sesión y restauración real, tareas D/F.

## A. Compresión y repositorios compatibles

**Files:** modificar `agent/internal/runner/runner.go`, `runner_test.go`, `lib/backup/schema.js`, `server/backup-receiver/provision.mjs`, `tests/backup-receiver.test.mjs`, `src/utils/backupView.js`, `tests/backup-ui.test.mjs`.

**Interfaces:** Policy añade `compression: 'auto'|'max'`, default auto. `backupArgs(policy Policy) []string` conserva rutas literales y añade `--compression`, `--pack-size 16` y las opciones VSS. `repositoryIdentity(clientId,deviceId)` usa SHA-256 hexadecimal del clientId válido más deviceId UUID; nunca una ruta suministrada por el cliente. Conservar acceso a repositorios antiguos mediante su repository_id persistido.

- [ ] Añadir pruebas fallidas `compression_defaults_to_auto`, `compression_rejects_off`, `vss_preserves_compression_and_paths` y `text_client_ids_are_isolated` con clientes `cli-001`, Unicode y entradas malformadas.
- [ ] Ejecutar pruebas Node indicadas y `go test ./internal/runner`; confirmar que detectan las diferencias actuales.
- [ ] Añadir migración aditiva de compression, validar la política también en servidor y exigir formato 2 en repositorios nuevos; no migrar repositorios existentes implícitamente.
- [ ] Repetir pruebas y respaldo Restic real de archivos compresibles/incompresibles; medir tamaño y restaurar/comparar contenido.
- [ ] Commit de compresión y mapeo, sin desplegar todavía.

## B. API y vinculación sin IP

**Files:** crear `lib/backup/auth.js`, `lib/backup/routes.js`, `tests/backup-auth.test.mjs`; modificar `lib/cloud-app.js`, `lib/access.js`, `lib/backup/repository.js`, `server/self-hosted.mjs`.

**Interfaces:** conservar rutas de tarea 2 del plan base. `installBackupRoutes(app,{store,repository,vaultKey,authorize,receiver})` recibe `receiver.provision` y `receiver.revoke` inyectables. `authorize` valida la sesión PostgreSQL existente, sin aceptar identidad desde cabeceras del cliente. Las respuestas de operador no contienen secretos de dispositivo/repositorio.

- [ ] Escribir y ejecutar pruebas fallidas para 401, 403, permiso de clientes insuficiente, cliente A/B, código válido de diez minutos, vencido y consumido concurrentemente, y revocación.
- [ ] Implementar transacción para consumir código una vez, credenciales con hashes, recuperación del aprovisionamiento interrumpido y políticas versionadas con compresión.
- [ ] Montar rutas reales en modo configurado; mantener un error explícito de receptor no configurado cuando corresponda, sin inventar copias.
- [ ] Ejecutar `node --test tests/backup-auth.test.mjs tests/cloud.test.mjs tests/self-hosted.test.mjs` y concurrencia en PostgreSQL temporal.
- [ ] Commit de integración autenticada.

## C. Coordinador y recuperación de ejecuciones

**Files:** crear `lib/backup/scheduler.js`, `lib/backup/run-state.js`, `lib/backup/alerts.js`, `server/backup-coordinator.mjs`, `tests/backup-scheduler.test.mjs`; modificar diario/servicio Go y repository existentes.

**Interfaces:** conservar `nextOccurrence`, `transition` y `tick` de tarea 3 del plan base. Heartbeat renueva la ejecución correspondiente; los resultados verifican snapshot, dispositivo y orden antes de declararse exitosos. Restic identifica ejecuciones mediante etiquetas estables de runId y attempt.

- [ ] Escribir y ejecutar pruebas fallidas para lease renovable, 900000 ms entre tentativas, máximo dos, duplicados, equipo desconectado y reinicio tras snapshot sin acuse.
- [ ] Implementar programación y alertas persistentes; reconciliar el diario y snapshots antes de repetir; transmitir progreso sin acumular toda la salida de procesos en memoria.
- [ ] Probar cambios de horario America/Caracas/DST, resultados atrasados y reloj hacia atrás según plan base.
- [ ] Ejecutar pruebas Node de coordinador y `go test ./...`; commit.

## D. Receptor y agente instalables

**Files:** crear `server/backup-receiver/Install-Receiver.ps1`, `config.example.json`, `agent/cmd/jc-backup/main.go`, `agent/internal/service/scm_windows.go`, `agent/Install-Agent.ps1`, `agent/Uninstall-Agent.ps1`, `agent/build.ps1`; completar control, ui y secrets existentes.

**Interfaces:** dominio de control del portal; repositorio HTTPS entregado solo tras vinculación. El instalador exige Restic/rest-server con versión y checksum fijados. Receptor append-only/private-repos; mantenimiento administrativo separado. Las credenciales del servicio se guardan con DPAPI y ACL compatibles con su identidad.

- [ ] Preparar pruebas de dos repositorios aislados, borrado denegado al agente, revocación y destinos fuera del almacenamiento permitido.
- [ ] Completar servicios SCM con cierre ordenado, recuperación y logs sin secretos; enlazar configuración local con código de vinculación, protegida contra CSRF/acceso remoto.
- [ ] Instalar receptor de prueba y verificar transferencia real HTTPS, tamaño de packs y reconexión. No modificar DNS de producción antes de tener receptor preparado y comprobado.
- [ ] Compilar paquete Windows y probar arranque sin sesión en SRVJC y equipo piloto; si falta una VM o permiso administrativo, registrar el bloqueo exacto.
- [ ] Commit de servicios/instaladores verificados.

## E. Portal y recuperación de archivos

**Files:** modificar `src/views/Backups.jsx`, `src/views/Clients.jsx`, `src/utils/backupView.js`, `src/css/backups.css`; crear componentes BackupPolicyForm/BackupHistory/BackupAlerts, `lib/backup/restore.js`, `lib/backup/retention.js`, `server/backup-maintenance.mjs`, `tests/backup-restore.test.mjs`.

**Interfaces:** rutas y RestoreJob del plan base. La pantalla muestra vinculación, equipos, carpetas, horario, compresión, historial y restauración. Los tamaños original, almacenado y transferido son magnitudes distintas. Las copias antiguas se identifican como legado.

- [ ] Escribir pruebas fallidas de política auto/max, orden manual idempotente, aislamiento, descarga caducada, traversal y restauración a carpeta nueva.
- [ ] Implementar pantallas y mantenimiento sobre snapshots verificados; aplicar retención sin borrar el último respaldo válido tras un fallo.
- [ ] Completar perfiles de consistencia de tarea 6 del plan base; un perfil de base de datos no probado permanece bloqueado y claramente indicado.
- [ ] Ejecutar pruebas Node, build y revisión visual de escritorio/móvil con datos ficticios; commit.

## F. Entrega comprobada

**Files:** crear `scripts/package-backup-release.mjs`, `tests/backup-e2e.test.mjs`, `docs/backups/INSTALL.md`, `docs/backups/RESTORE-DRILL.md`.

- [ ] Respaldar dos versiones reales con cambios/borrados; restaurarlas y comparar SHA-256. Repetir con corte de Internet y reinicio, comprobando contadores e aislamiento.
- [ ] Ejecutar suite Node, Go y build, registrando pruebas omitidas como pendientes. Comprobar paquete sin .env, credenciales ni datos reales.
- [ ] Documentar copia externa de claves, almacenamiento, requisitos UNC/VSS y evidencia de arranque sin sesión.
- [ ] Publicar únicamente después de cumplir las comprobaciones y configurar primero un equipo piloto; entregar paquete e instrucciones.

## Ejecución propuesta y revisión propia

Recomendación: ejecución directa en esta tarea, siguiendo A–F y reutilizando el plan base; los componentes comparten contratos y el estado existente está incompleto. Revisión independiente al finalizar según la guía de ejecución. El usuario debe revisar este plan y elegir ejecución directa o mediante subagentes antes de implementar, conforme a la guía de planificación.

Cobertura revisada: compresión/mapeo (A), vinculación/permisos (B), cortes/reintento (C), HTTPS/servicios (D), interfaz/restauración (E), prueba real/paquete (F). No hay activaciones de producción ni clientes reales implícitas en la creación de este documento.
