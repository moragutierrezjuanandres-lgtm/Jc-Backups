export const backupSchema = `
CREATE TABLE IF NOT EXISTS backup_devices (
 id uuid PRIMARY KEY, client_id text NOT NULL, label text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 token_hash text UNIQUE, repository_id text UNIQUE, repository_secret text,
 last_seen_at timestamptz, policy_revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS backup_devices_client ON backup_devices(client_id);
CREATE TABLE IF NOT EXISTS backup_enrollments (
 id uuid PRIMARY KEY, client_id text NOT NULL, code_hash text NOT NULL UNIQUE,
 created_by text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS backup_policies (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES backup_devices(id),
 revision integer NOT NULL CHECK(revision>0), source_dirs jsonb NOT NULL,
 excludes jsonb NOT NULL, days jsonb NOT NULL, time text NOT NULL,
 timezone text NOT NULL, retention_successful_count integer NOT NULL DEFAULT 7 CHECK(retention_successful_count BETWEEN 1 AND 365),
 consistency_profile text NOT NULL DEFAULT 'files', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(device_id,revision)
);
CREATE TABLE IF NOT EXISTS backup_runs (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES backup_devices(id),
 policy_revision integer NOT NULL, occurrence_key text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry_wait','succeeded','failed','overdue')),
 attempts_started integer NOT NULL DEFAULT 0 CHECK(attempts_started BETWEEN 0 AND 2),
 retry_at timestamptz, snapshot_id text, lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz,
 UNIQUE(device_id,occurrence_key)
);
CREATE INDEX IF NOT EXISTS backup_runs_pending ON backup_runs(device_id,status,retry_at,created_at);
CREATE TABLE IF NOT EXISTS backup_run_events (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES backup_runs(id),
 attempt integer NOT NULL CHECK(attempt IN (1,2)), sequence integer NOT NULL CHECK(sequence>=0),
 kind text NOT NULL CHECK(kind IN ('start','progress','result')),
 payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,attempt,sequence)
);
CREATE TABLE IF NOT EXISTS backup_snapshots (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES backup_devices(id),
 run_id uuid NOT NULL UNIQUE REFERENCES backup_runs(id), snapshot_id text NOT NULL,
 verified_at timestamptz NOT NULL, processed_bytes bigint NOT NULL DEFAULT 0,
 added_bytes bigint NOT NULL DEFAULT 0, retained boolean NOT NULL DEFAULT true,
 UNIQUE(device_id,snapshot_id)
);
CREATE TABLE IF NOT EXISTS backup_alerts (
 id uuid PRIMARY KEY, client_id text NOT NULL, device_id uuid NOT NULL REFERENCES backup_devices(id),
 run_id uuid REFERENCES backup_runs(id), kind text NOT NULL,
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz, UNIQUE(device_id,run_id,kind)
);
CREATE INDEX IF NOT EXISTS backup_alerts_client ON backup_alerts(client_id,resolved_at,created_at);
CREATE TABLE IF NOT EXISTS backup_restore_jobs (
 id uuid PRIMARY KEY, client_id text NOT NULL, device_id uuid NOT NULL REFERENCES backup_devices(id),
 snapshot_id text NOT NULL, paths jsonb NOT NULL, destination text NOT NULL CHECK(destination IN ('new-directory','download')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')),
 destination_path text, download_token_hash text, requested_by text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 error_code text
);
CREATE INDEX IF NOT EXISTS backup_restore_pending ON backup_restore_jobs(status,created_at);
ALTER TABLE backup_policies ADD COLUMN IF NOT EXISTS compression text NOT NULL DEFAULT 'auto' CHECK(compression IN ('auto','max'));
ALTER TABLE backup_policies ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
ALTER TABLE backup_runs DROP CONSTRAINT IF EXISTS backup_runs_status_check;
ALTER TABLE backup_runs ADD CONSTRAINT backup_runs_status_check CHECK(status IN ('queued','running','retry_wait','succeeded','failed','overdue','verifying','cancelled'));
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE backup_devices ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE backup_devices ADD COLUMN IF NOT EXISTS supports_cancel boolean NOT NULL DEFAULT false;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS progress jsonb;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_retry_at timestamptz;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_lease_until timestamptz;
ALTER TABLE backup_restore_jobs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE backup_devices ADD COLUMN IF NOT EXISTS server_directory text;
ALTER TABLE backup_devices ADD COLUMN IF NOT EXISTS storage_moving boolean NOT NULL DEFAULT false;
`;

export async function initializeBackupSchema(pool){ await pool.query(backupSchema); }
