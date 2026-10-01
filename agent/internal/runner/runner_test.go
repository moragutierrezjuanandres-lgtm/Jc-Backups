package runner

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	if len(os.Args) > 1 && os.Args[1] == "backup" {
		if os.Getenv("ISABELLA_TEST_FAILURE") == "yes" {
			fmt.Fprintln(os.Stderr, `{"message_type":"exit_error","code":1,"message":"Fatal: `+os.Getenv("RESTIC_PASSWORD")+`"}`)
			os.Exit(1)
		}
		fmt.Println(`{"message_type":"status","percent_done":0.2}`)
		time.Sleep(30 * time.Second)
		os.Exit(0)
	}
	if len(os.Args) > 1 && os.Args[1] == "unlock" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}
func TestCancellationTerminatesTheBackupProcess(t *testing.T) {
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	r := Runner{ResticPath: binary, Timeout: 3 * time.Second, OnProgress: func(Progress) { cancel() }}
	result := r.Backup(ctx, Run{}, Policy{SourceDirs: []string{t.TempDir()}})
	if result.ExitCode != -1 || result.Message != "context canceled" {
		t.Fatalf("process was not cancelled: %+v", result)
	}
}
func TestFatalJSONIncludesDiagnosticMessage(t *testing.T) {
	result := parseOutput([]byte(`{"message_type":"exit_error","code":1,"message":"Fatal: source is unavailable"}`), 1)
	if result.Message != "Fatal: source is unavailable" {
		t.Fatalf("missing diagnostic: %+v", result)
	}
}
func TestStderrDiagnosticsNeverExposeRepositoryPassword(t *testing.T) {
	t.Setenv("ISABELLA_TEST_FAILURE", "yes")
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	result := (Runner{ResticPath: binary, Repository: Repository{Key: "private-test-key"}}).Backup(context.Background(), Run{}, Policy{SourceDirs: []string{t.TempDir()}})
	if result.Message != "Fatal: [redacted]" {
		t.Fatalf("diagnostic leaked or disappeared: %+v", result)
	}
}

func TestParseSummaryRequiresSnapshot(t *testing.T) {
	r := parseOutput([]byte(`{"message_type":"summary","snapshot_id":"abc","total_bytes_processed":42,"data_added":12}`), 0)
	if r.ExitCode != 0 || r.SnapshotID != "abc" || r.ProcessedBytes != 42 {
		t.Fatalf("bad summary %+v", r)
	}
	r = parseOutput(nil, 0)
	if r.ErrorCode != "missing_snapshot" {
		t.Fatalf("false success %+v", r)
	}
}

func TestValidateSourcesRejectsRepositoryInsideSource(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "Espaço 文件")
	if err := os.Mkdir(source, 0700); err != nil {
		t.Fatal(err)
	}
	if err := ValidateSources([]string{source}, filepath.Join(source, "repository"), ""); err == nil {
		t.Fatal("allowed nested repository")
	}
}

func TestBackupDoesNotInvokeShell(t *testing.T) {
	// Arguments, including shell punctuation, must be passed literally to Restic.
	args := backupArgs(Policy{SourceDirs: []string{`C:\Data & More`}, Excludes: []string{"*.tmp"}})
	if len(args) < 7 || args[len(args)-1] != `C:\Data & More` {
		t.Fatalf("bad argv: %q", args)
	}
	_ = context.Background()
}

func TestCompressionAndVSSPreserveLiteralPaths(t *testing.T) {
	p := Policy{SourceDirs: []string{`C:\Data & More`}, Excludes: []string{"*.tmp"}, Compression: "max", ConsistencyProfile: "files-vss"}
	want := []string{"backup", "--json", "--compression", "max", "--pack-size", "16", "--use-fs-snapshot", "--exclude", "*.tmp", `C:\Data & More`}
	if got := backupArgs(p); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %q want %q", got, want)
	}
	args := backupArgs(Policy{SourceDirs: []string{`C:\Data`}})
	if args[3] != "auto" {
		t.Fatalf("compression default: %q", args)
	}
}

func TestBackupRejectsDisabledCompressionBeforeExecuting(t *testing.T) {
	result := (Runner{ResticPath: "does-not-exist"}).Backup(context.Background(), Run{}, Policy{SourceDirs: []string{t.TempDir()}, Compression: "off"})
	if result.ErrorCode != "invalid_compression" {
		t.Fatalf("got %+v", result)
	}
}
