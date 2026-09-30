package journal

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Result struct {
	ExitCode       int    `json:"exitCode"`
	SnapshotID     string `json:"snapshotId,omitempty"`
	ProcessedBytes int64  `json:"processedBytes"`
	AddedBytes     int64  `json:"addedBytes"`
	ErrorCode      string `json:"errorCode,omitempty"`
	Message        string `json:"message,omitempty"`
}
type Event struct {
	RunID    string `json:"runId"`
	Attempt  int    `json:"attempt"`
	Sequence int    `json:"sequence"`
	Kind     string `json:"kind"`
	Payload  Result `json:"payload"`
}
type RunState struct {
	Attempt    int       `json:"attempt"`
	StartedAt  time.Time `json:"startedAt"`
	FinishedAt time.Time `json:"finishedAt"`
	Result     *Result   `json:"result,omitempty"`
	EventSent  bool      `json:"eventSent"`
}
type disk struct {
	Runs   map[string]RunState `json:"runs"`
	Events []Event             `json:"events"`
}
type Journal struct {
	mu    sync.Mutex
	path  string
	state disk
}

func Open(path string) (*Journal, error) {
	j := &Journal{path: path, state: disk{Runs: map[string]RunState{}}}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return j, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(b, &j.state); err != nil {
		return nil, fmt.Errorf("invalid journal: %w", err)
	}
	if j.state.Runs == nil {
		j.state.Runs = map[string]RunState{}
	}
	return j, nil
}
func (j *Journal) State(id string) RunState {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.state.Runs[id]
}
func (j *Journal) Pending() []Event {
	j.mu.Lock()
	defer j.mu.Unlock()
	return append([]Event(nil), j.state.Events...)
}
func (j *Journal) RecoverInterrupted() error {
	j.mu.Lock()
	pending := map[string]int{}
	for id, state := range j.state.Runs {
		if state.Attempt > 0 && state.Result == nil {
			pending[id] = state.Attempt
		}
	}
	j.mu.Unlock()
	for id, attempt := range pending {
		if err := j.StoreResult(id, attempt, Result{ExitCode: -1, ErrorCode: "interrupted", Message: "El servicio se reinició antes de terminar la copia."}); err != nil {
			return err
		}
	}
	return nil
}
func (j *Journal) StartAttempt(id string, attempt int) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if id == "" || attempt < 1 || attempt > 2 {
		return errors.New("invalid attempt")
	}
	old := j.state.Runs[id]
	if attempt <= old.Attempt || (old.Attempt > 0 && attempt != old.Attempt+1) || (old.Attempt > 0 && old.Result == nil) {
		return errors.New("attempt already started or previous result missing")
	}
	j.state.Runs[id] = RunState{Attempt: attempt, StartedAt: time.Now().UTC()}
	return j.save()
}
func (j *Journal) StoreResult(id string, attempt int, result Result) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	old, ok := j.state.Runs[id]
	if !ok || old.Attempt != attempt {
		return errors.New("attempt not started")
	}
	if old.Result != nil {
		return errors.New("result already stored")
	}
	old.Result = &result
	old.FinishedAt = time.Now().UTC()
	j.state.Runs[id] = old
	j.state.Events = append(j.state.Events, Event{RunID: id, Attempt: attempt, Sequence: 2, Kind: "result", Payload: result})
	return j.save()
}
func (j *Journal) Ack(id string, attempt, sequence int) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	for i, e := range j.state.Events {
		if e.RunID == id && e.Attempt == attempt && e.Sequence == sequence {
			j.state.Events = append(j.state.Events[:i], j.state.Events[i+1:]...)
			return j.save()
		}
	}
	return nil
}
func (j *Journal) QueueStart(id string, attempt int) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.state.Events = append(j.state.Events, Event{RunID: id, Attempt: attempt, Sequence: 1, Kind: "start"})
	return j.save()
}
func (j *Journal) save() error {
	if err := os.MkdirAll(filepath.Dir(j.path), 0700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(j.state, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(j.path), ".journal-*")
	if err != nil {
		return err
	}
	temp := f.Name()
	defer os.Remove(temp)
	if err := f.Chmod(0600); err != nil {
		f.Close()
		return err
	}
	if _, err = f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(temp, j.path)
}
