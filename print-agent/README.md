# MenuSanJuanPrint — local print agent (Windows)

A small Windows binary that long-polls the MenuSanJuan backend for print jobs
and sends raw ESC/POS bytes to a thermal printer. Bypasses the OS driver's
text-rendering step (which silently drops `<img>`/`<svg>` elements on most
generic ESC/POS drivers), so QR codes, barcodes, and any image element prints
reliably.

## Branch & dev workflow

This feature is being built on the **`print-agent`** branch.

- **Production stays on `main`** — only bug fixes for the existing app go there.
- **All print-agent work** (backend extensions, dashboard UI, the Go binary,
  OrderCard integration) lands on `print-agent`.
- Vercel auto-creates a preview deploy for the `print-agent` branch at a URL
  like `menusanjuan-git-print-agent-{user}.vercel.app`. Use that preview URL
  to test the agent against — it has the latest API routes from this branch
  without touching prod.
- When the full feature is end-to-end ready and tested, merge `print-agent`
  → `main` in one PR.

```bash
# On the Mac (where code is mostly written):
git checkout print-agent
# ... make changes ...
git push

# On the PC (for building + testing the agent binary):
git pull
cd print-agent
go build -ldflags="-H windowsgui -s -w" -o MenuSanJuanPrint.exe
./MenuSanJuanPrint.exe
# ... test ...
```

## Phasing — Mac-first, PC-last

| Phase | What | Where built |
|---|---|---|
| Day 1 (DONE — `77e170b` on main) | Backend: schema + 10 API routes + ESC/POS payload generator | Mac |
| Day 2 | Dashboard "Impresora" section in `/restaurante/profile` | Mac |
| Day 3 | Core agent: config, HTTP client (pair/poll/ack/heartbeat), spooler-RAW print path, log file. Pure Go, no CGO. | Mac (cross-compile to `.exe`) |
| Day 5 | OrderCard `handlePrint` agent-first + iframe fallback | Mac |
| Day 4 (deferred until later) | System tray (CGO), Win32 pairing dialog (CGO), `shell:startup` registration, auto-update | PC (native build) |
| Day 6 | OV cert signing (`signtool` or `osslsigncode`), host the .exe at `/download/...`, `version.json` | PC for signtool, or Mac for osslsigncode |

Mac-first means we get to a testable v0 agent (headless, runs in the background,
logs to a file) before adding the polished UX bits that need CGO.

## What the user needs on the PC

- **Go (latest stable)** — download from <https://go.dev/dl/>. Pick the
  `windows-amd64.msi` installer. Verify in PowerShell: `go version`.
- That's it for v0 (no system tray yet). For Day 4 we'll add MinGW only
  if needed for CGO bits.

**Target Windows version: 10 and 11.** Win 7/8 are out of scope for the agent —
those restas keep using the browser-print fallback (which we've already
hardened with the URL-as-text safety net under the QR). Modern Go (1.21+)
dropped Win 7 support and we'd rather have current stdlib + security updates
than EOL'd Go 1.20.

## Layout (planned)

```
print-agent/
├── README.md              <- you are here
├── go.mod
├── main.go                <- entry point: load config, start goroutines
├── config/
│   └── config.go          <- read/write %APPDATA%\MenuSanJuan\config.json
├── api/
│   └── client.go          <- pair, poll, ack, heartbeat HTTP calls
├── printer/
│   └── spooler.go         <- Windows spooler-RAW write via golang.org/x/sys/windows
├── log/
│   └── log.go             <- rotating file logger at %APPDATA%\MenuSanJuan\agent.log
└── (Day 4) tray/, pairing/, startup/, update/
```

## Backend contract (already live on `main`)

The agent talks to these endpoints. All paths relative to `NEXT_PUBLIC_BASE_URL`
(prod: `https://menusanjuan.com`, preview: `https://menusanjuan-git-print-agent-{user}.vercel.app`).

```
POST /api/print-agent/pair
  body: { code, hostInfo?, version? }
  -> { agentId, agentName, apiKey, dealerName, dealerSlug }

GET  /api/print-agent/poll
  header: Authorization: Bearer <apiKey>
  long-polls up to ~20s
  -> 200 { jobId, kind, orderId, payloadBase64 }  OR  204

POST /api/print-agent/ack
  header: Authorization: Bearer <apiKey>
  body: { jobId, status: "DELIVERED" | "FAILED", error? }

POST /api/print-agent/heartbeat
  header: Authorization: Bearer <apiKey>
  body: { version?, hostInfo? }
```
