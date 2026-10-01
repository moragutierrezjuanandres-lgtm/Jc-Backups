package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"jcevnzl/backup-agent/internal/journal"
	"jcevnzl/backup-agent/internal/runner"
)

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}
type Enrollment struct {
	DeviceID   string            `json:"deviceId"`
	ClientID   string            `json:"clientId"`
	Token      string            `json:"token"`
	Repository runner.Repository `json:"repository"`
}
type LoginResult struct {
	Clients []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"clients"`
}

func (c Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 30 * time.Second}
}
func (c Client) request(ctx context.Context, method, path string, body any, out any) error {
	base, err := url.Parse(c.BaseURL)
	if err != nil {
		return err
	}
	if base.Scheme != "https" && !(base.Scheme == "http" && (base.Hostname() == "127.0.0.1" || base.Hostname() == "localhost")) {
		return errors.New("control API requires HTTPS")
	}
	dest, err := base.Parse(path)
	if err != nil {
		return err
	}
	if dest.Host != base.Host {
		return errors.New("cross-host API request blocked")
	}
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, dest.String(), reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.Copy(io.Discard, io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("API status %d", resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(out)
	}
	return nil
}
func (c Client) Heartbeat(ctx context.Context) error {
	return c.request(ctx, "POST", "/api/backup-agent/heartbeat", map[string]any{"supportsCancel": true}, nil)
}
func (c Client) CancelRequested(ctx context.Context, id string) (bool, error) {
	var response struct {
		CancelRequested bool `json:"cancelRequested"`
	}
	err := c.request(ctx, "GET", "/api/backup-agent/run-control?runId="+url.QueryEscape(id), nil, &response)
	return response.CancelRequested, err
}
func (c Client) Telemetry(ctx context.Context, id string, attempt int, p runner.Progress) error {
	file := ""
	if len(p.CurrentFiles) > 0 {
		file = p.CurrentFiles[0]
	}
	return c.request(ctx, "POST", "/api/backup-agent/telemetry", map[string]any{"runId": id, "attempt": attempt, "progress": p.PercentDone * 100, "processedBytes": p.BytesDone, "totalBytes": p.TotalBytes, "filesDone": p.FilesDone, "totalFiles": p.TotalFiles, "currentFile": file}, nil)
}
func (c Client) Policy(ctx context.Context) (*runner.Policy, error) {
	var response struct {
		Policy *runner.Policy `json:"policy"`
	}
	err := c.request(ctx, "GET", "/api/backup-agent/policy", nil, &response)
	return response.Policy, err
}
func (c Client) Claim(ctx context.Context) (*runner.Run, error) {
	var response struct {
		Run *runner.Run `json:"run"`
	}
	err := c.request(ctx, "POST", "/api/backup-agent/claim", map[string]any{}, &response)
	return response.Run, err
}
func (c Client) Event(ctx context.Context, e journal.Event) error {
	return c.request(ctx, "POST", "/api/backup-agent/events", e, nil)
}
func (c Client) Occurrence(ctx context.Context, key string, revision int) (*runner.Run, error) {
	var response struct {
		Run *runner.Run `json:"run"`
	}
	err := c.request(ctx, "POST", "/api/backup-agent/occurrences", map[string]any{"occurrenceKey": key, "policyRevision": revision}, &response)
	return response.Run, err
}
func ValidateBaseURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return err
	}
	if u.Scheme != "https" || u.Host == "" || u.User != nil {
		return errors.New("portal address must be an HTTPS URL without embedded credentials")
	}
	return nil
}
