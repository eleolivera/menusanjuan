//go:build !windows

package printer

// Dev-only stub used when cross-compiling or developing on Mac/Linux.
// Writes the would-be print payload to a .bin file in the AppData dir so
// you can inspect it (or pipe it to a real Windows machine for replay).
import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func platformPrint(printerName string, data []byte) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".menusanjuan", "print-dump")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	name := fmt.Sprintf("ticket-%d.bin", time.Now().UnixMilli())
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	if printerName == "" {
		printerName = "(default, dev-stub)"
	}
	fmt.Fprintf(os.Stderr, "[dev printer stub] would print %d bytes to %q → wrote to %s\n", len(data), printerName, path)
	return printerName, nil
}

func platformDefaultPrinter() (string, error) {
	return "dev-stub", nil
}

func platformListPrinters() ([]string, error) {
	return []string{"dev-stub"}, nil
}
