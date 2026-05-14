"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export function RestaurantQrCard({ slug, name }: { slug: string; name: string }) {
  const url = `https://menusanjuan.com/${slug}`;
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `menusanjuan-${slug}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 mb-6 flex flex-col sm:flex-row items-center gap-5">
      <div ref={qrRef} className="rounded-xl bg-white p-3 shadow-md shrink-0">
        <QRCodeCanvas
          value={url}
          size={180}
          level="H"
          includeMargin={false}
          imageSettings={{ src: "/icon-512.png", height: 36, width: 36, excavate: true }}
        />
      </div>
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <h3 className="text-sm font-bold text-white mb-1">Código QR para compartir</h3>
        <p className="text-xs text-slate-400 mb-3">
          Imprimilo y dejalo en el local, mesas, ventana — quien lo escanee va directo al menú de <span className="text-primary">{name}</span>.
        </p>
        <div className="flex items-center gap-2 mb-3 justify-center sm:justify-start">
          <code className="text-xs text-slate-300 bg-slate-800/60 px-2 py-1 rounded truncate max-w-[260px]">{url}</code>
          <button onClick={copyUrl} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 transition-colors">
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>
        <div className="flex gap-2 justify-center sm:justify-start">
          <button
            onClick={downloadQr}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            ⬇ Descargar QR (PNG)
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            Abrir página
          </a>
        </div>
      </div>
    </div>
  );
}
