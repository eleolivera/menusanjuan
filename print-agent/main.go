// MenuSanJuanPrint — local print agent that connects to MenuSanJuan and
// prints ESC/POS bytes directly to a thermal printer.
//
// First-run: walks the user through pairing via a simple console prompt
// (Day 4 will replace this with a native Win32 dialog). Subsequent runs
// just resume polling.
//
// Run loop:
//   - heartbeat goroutine: POST /heartbeat every 60s
//   - poll goroutine: long-poll /poll for jobs, on each job print + ack
//
// Logs to %APPDATA%\MenuSanJuan\agent.log (or ~/.menusanjuan/agent.log
// on Mac for dev).
package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/eleolivera/menusanjuan/print-agent/api"
	"github.com/eleolivera/menusanjuan/print-agent/config"
	"github.com/eleolivera/menusanjuan/print-agent/log"
	"github.com/eleolivera/menusanjuan/print-agent/printer"
)

// Version is set at build time via -ldflags="-X main.Version=...".
var Version = "dev"

const (
	heartbeatInterval = 60 * time.Second
	pollBackoffOnErr  = 5 * time.Second
)

func main() {
	// Bootstrap: load config + open log file
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "FATAL: load config:", err)
		os.Exit(1)
	}
	if err := log.Init(config.Dir()); err != nil {
		fmt.Fprintln(os.Stderr, "FATAL: open log:", err)
		os.Exit(1)
	}
	log.Info("MenuSanJuanPrint %s starting on %s/%s", Version, runtime.GOOS, runtime.GOARCH)
	log.Info("config file: %s", configPath())
	log.Info("log file:    %s", log.Path())
	log.Info("base url:    %s", cfg.BaseURL)

	hostInfo := hostnameOrAnon() + " · " + runtime.GOOS

	// Pair flow — if no API key, ask for a code interactively
	if !cfg.IsPaired() {
		log.Info("not paired yet — running first-run setup")
		if err := runPairing(cfg, hostInfo); err != nil {
			log.Errorf("pairing failed: %v", err)
			fmt.Fprintln(os.Stderr, "Error:", err)
			fmt.Fprintln(os.Stderr, "Apretá Enter para cerrar.")
			bufio.NewReader(os.Stdin).ReadString('\n')
			os.Exit(1)
		}
		log.Info("pairing OK — agentName=%q dealer=%q", cfg.AgentName, cfg.DealerName)
	}

	// Build the HTTP client with the saved API key
	cli := api.New(cfg.BaseURL)
	cli.APIKey = cfg.APIKey
	cli.Version = Version
	cli.HostInfo = hostInfo

	ctx := context.Background()

	// Initial heartbeat — also doubles as a quick connectivity check
	if err := cli.Heartbeat(ctx); err != nil {
		log.Errorf("initial heartbeat failed: %v (will retry from the loop)", err)
	} else {
		log.Info("initial heartbeat OK")
	}

	// Heartbeat goroutine
	go heartbeatLoop(ctx, cli)

	// Poll loop runs on the main goroutine so the process exits when poll
	// loop exits (e.g. on 401 = key revoked).
	pollLoop(ctx, cli, cfg)
}

func runPairing(cfg *config.Config, hostInfo string) error {
	cli := api.New(cfg.BaseURL)
	cli.Version = Version
	cli.HostInfo = hostInfo

	fmt.Println()
	fmt.Println("======================================================")
	fmt.Println(" MenuSanJuanPrint — primer arranque")
	fmt.Println("======================================================")
	fmt.Println()
	fmt.Println("Entrá a tu dashboard de MenuSanJuan:")
	fmt.Println("  Mi Restaurante → Impresora local → Conectar impresora")
	fmt.Println()
	fmt.Println("Te va a mostrar un código de 6 caracteres. Pegalo acá:")
	fmt.Print("\nCódigo > ")
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("leyendo entrada: %w", err)
	}
	code := strings.ToUpper(strings.TrimSpace(line))
	if len(code) != 6 {
		return fmt.Errorf("el código tiene que ser de 6 caracteres (recibí %d)", len(code))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	resp, err := cli.Pair(ctx, code)
	if err != nil {
		return err
	}

	cfg.APIKey = resp.APIKey
	cfg.AgentID = resp.AgentID
	cfg.AgentName = resp.AgentName
	cfg.DealerName = resp.DealerName
	cfg.DealerSlug = resp.DealerSlug
	if err := config.Save(cfg); err != nil {
		return fmt.Errorf("guardando config: %w", err)
	}

	fmt.Println()
	fmt.Println("✓ Conectado a", resp.DealerName)
	fmt.Println("  El agente queda corriendo — podés cerrar esta ventana cuando quieras.")
	fmt.Println()
	return nil
}

func heartbeatLoop(ctx context.Context, cli *api.Client) {
	t := time.NewTicker(heartbeatInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			hctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			err := cli.Heartbeat(hctx)
			cancel()
			if err != nil {
				log.Debug("heartbeat error: %v", err)
			}
		}
	}
}

func pollLoop(ctx context.Context, cli *api.Client, cfg *config.Config) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pctx, cancel := context.WithTimeout(ctx, 35*time.Second)
		job, err := cli.Poll(pctx)
		cancel()
		if err != nil {
			// 401 = key revoked from server side. We can't recover; the user has
			// to re-pair via the dashboard.
			if strings.Contains(err.Error(), "HTTP 401") {
				log.Errorf("API key was revoked from the dashboard — clearing local config and exiting")
				cfg.APIKey = ""
				_ = config.Save(cfg)
				os.Exit(2)
			}
			log.Debug("poll error: %v (retrying in %s)", err, pollBackoffOnErr)
			time.Sleep(pollBackoffOnErr)
			continue
		}
		if job == nil {
			// No work — immediate re-poll
			continue
		}

		log.Info("got job %s (kind=%s, order=%s, %d bytes)", job.JobID, job.Kind, job.OrderID, len(job.PayloadBase64)*3/4)

		payload, err := job.Payload()
		if err != nil {
			log.Errorf("decode payload: %v", err)
			_ = cli.Ack(ctx, job.JobID, "FAILED", "decode payload: "+err.Error())
			continue
		}

		used, perr := printer.Print(cfg.PrinterName, payload)
		if perr != nil {
			log.Errorf("print failed (printer=%q): %v", used, perr)
			_ = cli.Ack(ctx, job.JobID, "FAILED", perr.Error())
			continue
		}
		log.Info("printed job %s on %q", job.JobID, used)
		if err := cli.Ack(ctx, job.JobID, "DELIVERED", ""); err != nil {
			log.Errorf("ack failed: %v", err)
		}
	}
}

func hostnameOrAnon() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return "unknown-host"
	}
	return h
}

func configPath() string {
	d, err := config.AppDataDir()
	if err != nil {
		return "(unknown)"
	}
	return d + string(os.PathSeparator) + "config.json"
}
