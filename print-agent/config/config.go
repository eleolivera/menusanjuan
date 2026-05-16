// Package config reads + writes the agent's persistent settings to a JSON
// file under %APPDATA%\MenuSanJuan\config.json on Windows (or ~/.menusanjuan/
// on Mac for dev). Settings are:
//
//	{
//	  "baseUrl":     "https://menusanjuan.com",
//	  "apiKey":      "abc123...",     // long-term Bearer key
//	  "agentName":   "PC Cocina",
//	  "dealerName":  "Puerto Pachatas Albardon",
//	  "dealerSlug":  "puerto-pachatas",
//	  "printerName": ""               // "" = default Windows printer
//	}
//
// apiKey is empty until pairing succeeds.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
)

type Config struct {
	BaseURL     string `json:"baseUrl"`
	APIKey      string `json:"apiKey"`
	AgentID     string `json:"agentId"`
	AgentName   string `json:"agentName"`
	DealerName  string `json:"dealerName"`
	DealerSlug  string `json:"dealerSlug"`
	PrinterName string `json:"printerName"`
}

const defaultBaseURL = "https://menusanjuan.com"

var (
	mu   sync.Mutex
	path string
	dir  string
)

// AppDataDir returns the per-user app data directory (creating it if needed).
// Windows: %APPDATA%\MenuSanJuan
// Mac/Linux dev: ~/.menusanjuan
func AppDataDir() (string, error) {
	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", errors.New("APPDATA env var not set")
		}
		return filepath.Join(appData, "MenuSanJuan"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".menusanjuan"), nil
}

// Load reads config.json (creating with defaults if missing).
func Load() (*Config, error) {
	mu.Lock()
	defer mu.Unlock()

	d, err := AppDataDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(d, 0o755); err != nil {
		return nil, fmt.Errorf("mkdir %s: %w", d, err)
	}
	dir = d
	path = filepath.Join(d, "config.json")

	cfg := &Config{BaseURL: defaultBaseURL}
	b, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("read config: %w", err)
		}
		// Brand new install — write defaults and return
		if err := saveLocked(cfg); err != nil {
			return nil, err
		}
		return cfg, nil
	}
	if err := json.Unmarshal(b, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	return cfg, nil
}

// Save atomically rewrites config.json.
func Save(cfg *Config) error {
	mu.Lock()
	defer mu.Unlock()
	return saveLocked(cfg)
}

func saveLocked(cfg *Config) error {
	if path == "" {
		// Load() wasn't called yet — derive from AppDataDir
		d, err := AppDataDir()
		if err != nil {
			return err
		}
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
		dir, path = d, filepath.Join(d, "config.json")
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	// Atomic: write to tmp, rename over real path
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Dir returns the parent directory (for the log file to share).
func Dir() string { return dir }

// IsPaired returns true if the agent has completed pairing.
func (c *Config) IsPaired() bool { return c.APIKey != "" }
