#!/usr/bin/env bash
# Cross-compile MenuSanJuanPrint for Windows from Mac/Linux.
#
# Usage:
#   ./build.sh             → builds with -X main.Version=dev
#   ./build.sh 0.1.2       → tags as v0.1.2 in the binary
#
# Output:
#   ./MenuSanJuanPrint.exe (6-7 MB, no CGO, runs on Windows 10+)
#
# To sign on Mac (after you've installed osslsigncode + have a .pfx cert):
#   osslsigncode sign -pkcs12 cert.pfx -pass "$PFX_PASS" \
#     -t http://timestamp.digicert.com -h sha256 \
#     -in  MenuSanJuanPrint.exe \
#     -out MenuSanJuanPrint-signed.exe
#
# That signed .exe is what gets uploaded to webapp/public/download/.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${1:-dev}"
OUT="MenuSanJuanPrint.exe"

echo "Building $OUT (version=$VERSION) for windows/amd64..."
GOOS=windows GOARCH=amd64 \
  go build \
    -ldflags="-X main.Version=$VERSION -s -w" \
    -trimpath \
    -o "$OUT" \
    .

ls -lh "$OUT"
echo
echo "Done. To test on a Windows machine: copy $OUT over, double-click to run."
echo "First run prompts for the 6-char pairing code from the dashboard."
