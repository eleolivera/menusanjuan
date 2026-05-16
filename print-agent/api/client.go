// Package api wraps the four HTTP calls the agent makes to MenuSanJuan:
// pair, poll, ack, heartbeat. All requests use a 30s timeout except poll,
// which uses 30s to allow the server's 20s long-poll wait + 10s slack.
package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	defaultTimeout = 30 * time.Second
	pollTimeout    = 30 * time.Second
)

type Client struct {
	BaseURL string
	APIKey  string // empty before pairing
	Version string
	HostInfo string
	http   *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		http:    &http.Client{Timeout: defaultTimeout},
	}
}

// PairResponse is returned by POST /api/print-agent/pair.
type PairResponse struct {
	AgentID    string `json:"agentId"`
	AgentName  string `json:"agentName"`
	APIKey     string `json:"apiKey"`
	DealerName string `json:"dealerName"`
	DealerSlug string `json:"dealerSlug"`
}

// Pair exchanges a 6-char pairing code for a long-term API key.
func (c *Client) Pair(ctx context.Context, code string) (*PairResponse, error) {
	body, _ := json.Marshal(map[string]string{
		"code":     code,
		"hostInfo": c.HostInfo,
		"version":  c.Version,
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/print-agent/pair", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, errorFromBody(resp)
	}
	out := &PairResponse{}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return nil, err
	}
	return out, nil
}

// Job is what the agent receives from /poll. PayloadBase64 is base64-encoded
// raw ESC/POS bytes ready to write directly to the printer.
type Job struct {
	JobID         string `json:"jobId"`
	Kind          string `json:"kind"` // ORDER | TEST
	OrderID       string `json:"orderId"`
	PayloadBase64 string `json:"payloadBase64"`
}

// Poll long-polls for the next print job. Returns (nil, nil) on 204 (no
// work available — caller should immediately poll again).
func (c *Client) Poll(ctx context.Context) (*Job, error) {
	cli := &http.Client{Timeout: pollTimeout}
	req, _ := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/api/print-agent/poll", nil)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	resp, err := cli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 204 {
		return nil, nil
	}
	if resp.StatusCode != 200 {
		return nil, errorFromBody(resp)
	}
	job := &Job{}
	if err := json.NewDecoder(resp.Body).Decode(job); err != nil {
		return nil, err
	}
	return job, nil
}

// Payload decodes the base64 ESC/POS bytes from a Job.
func (j *Job) Payload() ([]byte, error) {
	return base64.StdEncoding.DecodeString(j.PayloadBase64)
}

// Ack tells the server we either printed the job (DELIVERED) or hit an error (FAILED).
func (c *Client) Ack(ctx context.Context, jobID, status, errMsg string) error {
	body, _ := json.Marshal(map[string]string{
		"jobId":  jobID,
		"status": status,
		"error":  errMsg,
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/print-agent/ack", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return errorFromBody(resp)
	}
	return nil
}

// Heartbeat refreshes our lastSeenAt + reports our current version/hostInfo.
func (c *Client) Heartbeat(ctx context.Context) error {
	body, _ := json.Marshal(map[string]string{
		"version":  c.Version,
		"hostInfo": c.HostInfo,
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/print-agent/heartbeat", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return errorFromBody(resp)
	}
	return nil
}

// errorFromBody turns an HTTP error response into a Go error with the
// server-side error message if present.
func errorFromBody(resp *http.Response) error {
	b, _ := io.ReadAll(resp.Body)
	var d struct{ Error string }
	if err := json.Unmarshal(b, &d); err == nil && d.Error != "" {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, d.Error)
	}
	if len(b) > 0 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}
	return errors.New(resp.Status)
}
