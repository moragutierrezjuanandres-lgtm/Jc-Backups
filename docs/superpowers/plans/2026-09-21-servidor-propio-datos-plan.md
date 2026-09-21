# Servidor propio para datos y API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ejecutar la API y PostgreSQL de JC en este servidor, manteniendo Vercel como frontend y Neon como respaldo temporal.

**Architecture:** Se añadirá un servicio Node/Express desplegable en el servidor con PostgreSQL privado y almacenamiento de archivos local. Vercel recibirá una URL de API configurable y conservará una ruta de reversión a Neon hasta validar login, lecturas, escrituras, reportes y archivos.

**Tech Stack:** Node.js 24, Express 4, PostgreSQL, `pg`, Vite/React, PowerShell/Windows Service o tarea programada, HTTPS mediante reverse proxy/túnel seguro.

**Spec:** `docs/superpowers/specs/2026-09-21-servidor-propio-datos-design.md`

## Global Constraints

- PostgreSQL no se expone públicamente; solo la API puede conectarse.
- Neon se conserva hasta terminar la validación y la prueba de restauración.
- Las variables sensibles permanecen fuera de Git y se configuran en el servidor/Vercel.
- Las fotos y PDFs se guardan como archivos; PostgreSQL conserva metadatos y rutas.
- El endpoint de salud no devuelve datos de clientes ni credenciales.
- No se cambia el dominio público hasta que la API propia pase las pruebas.

## Review Focus

- Servidor reiniciado: la API debe recuperar sesiones y datos desde PostgreSQL.
- API sin HTTPS o con origen desconocido: debe rechazar la petición.
- Foto grande o tipo no permitido: debe devolver error sin escribir un archivo parcial.
- Error de PostgreSQL durante escritura: la transacción debe revertirse.
- Cambio de origen a Neon: el frontend debe seguir funcionando durante la reversión.

### Task 1: Crear configuración portable del servicio

**Files:**
- Create: `server/self-hosted-config.example.env`
- Create: `server/README.md`
- Modify: `.gitignore`
- Test: `tests/self-hosted-config.test.mjs`

**Interfaces:**
- Produce variables `SELF_HOST_API_ORIGIN`, `SELF_HOST_DATABASE_URL`, `SELF_HOST_DATA_DIR`, `SELF_HOST_ALLOWED_ORIGINS`, `SELF_HOST_SESSION_SECRET`.

- [ ] **Step 1: Write the failing test** asserting required variables are listed and missing secrets are rejected.
- [ ] **Step 2: Run `node --test tests/self-hosted-config.test.mjs` and verify it fails.**
- [ ] **Step 3: Add the example env, startup instructions, and ignore actual server env/data paths.**
- [ ] **Step 4: Run the test and verify it passes.**
- [ ] **Step 5: Commit `chore: document self-hosted service configuration`.**

### Task 2: Adapt the API for a configurable public origin

**Files:**
- Modify: `api/index.js`
- Modify: `lib/cloud-app.js`
- Modify: `.env.example`
- Test: `tests/cloud.test.mjs`

**Interfaces:**
- `createCloudApp({ store, vaultKey, origins, secureCookie })` remains compatible.
- `api/index.js` selects the self-hosted connection when `SELF_HOST_DATABASE_URL` and `SELF_HOST_MODE=true` are present.

- [ ] **Step 1: Add failing tests for allowed self-host origin, rejected origin, and health response.**
- [ ] **Step 2: Run the focused cloud tests and verify the new assertions fail.**
- [ ] **Step 3: Read origins from `SELF_HOST_ALLOWED_ORIGINS`, require HTTPS outside localhost, and keep Neon as the default when self-host mode is absent.**
- [ ] **Step 4: Run `node --test tests/cloud.test.mjs` and verify all tests pass.**
- [ ] **Step 5: Commit `feat: support configurable self-hosted api origin`.**

### Task 3: Add PostgreSQL bootstrap and backup scripts

**Files:**
- Create: `server/scripts/bootstrap-postgres.ps1`
- Create: `server/scripts/backup-postgres.ps1`
- Create: `server/scripts/restore-postgres.ps1`
- Create: `server/scripts/verify-backup.ps1`
- Modify: `server/README.md`
- Test: `tests/self-hosted-scripts.test.mjs`

**Interfaces:**
- Bootstrap runs the existing `schema` initialization without importing over existing tables.
- Backup writes a timestamped `.dump` outside the repo.
- Restore requires an explicit dump path and reports row counts after restore.

- [ ] **Step 1: Write failing tests that validate safe paths, timestamp naming, and refusal to restore a missing dump.**
- [ ] **Step 2: Run the focused tests and verify they fail.**
- [ ] **Step 3: Implement scripts using `pg_dump`, `pg_restore`, and the repository schema; never use destructive drop commands by default.**
- [ ] **Step 4: Run tests and a dry-run against a disposable local database.**
- [ ] **Step 5: Commit `feat: add self-hosted postgres backup workflow`.**

### Task 4: Add file storage for report photos and PDFs

**Files:**
- Create: `lib/file-store.js`
- Modify: `lib/cloud-app.js`
- Modify: `src/context/AppContext.jsx`
- Test: `tests/file-store.test.mjs`

**Interfaces:**
- `saveFile({ data, contentType, ownerId, kind }) -> { id, path, contentType, bytes }`.
- `readFile(id, user) -> Buffer` checks ownership and permission.
- Maximum image/PDF size is 8 MB per file; accepted types are PNG, JPEG, WebP and PDF.

- [ ] **Step 1: Write failing tests for valid files, invalid MIME, traversal-like IDs, and size limit.**
- [ ] **Step 2: Run focused tests and verify failures.**
- [ ] **Step 3: Implement random opaque IDs, atomic temporary writes, permissions, and metadata references.**
- [ ] **Step 4: Run tests and verify cleanup after rejected writes.**
- [ ] **Step 5: Commit `feat: store report files outside postgres`.**

### Task 5: Run the service reliably on this Windows server

**Files:**
- Create: `server/start-self-hosted.ps1`
- Create: `server/stop-self-hosted.ps1`
- Create: `server/install-task.ps1`
- Modify: `server/README.md`
- Test: `tests/self-hosted-process.test.mjs`

**Interfaces:**
- Start script validates env, checks PostgreSQL, initializes schema, then starts `server.js` bound to localhost.
- Install script creates a restart-on-boot scheduled task without storing secrets in the task command line.

- [ ] **Step 1: Write failing tests for missing env, occupied port, and health check.**
- [ ] **Step 2: Run tests and verify failures.**
- [ ] **Step 3: Implement scripts with explicit working directory and log directory.**
- [ ] **Step 4: Start the service locally and verify `GET /api/health` returns 200.**
- [ ] **Step 5: Commit `feat: run self-hosted api as a managed windows service`.**

### Task 6: Migrate data and add reversible frontend routing

**Files:**
- Create: `scripts/export-neon-for-self-host.mjs`
- Create: `scripts/import-self-hosted.mjs`
- Modify: `src/context/AppContext.jsx`
- Modify: `.env.example`
- Test: `tests/migration.test.mjs`

**Interfaces:**
- Export/import preserve collection names, revision and record IDs.
- `VITE_API_ORIGIN` selects the self-hosted API; empty value keeps same-origin Vercel API.

- [ ] **Step 1: Write failing migration tests comparing collection counts and revision.**
- [ ] **Step 2: Run focused tests and verify failure before implementation.**
- [ ] **Step 3: Implement export/import with a dry-run diff and explicit confirmation flag for writes.**
- [ ] **Step 4: Import a copy into the self-hosted database and compare counts without altering Neon.**
- [ ] **Step 5: Commit `feat: add reversible self-hosted data migration`.**

### Task 7: HTTPS, domain routing, and end-to-end validation

**Files:**
- Create: `server/reverse-proxy.example.conf`
- Modify: `VERCEL.md`
- Modify: `DESPLIEGUE.md`
- Test: `tests/browser-check.mjs`

- [ ] **Step 1: Configure a subdomain such as `api.jcevnzl.space` and TLS without exposing PostgreSQL.**
- [ ] **Step 2: Point a preview deployment at the self-hosted API and run health, login, client, ticket and report flows.**
- [ ] **Step 3: Test an intentional API outage and switch back to Neon using the environment variable.**
- [ ] **Step 4: Run the complete test suite and browser verification.**
- [ ] **Step 5: Commit `docs: document self-hosted production cutover`.**

### Task 8: Production cutover and observation

- [ ] **Step 1: Take a final Neon export and record counts/revision.**
- [ ] **Step 2: Import and verify the same counts on the server.**
- [ ] **Step 3: Deploy Vercel with the self-hosted API origin.**
- [ ] **Step 4: Confirm login and one read/write/report flow from `jcevnzl.space`.**
- [ ] **Step 5: Observe logs and backups for 24 hours; keep Neon available for rollback.**
