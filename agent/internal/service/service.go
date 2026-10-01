package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	_ "time/tzdata"

	"jcevnzl/backup-agent/internal/control"
	"jcevnzl/backup-agent/internal/journal"
	"jcevnzl/backup-agent/internal/runner"
	"jcevnzl/backup-agent/internal/secrets"
)

type Config struct {
	PortalURL   string            `json:"portalUrl"`
	DeviceID    string            `json:"deviceId"`
	ClientID    string            `json:"clientId"`
	DeviceLabel string            `json:"deviceLabel"`
	Token       string            `json:"token"`
	Repository  runner.Repository `json:"repository"`
	Policy      *runner.Policy    `json:"policy"`
}

func LoadConfig(path string) (Config, error) {
	var c Config
	b, err := secrets.Load(path)
	if err != nil {
		return c, err
	}
	err = json.Unmarshal(b, &c)
	return c, err
}
func SaveConfig(path string, c Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	b, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return secrets.Save(path, b)
}

type Service struct {
	ConfigPath  string
	JournalPath string
	ResticPath  string
	CacheDir    string
}

func (s Service) Run(ctx context.Context) error {
	if j, err := journal.Open(s.JournalPath); err == nil {
		if err = j.RecoverInterrupted(); err != nil {
			return err
		}
	} else {
		return err
	}
	tick := time.NewTicker(30 * time.Second)
	defer tick.Stop()
	for {
		s.step(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-tick.C:
		}
	}
}
func (s Service) step(ctx context.Context) {
	cfg, err := LoadConfig(s.ConfigPath)
	if err != nil {
		return
	}
	j, err := journal.Open(s.JournalPath)
	if err != nil {
		return
	}
	api := control.Client{BaseURL: cfg.PortalURL, Token: cfg.Token}
	// Persisted results are transmitted before seeking any new work.
	for _, event := range j.Pending() {
		send := event
		if strings.HasPrefix(send.RunID, "scheduled:") {
			run, err := api.Occurrence(ctx, send.RunID, cfg.Policy.Revision)
			if err != nil {
				return
			}
			send.RunID = run.ID
		}
		if err := api.Event(ctx, send); err != nil {
			return
		}
		if err := j.Ack(event.RunID, event.Attempt, event.Sequence); err != nil {
			return
		}
	}
	if err := api.Heartbeat(ctx); err != nil {
		s.runOfflineDue(ctx, cfg, j)
		return
	}
	policy, err := api.Policy(ctx)
	if err == nil && policy != nil && (cfg.Policy == nil || cfg.Policy.Revision != policy.Revision) {
		cfg.Policy = policy
		_ = SaveConfig(s.ConfigPath, cfg)
	}
	if cfg.Policy == nil {
		return
	}
	if cfg.Policy.Enabled {
		s.runOfflineDue(ctx, cfg, j)
	}
	run, err := api.Claim(ctx)
	if err != nil || run == nil {
		return
	}
	key := run.ID
	if strings.HasPrefix(run.OccurrenceKey, "scheduled:") {
		key = run.OccurrenceKey
		if j.State(key).Attempt >= run.Attempt {
			return
		}
	}
	s.execute(ctx, cfg, j, key, run.Attempt)
}
func (s Service) runOfflineDue(ctx context.Context, cfg Config, j *journal.Journal) {
	if cfg.Policy == nil || !cfg.Policy.Enabled {
		return
	}
	key, due := latestOccurrence(*cfg.Policy, time.Now())
	if !due {
		return
	}
	state := j.State(key)
	if state.Attempt == 0 {
		s.execute(ctx, cfg, j, key, 1)
		return
	}
	if state.Attempt == 1 && state.Result != nil && state.Result.ErrorCode != "cancelled" && state.Result.ExitCode != 0 && time.Since(state.FinishedAt) >= 15*time.Minute {
		s.execute(ctx, cfg, j, key, 2)
	}
}
func (s Service) execute(ctx context.Context, cfg Config, j *journal.Journal, id string, attempt int) {
	if err := j.StartAttempt(id, attempt); err != nil {
		return
	}
	if err := j.QueueStart(id, attempt); err != nil {
		return
	}
	r := runner.Run{ID: id, DeviceID: cfg.DeviceID, PolicyRevision: cfg.Policy.Revision, Attempt: attempt}
	engine := runner.Runner{ResticPath: s.ResticPath, Repository: cfg.Repository, CacheDir: s.CacheDir}
	api := control.Client{BaseURL: cfg.PortalURL, Token: cfg.Token}
	backupCtx, cancelBackup := context.WithCancel(ctx)
	defer cancelBackup()
	cancelled := false
	for _, event := range j.Pending() {
		if event.RunID != id || event.Attempt != attempt || event.Kind != "start" {
			continue
		}
		send := event
		if strings.HasPrefix(id, "scheduled:") {
			occurrence, err := api.Occurrence(ctx, id, cfg.Policy.Revision)
			if err != nil {
				break
			}
			send.RunID = occurrence.ID
		}
		if api.Event(ctx, send) == nil {
			_ = j.Ack(event.RunID, event.Attempt, event.Sequence)
		}
	}
	pending := make(chan runner.Progress, 1)
	uploadCtx, cancelUpload := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		controlTicker := time.NewTicker(5 * time.Second)
		defer controlTicker.Stop()
		for {
			select {
			case <-uploadCtx.Done():
				return
			case <-controlTicker.C:
				if checkCancellation(uploadCtx, api, id, cancelBackup) {
					cancelled = true
					return
				}
			case <-ticker.C:
				heartbeatCtx, stop := context.WithTimeout(uploadCtx, 3*time.Second)
				_ = api.Heartbeat(heartbeatCtx)
				stop()
			case progress := <-pending:
				sendCtx, stop := context.WithTimeout(uploadCtx, 3*time.Second)
				_ = api.Telemetry(sendCtx, id, attempt, progress)
				stop()
			}
		}
	}()
	lastSend := time.Time{}
	engine.OnProgress = func(p runner.Progress) {
		if time.Since(lastSend) < 5*time.Second {
			return
		}
		lastSend = time.Now()
		select {
		case pending <- p:
		default:
		}
	}
	result := engine.Backup(backupCtx, r, *cfg.Policy)
	cancelUpload()
	<-done
	if cancelled {
		result.ErrorCode = "cancelled"
		result.Message = "Detenido desde el portal"
		result.ExitCode = -1
	}
	_ = j.StoreResult(id, attempt, result)
}
func latestOccurrence(p runner.Policy, now time.Time) (string, bool) {
	loc, err := time.LoadLocation(p.Timezone)
	if err != nil {
		return "", false
	}
	local := now.In(loc)
	parts := strings.Split(p.Time, ":")
	if len(parts) != 2 {
		return "", false
	}
	var hour, minute int
	if _, err = fmt.Sscanf(p.Time, "%d:%d", &hour, &minute); err != nil {
		return "", false
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return "", false
	}
	day := local
	candidate := time.Date(day.Year(), day.Month(), day.Day(), hour, minute, 0, 0, loc)
	if candidate.After(now) {
		day = day.AddDate(0, 0, -1)
		candidate = time.Date(day.Year(), day.Month(), day.Day(), hour, minute, 0, 0, loc)
	}
	allowed := false
	for _, d := range p.Days {
		if d == int(day.Weekday()) {
			allowed = true
		}
	}
	if !allowed || now.Sub(candidate) > 24*time.Hour {
		return "", false
	}
	return fmt.Sprintf("scheduled:%d:%s:%s", p.Revision, day.Format("2006-01-02"), p.Time), true
}

var ErrNotConfigured = errors.New("device is not enrolled")

func checkCancellation(ctx context.Context, api control.Client, id string, cancel context.CancelFunc) bool {
	checkCtx, stop := context.WithTimeout(ctx, 3*time.Second)
	defer stop()
	requested, err := api.CancelRequested(checkCtx, id)
	if err != nil || !requested {
		return false
	}
	cancel()
	return true
}
