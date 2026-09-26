package journal

import (
 "path/filepath"
 "testing"
)

func TestAttemptAndResultSurviveRestart(t *testing.T) {
 path := filepath.Join(t.TempDir(), "journal.json")
 j, err := Open(path); if err != nil { t.Fatal(err) }
 if err := j.StartAttempt("run-1", 1); err != nil { t.Fatal(err) }
 j, err = Open(path); if err != nil { t.Fatal(err) }
 if err := j.StartAttempt("run-1", 1); err == nil { t.Fatal("replayed a started attempt") }
 if err := j.StoreResult("run-1", 1, Result{ExitCode: 3, ErrorCode: "partial"}); err != nil { t.Fatal(err) }
 j, err = Open(path); if err != nil { t.Fatal(err) }
 state := j.State("run-1")
 if state.Attempt != 1 || state.Result == nil || state.Result.ExitCode != 3 { t.Fatalf("lost durable state: %+v", state) }
 if err := j.StartAttempt("run-1", 3); err == nil { t.Fatal("accepted third attempt") }
}
