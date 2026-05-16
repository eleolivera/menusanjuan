# /download — agent binaries

The Windows print-agent binary `MenuSanJuanPrint.exe` is committed here so
Vercel serves it at `/download/MenuSanJuanPrint.exe`. The dashboard's
"Conectar impresora" modal links to that path.

## Important notes

- **Not signed yet** — for early testing only. Windows SmartScreen will warn
  "publisher unknown" / "Windows protegió tu PC" — user must click "Más
  información" → "Ejecutar de todas formas". Day 6 of the print-agent plan
  adds an OV code-signing cert that eliminates these warnings.
- **No auto-update yet** — the binary committed here is the version users
  download. To ship a new version, rebuild + replace this file + commit.
  Day 6 will add a proper `version.json` + auto-updater.
- **Hardcoded backend default** is `https://menusanjuan.com`. For testing
  against the Vercel preview deploy of the `print-agent` branch, set:

  ```powershell
  $env:MENUSANJUAN_BASE = "https://menusanjuan-git-print-agent-elio.vercel.app"
  .\MenuSanJuanPrint.exe
  ```

  That URL is the latest preview built from the `print-agent` branch — get
  the exact URL from the Vercel dashboard.

## Building a new version

```bash
cd print-agent
./build.sh 0.1.1
cp MenuSanJuanPrint.exe ../webapp/public/download/MenuSanJuanPrint.exe
git add ../webapp/public/download/MenuSanJuanPrint.exe
git commit -m "Print agent: v0.1.1"
git push
```

Wait ~60s for Vercel to redeploy, then users download the new version.
