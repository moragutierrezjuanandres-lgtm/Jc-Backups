package runner

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"jcevnzl/backup-agent/internal/journal"
)

type Policy struct {
	Enabled                  bool     `json:"enabled"`
	ID                       string   `json:"id"`
	DeviceID                 string   `json:"deviceId"`
	Revision                 int      `json:"revision"`
	SourceDirs               []string `json:"sourceDirs"`
	Excludes                 []string `json:"excludes"`
	Days                     []int    `json:"days"`
	Time                     string   `json:"time"`
	Timezone                 string   `json:"timezone"`
	RetentionSuccessfulCount int      `json:"retentionSuccessfulCount"`
	ConsistencyProfile       string   `json:"consistencyProfile"`
	Compression              string   `json:"compression"`
}
type Run struct {
	ID             string    `json:"id"`
	DeviceID       string    `json:"deviceId"`
	PolicyRevision int       `json:"policyRevision"`
	OccurrenceKey  string    `json:"occurrenceKey"`
	Status         string    `json:"status"`
	Attempt        int       `json:"attempt"`
	LeaseUntil     time.Time `json:"leaseUntil"`
}
type Repository struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
	Key      string `json:"key"`
}
type Progress struct {
	MessageType  string   `json:"message_type"`
	PercentDone  float64  `json:"percent_done"`
	BytesDone    int64    `json:"bytes_done"`
	TotalBytes   int64    `json:"total_bytes"`
	FilesDone    int64    `json:"files_done"`
	TotalFiles   int64    `json:"total_files"`
	CurrentFiles []string `json:"current_files"`
}
type Runner struct {
	ResticPath string
	Repository Repository
	CacheDir   string
	Timeout    time.Duration
	OnProgress func(Progress)
}

func (r Runner) Backup(ctx context.Context, run Run, policy Policy) journal.Result {
	if err := ValidateSources(policy.SourceDirs, "", r.CacheDir); err != nil {
		return journal.Result{ExitCode: -1, ErrorCode: "invalid_source", Message: err.Error()}
	}
	if policy.ConsistencyProfile != "" && policy.ConsistencyProfile != "files" && policy.ConsistencyProfile != "files-vss" {
		return journal.Result{ExitCode: -1, ErrorCode: "profile_unavailable", Message: "database profile is not configured and verified"}
	}
	timeout := r.Timeout
	if timeout <= 0 {
		timeout = 12 * time.Hour
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	if policy.Compression != "" && policy.Compression != "auto" && policy.Compression != "max" {
		return journal.Result{ExitCode: -1, ErrorCode: "invalid_compression", Message: "compression must be auto or max"}
	}
	args := backupArgs(policy)
	args = append(args, "--tag", "isabella-run:"+run.ID, "--tag", fmt.Sprintf("isabella-attempt:%d", run.Attempt))
	cmd := exec.CommandContext(ctx, r.ResticPath, args...)
	configurePriority(cmd)
	repositoryURL := r.Repository.URL
	if strings.HasPrefix(repositoryURL, "https://") {
		repositoryURL = "rest:" + repositoryURL
	}
	cmd.Env = append(os.Environ(), "RESTIC_REPOSITORY="+repositoryURL, "RESTIC_PASSWORD="+r.Repository.Key, "RESTIC_REST_USERNAME="+r.Repository.Username, "RESTIC_REST_PASSWORD="+r.Repository.Password)
	if r.CacheDir != "" {
		cmd.Env = append(cmd.Env, "RESTIC_CACHE_DIR="+r.CacheDir)
	}
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return journal.Result{ExitCode: -1, ErrorCode: "restic_failed"}
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err = cmd.Start(); err != nil {
		return journal.Result{ExitCode: -1, ErrorCode: "restic_failed"}
	}
	var output bytes.Buffer
	stream := bufio.NewScanner(pipe)
	stream.Buffer(make([]byte, 4096), 1024*1024)
	for stream.Scan() {
		var progress Progress
		if json.Unmarshal(stream.Bytes(), &progress) == nil && progress.MessageType == "status" {
			if r.OnProgress != nil {
				r.OnProgress(progress)
			}
			continue
		}
		if output.Len() < 1024*1024 {
			output.Write(stream.Bytes())
			output.WriteByte('\n')
		}
	}
	err = cmd.Wait()
	if stream.Err() != nil && err == nil {
		err = stream.Err()
	}
	code := 0
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			code = exit.ExitCode()
		} else {
			code = -1
		}
	}
	result := parseOutput(output.Bytes(), code)
	if ctx.Err() != nil {
		result.ErrorCode = "timeout_or_cancelled"
		result.Message = ctx.Err().Error()
		result.ExitCode = -1
	}
	return result
}

func backupArgs(policy Policy) []string {
	compression := policy.Compression
	if compression == "" {
		compression = "auto"
	}
	args := []string{"backup", "--json", "--compression", compression, "--pack-size", "16"}
	if policy.ConsistencyProfile == "files-vss" {
		args = append(args, "--use-fs-snapshot")
	}
	for _, x := range policy.Excludes {
		args = append(args, "--exclude", x)
	}
	return append(args, policy.SourceDirs...)
}
func parseOutput(output []byte, code int) journal.Result {
	result := journal.Result{ExitCode: code}
	scanner := bufio.NewScanner(bytes.NewReader(output))
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	for scanner.Scan() {
		var msg struct {
			MessageType         string `json:"message_type"`
			SnapshotID          string `json:"snapshot_id"`
			TotalBytesProcessed int64  `json:"total_bytes_processed"`
			DataAdded           int64  `json:"data_added"`
			Error               string `json:"error"`
		}
		if json.Unmarshal(scanner.Bytes(), &msg) != nil {
			continue
		}
		if msg.MessageType == "summary" {
			result.SnapshotID = msg.SnapshotID
			result.ProcessedBytes = msg.TotalBytesProcessed
			result.AddedBytes = msg.DataAdded
		}
		if msg.MessageType == "error" && result.Message == "" {
			result.Message = msg.Error
		}
	}
	if code == 0 && result.SnapshotID == "" {
		result.ErrorCode = "missing_snapshot"
		result.ExitCode = -1
	}
	if code == 3 {
		result.ErrorCode = "partial"
	}
	if code != 0 && code != 3 && result.ErrorCode == "" {
		result.ErrorCode = "restic_failed"
	}
	if len(result.Message) > 500 {
		result.Message = result.Message[:500]
	}
	return result
}
func ValidateSources(sources []string, repositoryPath, cachePath string) error {
	if len(sources) == 0 {
		return errors.New("no source directories configured")
	}
	targets := []string{repositoryPath, cachePath}
	for _, source := range sources {
		if !filepath.IsAbs(source) {
			return fmt.Errorf("source must be absolute: %q", source)
		}
		info, err := os.Stat(source)
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return fmt.Errorf("source is not a directory: %q", source)
		}
		root, err := filepath.EvalSymlinks(source)
		if err != nil {
			return err
		}
		for _, target := range targets {
			if target == "" {
				continue
			}
			abs, err := filepath.Abs(target)
			if err != nil {
				return err
			}
			if resolved, err := filepath.EvalSymlinks(abs); err == nil {
				abs = resolved
			}
			rel, err := filepath.Rel(root, abs)
			if err == nil && (rel == "." || (!strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != "..")) {
				return fmt.Errorf("agent storage is inside source %q", source)
			}
		}
	}
	return nil
}
