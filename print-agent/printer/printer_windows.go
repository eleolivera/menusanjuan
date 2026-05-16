//go:build windows

package printer

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Windows DLLs we call into for printer spooler access (winspool.drv) and
// default-printer query (winspool.drv). These are stable Win32 APIs going
// back to Windows 2000.
var (
	winspool = windows.NewLazySystemDLL("winspool.drv")

	procOpenPrinterW       = winspool.NewProc("OpenPrinterW")
	procClosePrinter       = winspool.NewProc("ClosePrinter")
	procStartDocPrinterW   = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter      = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter   = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter     = winspool.NewProc("EndPagePrinter")
	procWritePrinter       = winspool.NewProc("WritePrinter")
	procGetDefaultPrinterW = winspool.NewProc("GetDefaultPrinterW")
	procEnumPrintersW      = winspool.NewProc("EnumPrintersW")
)

// DOC_INFO_1W as defined in WinSpool.h
type docInfo1 struct {
	DocName    *uint16
	OutputFile *uint16
	Datatype   *uint16
}

// PRINTER_INFO_4W — minimal struct used by EnumPrinters level 4 (printer name only).
type printerInfo4 struct {
	PrinterName *uint16
	ServerName  *uint16
	Attributes  uint32
}

const (
	printerEnumLocal       = 0x00000002
	printerEnumConnections = 0x00000004
)

func platformPrint(printerName string, data []byte) (string, error) {
	if printerName == "" {
		n, err := platformDefaultPrinter()
		if err != nil {
			return "", fmt.Errorf("get default printer: %w", err)
		}
		if n == "" {
			return "", fmt.Errorf("no default printer set in Windows")
		}
		printerName = n
	}

	pName, err := windows.UTF16PtrFromString(printerName)
	if err != nil {
		return printerName, err
	}

	// OpenPrinter
	var hPrinter windows.Handle
	r1, _, lastErr := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(pName)),
		uintptr(unsafe.Pointer(&hPrinter)),
		0,
	)
	if r1 == 0 {
		return printerName, fmt.Errorf("OpenPrinter: %w", lastErr)
	}
	defer procClosePrinter.Call(uintptr(hPrinter))

	// StartDocPrinter — RAW datatype = bypasses driver rendering, sends bytes as-is
	docName, _ := windows.UTF16PtrFromString("MenuSanJuan ticket")
	rawType, _ := windows.UTF16PtrFromString("RAW")
	di := docInfo1{DocName: docName, Datatype: rawType}
	r1, _, lastErr = procStartDocPrinterW.Call(
		uintptr(hPrinter),
		1, // level 1 = DOC_INFO_1W
		uintptr(unsafe.Pointer(&di)),
	)
	if r1 == 0 {
		return printerName, fmt.Errorf("StartDocPrinter: %w", lastErr)
	}

	// StartPagePrinter
	r1, _, lastErr = procStartPagePrinter.Call(uintptr(hPrinter))
	if r1 == 0 {
		procEndDocPrinter.Call(uintptr(hPrinter))
		return printerName, fmt.Errorf("StartPagePrinter: %w", lastErr)
	}

	// WritePrinter
	var written uint32
	r1, _, lastErr = procWritePrinter.Call(
		uintptr(hPrinter),
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	procEndPagePrinter.Call(uintptr(hPrinter))
	procEndDocPrinter.Call(uintptr(hPrinter))
	if r1 == 0 {
		return printerName, fmt.Errorf("WritePrinter: %w", lastErr)
	}
	if int(written) != len(data) {
		return printerName, fmt.Errorf("WritePrinter short write: %d of %d", written, len(data))
	}
	return printerName, nil
}

func platformDefaultPrinter() (string, error) {
	var size uint32 = 256
	buf := make([]uint16, size)
	r1, _, lastErr := procGetDefaultPrinterW.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if r1 == 0 {
		// ERROR_INSUFFICIENT_BUFFER → retry with the requested size
		if errno, ok := lastErr.(syscall.Errno); ok && errno == 122 {
			buf = make([]uint16, size)
			r1, _, lastErr = procGetDefaultPrinterW.Call(
				uintptr(unsafe.Pointer(&buf[0])),
				uintptr(unsafe.Pointer(&size)),
			)
			if r1 == 0 {
				return "", lastErr
			}
		} else {
			return "", lastErr
		}
	}
	return windows.UTF16ToString(buf), nil
}

func platformListPrinters() ([]string, error) {
	// EnumPrinters with level 4 — minimal, just names. Two-pass: first
	// call returns required buffer size, second call fills it.
	var needed, count uint32
	flags := uint32(printerEnumLocal | printerEnumConnections)
	procEnumPrintersW.Call(
		uintptr(flags), 0, 4,
		0, 0,
		uintptr(unsafe.Pointer(&needed)),
		uintptr(unsafe.Pointer(&count)),
	)
	if needed == 0 {
		return nil, nil
	}
	buf := make([]byte, needed)
	r1, _, lastErr := procEnumPrintersW.Call(
		uintptr(flags), 0, 4,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
		uintptr(unsafe.Pointer(&count)),
	)
	if r1 == 0 {
		return nil, lastErr
	}
	infos := (*[1 << 20]printerInfo4)(unsafe.Pointer(&buf[0]))[:count:count]
	names := make([]string, 0, count)
	for _, p := range infos {
		if p.PrinterName != nil {
			names = append(names, windows.UTF16PtrToString(p.PrinterName))
		}
	}
	return names, nil
}
