# Isabella Service and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Isabella into a Windows background service with a client-aware portal dashboard, a guided credential/code enrollment flow, and an expressive blue particle-cloud interface.

**Architecture:** Keep Restic as the backup engine and PostgreSQL as the portal source of truth. Split the interactive UI from the background worker using a local authenticated IPC boundary; the worker owns scheduling, retries, journal and secrets, while the UI only displays state and requests validated changes. Use a .NET Worker Service for the installed Windows service and a WebView/React surface for Isabella after the SDK/runtime is available on the build host.

**Tech Stack:** .NET 8+ Windows Worker Service, WebView2/React, PostgreSQL, existing Node API, Restic repository format 2, PowerShell installer, Go compatibility bridge during migration.

**Spec:** `docs/superpowers/specs/2026-09-29-isabella-service-dashboard-design.md`

## Global Constraints

- Windows is the first supported installed platform; Linux requires a separate systemd deliverable and tests.
- The service starts at boot without an interactive user session; closing Isabella must not stop it.
- Every enrollment requires a valid portal user session, client authorization and a one-use code valid for ten minutes.
- Repositories and credentials remain isolated per device; responses never contain stored secrets after enrollment.
- Restic compression defaults to `auto`, `max` is optional, pack target is 16 MiB, and new repositories use format 2.
- Maximum two attempts per occurrence with a 15-minute retry delay; one occurrence cannot create a third attempt.
- Only independently verified snapshots count toward retention or success metrics.
- The particle cloud is decorative state output, supports reduced motion and never fakes progress.
- No production device is enabled until interruption, reboot-without-login and SHA-256 restore tests pass.

## Review Focus

- Service account cannot read an interactive user's DPAPI secret: test installation and reload under the real service identity.
- A client user cannot see or configure another client's device: test UI status, policy and dashboard queries.
- Closing/reopening the UI while a backup runs preserves journal state: test process separation and restart.
- A result arriving after a network cut is reconciled to the existing run: test queued/running/verifying transitions and duplicate events.
- UNC paths, Unicode folders, unavailable destinations and reduced-motion displays remain usable: add focused integration and UI checks.

## Task 1: Service boundary and persistent worker

**Files:** Create `agent-dotnet/Isabella.Service/`, `agent-dotnet/Isabella.Service.Tests/`; modify `agent/` only for compatibility and migration flags; create `agent/Install-Isabella.ps1`.

**Interfaces:** `IpcContract` exposes `GetStatus`, `GetPolicy`, `SavePolicy`, `Enroll`, `GetHistory`; `BackupWorker.RunAsync`; `IJournalStore` persists occurrence, attempt, event and snapshot state.

- [ ] Write failing tests for boot startup configuration, one worker per repository, graceful cancellation and journal recovery after process termination.
- [ ] Verify the required .NET SDK and WebView2 runtime on the build host; record an explicit prerequisite error if unavailable.
- [ ] Implement the Worker Service with Windows service lifetime, bounded channels, cancellation and structured log files with secret redaction.
- [ ] Implement named-pipe IPC with ACL restricted to the local administrators/service operator group and request validation.
- [ ] Implement SQLite journal schema and migration from the current Go journal without deleting old data.
- [ ] Register service recovery actions, delayed automatic start and uninstall behavior that preserves protected configuration and data.
- [ ] Run .NET unit/integration tests and a local boot/stop exercise; commit.

## Task 2: Portal contracts and client destinations

**Files:** Modify `lib/backup/schema.js`, `lib/backup/routes.js`, `lib/backup/policy.js`, `src/views/Backups.jsx`; create `lib/backup/destinations.js`, `tests/backup-destinations.test.mjs`.

**Interfaces:** `POST /api/backups/destinations`, `POST /api/backups/destinations/:id/validate`, `GET /api/backups/clients/:clientId/summary`; destination types `local`, `unc`, `https-receiver`, `sftp`, `s3-compatible`; policy revisions reference `destinationId`.

- [ ] Write failing tests for destination isolation, UNC validation, HTTPS origin validation, unavailable target errors, and no secret leakage.
- [ ] Add additive destination tables and policy destination reference; preserve existing policies with the current HTTPS receiver.
- [ ] Implement server-side validation for paths, endpoint schemes, retention, intervals and profiles.
- [ ] Add summary response with device state, active alerts, runs, verified snapshots, bytes processed/added and next occurrence.
- [ ] Add portal UI for destination, schedule and retention editing per selected client/device.
- [ ] Run Node tests and Vite build; commit.

## Task 3: Enrollment and operator workflow

**Files:** Modify `lib/backup/auth.js`, `lib/cloud-app.js`, `agent/internal/ui/`; create `tests/isabella-enrollment.test.mjs`.

**Interfaces:** `POST /api/auth/login` remains the credential authority; `POST /api/backups/enrollments` creates a ten-minute code; `POST /api/backup-agent/enroll` consumes it; `GET /api/backup-agent/status` returns only the authorized device summary.

- [ ] Add failing tests for incorrect password, expired/reused code, client mismatch, revoked token, concurrent consumption and UI session expiry.
- [ ] Connect Isabella login to the portal session and keep the password out of local configuration and journals.
- [ ] Complete policy save from Isabella through the authenticated API and display actionable errors.
- [ ] Add status view for service state, destination, latest/next run, alerts and verified snapshots.
- [ ] Run Go/Node tests and manually inspect the local flow with a fixture API; commit.

## Task 4: Expressive particle-cloud UI

**Files:** Create `agent-dotnet/Isabella.UI/`, `src/components/IsabellaCloud.jsx`, `src/css/isabella-cloud.css`, `tests/isabella-cloud.test.mjs`; modify `src/views/Backups.jsx`.

**Interfaces:** `<IsabellaCloud state="idle|guiding|running|success|warning|error" reducedMotion={boolean}/>` renders an accessible region with text state; `state` comes from actual service status.

- [ ] Write failing tests for all five state mappings, reduced-motion behavior, hidden-tab throttling and accessible text labels.
- [ ] Implement a capped Canvas/WebGL particle field with deterministic seed, blue electric palette, soft noise drift and no face/portrait.
- [ ] Add state-driven movement: breathing idle, guide waves, running flow, success pulse and warning/error contraction.
- [ ] Add fallback static gradient for unavailable WebGL and respect `prefers-reduced-motion`.
- [ ] Embed the component in portal and local UI with the same state contract; run build and visual smoke test; commit.

## Task 5: Scheduling, destinations and restore verification

**Files:** Modify `lib/backup/repository.js`, `agent/internal/service/service.go`; create `lib/backup/restore.js`, `lib/backup/retention.js`, `tests/backup-restore.test.mjs`, `tests/backup-scheduler-reconcile.test.mjs`.

**Interfaces:** `reconcileRun(runId, attempt, snapshotId)`, `verifySnapshot(repository, snapshotId)`, `restoreSnapshot(repository, snapshotId, destination)`, `applyRetention(deviceId, count)`.

- [ ] Write failing tests for offline scheduled runs, queued-to-running reconciliation, duplicate snapshot after cut, maximum two attempts, verified-only retention and SHA-256 restore.
- [ ] Implement stable occurrence keys, server reconciliation and lease renewal without creating a third attempt.
- [ ] Implement destination adapters beginning with local/UNC and HTTPS receiver; mark SFTP/S3 unavailable until their integration tests pass.
- [ ] Implement restore-to-new-directory and download jobs with traversal protection and expiry.
- [ ] Implement retention that preserves the newest verified snapshot after failure.
- [ ] Run tests with real Restic fixture repositories and record compressed/uncompressed byte counters; commit.

## Task 6: Installer and package acceptance

**Files:** Modify `agent/Install-Agent.ps1`, `agent/build.ps1`; create `scripts/package-isabella.mjs`, `docs/backups/INSTALL-ISABELLA.md`, `docs/backups/RESTORE-DRILL.md`, `tests/isabella-package.test.mjs`.

- [ ] Write failing package tests for missing runtime, checksum mismatch, no embedded credentials, repair/uninstall and service recovery settings.
- [ ] Build signed or checksum-manifested self-contained package containing the service, UI, Restic and installer.
- [ ] Install on a clean Windows machine, reboot without login and check portal heartbeat.
- [ ] Execute two real versions with additions/modifications/deletions, interrupt network and restore both versions by SHA-256.
- [ ] Run full Node/Go/.NET suites and Vite build; verify package contains no `.env`, tokens, vault keys or real data.
- [ ] Publish only after all acceptance criteria pass; commit package metadata and drill evidence.

## Execution order

Task 1 establishes the service boundary; Task 2 can proceed against the existing Go agent contracts. Task 3 depends on the current API and feeds both UIs. Task 4 is independent after the state contract is fixed. Task 5 depends on Tasks 1–3. Task 6 is the final gate and must not be skipped for a production rollout.
