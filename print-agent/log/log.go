// Package log writes the agent's runtime log to a rotating file under
// %APPDATA%\MenuSanJuan\agent.log so we can troubleshoot a customer's
// installation by asking them to copy/paste it to us.
//
// Tiny dependency footprint on purpose — just log.New + a manual rotation
// on startup if the file exceeds 1 MB. No timestamp rotation, no archive.
package log

import (
	"fmt"
	stdlog "log"
	"os"
	"path/filepath"
	"sync"
)

const (
	logFileName = "agent.log"
	maxBytes    = 1 * 1024 * 1024 // 1 MB → rename to .old and start fresh
)

var (
	mu     sync.Mutex
	logger *stdlog.Logger
	dir    string
)

// Init opens (and rotates if needed) the log file. Subsequent Info/Errorf
// calls write to both stdout and the file. Safe to call multiple times.
func Init(appDataDir string) error {
	mu.Lock()
	defer mu.Unlock()

	dir = appDataDir
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}
	path := filepath.Join(dir, logFileName)

	// Rotate if the file is too big
	if info, err := os.Stat(path); err == nil && info.Size() > maxBytes {
		_ = os.Rename(path, path+".old")
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log: %w", err)
	}

	logger = stdlog.New(multiWriter{f, os.Stdout}, "", stdlog.LstdFlags|stdlog.LUTC)
	logger.Println("=== agent started ===")
	return nil
}

func Info(format string, args ...interface{})  { write("INFO", format, args...) }
func Errorf(format string, args ...interface{}) { write("ERR ", format, args...) }
func Debug(format string, args ...interface{}) { write("DBG ", format, args...) }

func write(level, format string, args ...interface{}) {
	mu.Lock()
	defer mu.Unlock()
	if logger == nil {
		// Fallback before Init() — print to stderr
		fmt.Fprintf(os.Stderr, "["+level+"] "+format+"\n", args...)
		return
	}
	logger.Printf("["+level+"] "+format, args...)
}

// Path returns the absolute path of the log file (for the tray menu's
// "Open logs" action later).
func Path() string {
	return filepath.Join(dir, logFileName)
}

// multiWriter so we don't pull in io.MultiWriter (avoids surprising deps).
type multiWriter struct{ a, b *os.File }

func (w multiWriter) Write(p []byte) (n int, err error) {
	n, _ = w.a.Write(p)
	_, _ = w.b.Write(p)
	return n, nil
}
