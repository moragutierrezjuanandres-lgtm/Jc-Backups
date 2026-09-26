package runner

import (
 "context"
 "os"
 "path/filepath"
 "testing"
)

func TestParseSummaryRequiresSnapshot(t *testing.T) {
 r := parseOutput([]byte(`{"message_type":"summary","snapshot_id":"abc","total_bytes_processed":42,"data_added":12}`), 0)
 if r.ExitCode != 0 || r.SnapshotID != "abc" || r.ProcessedBytes != 42 { t.Fatalf("bad summary %+v", r) }
 r = parseOutput(nil, 0)
 if r.ErrorCode != "missing_snapshot" { t.Fatalf("false success %+v", r) }
}

func TestValidateSourcesRejectsRepositoryInsideSource(t *testing.T) {
 dir := t.TempDir(); source := filepath.Join(dir, "Espaço 文件")
 if err := os.Mkdir(source, 0700); err != nil { t.Fatal(err) }
 if err := ValidateSources([]string{source}, filepath.Join(source,"repository"), ""); err == nil { t.Fatal("allowed nested repository") }
}

func TestBackupDoesNotInvokeShell(t *testing.T) {
 // Arguments, including shell punctuation, must be passed literally to Restic.
 args := backupArgs([]string{`C:\Data & More`}, []string{"*.tmp"})
 if len(args) < 5 || args[len(args)-1] != `C:\Data & More` { t.Fatalf("bad argv: %q", args) }
 _ = context.Background()
}
