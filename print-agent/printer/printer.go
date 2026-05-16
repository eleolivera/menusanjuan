// Package printer writes raw ESC/POS bytes to a Windows printer via the
// spooler in RAW mode — bypasses the driver's text-rendering step (which
// is what was killing QR codes for restas) but still uses the installed
// driver to address the printer hardware.
//
// Two implementations:
//   - printer_windows.go uses OpenPrinter/StartDocPrinter("RAW")/WritePrinter
//     via golang.org/x/sys/windows. Used in production.
//   - printer_other.go writes bytes to a file in the AppData dir so we can
//     develop / test on Mac. The file's content can be replayed on a
//     Windows machine later if we want.
package printer

// Print sends raw ESC/POS bytes to the named printer. Pass an empty string
// to use the system default printer. Returns the printer name that was
// actually used (helpful for logging).
func Print(printerName string, data []byte) (used string, err error) {
	return platformPrint(printerName, data)
}

// ListPrinters returns all installed printers. Used by the future pairing
// UI to let the owner pick which one to use, and by the "Probar" button
// for diagnostics.
func ListPrinters() ([]string, error) {
	return platformListPrinters()
}

// DefaultPrinter returns the name of the OS default printer, or "" if none.
func DefaultPrinter() (string, error) {
	return platformDefaultPrinter()
}
