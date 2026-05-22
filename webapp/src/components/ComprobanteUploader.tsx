"use client";

import { useRef, useState } from "react";

/**
 * Shared file picker + preview for uploading a payment comprobante.
 *
 * Two modes:
 *   - mode="checkout"     — used INSIDE OrderModal before the order exists.
 *                           Uploads to /api/upload (logged-out friendly because
 *                           the upload endpoint accepts unauthed posts when
 *                           type="comprobante"), returns the URL to parent via
 *                           onUploaded so it can ship it in POST /api/orders.
 *   - mode="post-order"   — used in /pagar/[orderId] and /mis-pedidos.
 *                           Uploads directly to /api/orders/[id]/receipt with
 *                           the customerAccessToken. Server-side updates the
 *                           order in one call.
 *
 * The UI is identical in both modes — file picker → preview → "Subir" button →
 * status text. Keeps file size + MIME validation client-side as a hint (server
 * also validates).
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

type Props =
  | {
      mode: "checkout";
      onUploaded: (url: string) => void;
      initialUrl?: string | null;
      onClear?: () => void;
    }
  | {
      mode: "post-order";
      orderId: string;
      customerAccessToken: string;
      onUploaded: (url: string) => void;
      initialUrl?: string | null;
      onClear?: () => void;
    };

export function ComprobanteUploader(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(props.initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    if (uploading) return;
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setError(null);

    if (!ALLOWED.includes(file.type)) {
      setError("Subí una imagen (JPG / PNG / WEBP / HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`La imagen es muy grande (máx ${MAX_BYTES / 1024 / 1024} MB).`);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      let url: string;
      if (props.mode === "checkout") {
        // Generic upload — server stores under user-{id}/comprobante-{ts}.{ext}
        // or guest folder. We send type=comprobante for storage organization.
        form.append("type", "comprobante");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error al subir");
        }
        url = data.url as string;
      } else {
        // Post-order: customer-authed via token. One round-trip both uploads
        // and updates the order to PAID_UNVERIFIED.
        const res = await fetch(
          `/api/orders/${props.orderId}/receipt?t=${encodeURIComponent(props.customerAccessToken)}`,
          { method: "POST", body: form },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error al subir");
        }
        url = data.paymentReceiptUrl as string;
      }

      setPreviewUrl(url);
      props.onUploaded(url);
    } catch (err) {
      setError((err as Error).message || "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    props.onClear?.();
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {previewUrl ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Comprobante"
              className="h-20 w-20 rounded-lg object-cover bg-black/20"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-emerald-300">✓ Comprobante cargado</div>
              <div className="text-[11px] text-emerald-200/70 mt-0.5 break-all">
                {previewUrl.split("/").pop()}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={uploading}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className="w-full rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-4 text-center hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
        >
          <div className="text-2xl mb-1">📎</div>
          <div className="text-sm font-semibold text-emerald-300">
            {uploading ? "Subiendo..." : "Subir comprobante"}
          </div>
          <div className="text-[10px] text-emerald-200/70 mt-1">
            JPG / PNG / WEBP / HEIC · máx 5 MB
          </div>
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
