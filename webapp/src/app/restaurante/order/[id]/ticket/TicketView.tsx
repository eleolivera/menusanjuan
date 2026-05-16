"use client";

import { useEffect, useRef, useState } from "react";
// We render a hidden QRCodeCanvas, extract its PNG via toDataURL, and display
// the result as a plain <img>. Thermal-printer drivers (ESC/POS) commonly skip
// inline <svg> elements — they happily render <img> raster bitmaps. Canvas
// alone also gets bleached out by some Windows print pipelines. PNG it is.
import { QRCodeCanvas } from "qrcode.react";

type Item = { name: string; quantity: number; unitPrice: number; optionsDelta?: number; note?: string };

type Props = {
  order: {
    id: string;
    orderNumber: string;
    restaurantName: string;
    restaurantPhone: string;
    restaurantLogo: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    items: Item[];
    total: number;
    deliveryFee: number;
    deliveryMethod: string;
    notes: string;
    paymentStatus: "PAID" | "UNPAID";
    paymentMethod: string | null;
    createdAt: string;
  };
  driverUrl: string | null;
};

function ars(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export function TicketView({ order, driverUrl }: Props) {
  const hiddenQrRef = useRef<HTMLDivElement>(null);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  // Extract the QR canvas as a PNG data URL once mounted
  useEffect(() => {
    if (!driverUrl) return;
    const canvas = hiddenQrRef.current?.querySelector("canvas");
    if (canvas) {
      setQrPngUrl(canvas.toDataURL("image/png"));
    }
  }, [driverUrl]);

  // Auto-trigger print if ?autoprint=1 — but wait until the QR PNG is ready
  // (or there's no driverUrl at all). Otherwise the print may fire before the
  // <img> renders and the printer will get a missing QR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("autoprint")) return;
    if (driverUrl && !qrPngUrl) return; // still waiting for QR
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [qrPngUrl, driverUrl]);

  const subtotal = order.items.reduce(
    (s, it) => s + (it.unitPrice + (it.optionsDelta || 0)) * it.quantity,
    0,
  );
  const grandTotal = subtotal + order.deliveryFee;
  const dateStr = new Date(order.createdAt).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white print:min-h-0">
      <style>{`
        @media print {
          /* 58mm thermal paper (printable area ~54mm after side margins). The
             previous 80mm caused text to wrap onto multiple lines on a 58mm
             roll. If a resta later has an 80mm printer we can make this a
             setting. */
          @page { margin: 0; size: 58mm auto; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          /* Force exact colors (otherwise Chrome may bleach backgrounds + the QR) */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Hide everything, then re-show only the ticket card. /restaurante/layout.tsx
             wraps every child in DashboardShell (sidebar) — without this trick
             the sidebar would print to the left of the receipt. */
          body * { visibility: hidden !important; }
          .ticket, .ticket * { visibility: visible !important; }

          /* Pull the ticket to top-left of the page since its container is no
             longer in the visual flow. */
          .ticket {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Hidden canvas for PNG extraction — offscreen, never visible/printed. */}
      {driverUrl && (
        <div
          ref={hiddenQrRef}
          aria-hidden
          style={{ position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}
          className="no-print"
        >
          <QRCodeCanvas value={driverUrl} size={400} level="H" marginSize={0} />
        </div>
      )}

      {/* Action bar (hidden on print) */}
      <div className="no-print sticky top-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 z-10">
        <div className="text-xs text-slate-400">Comanda #{order.orderNumber}</div>
        <div className="flex gap-2">
          <button
            onClick={() => window.history.back()}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5"
          >
            ← Volver
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold hover:bg-primary-dark"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Ticket — 80mm wide for thermal printer feel */}
      <div className="ticket-wrapper mx-auto py-6 px-3">
        <div className="ticket mx-auto bg-white text-black rounded-md shadow-lg p-4 max-w-[80mm] font-mono text-[12px] leading-tight">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="font-bold text-[14px]">{order.restaurantName}</div>
            {order.restaurantPhone && <div className="text-[10px]">{order.restaurantPhone}</div>}
          </div>

          <div className="border-t border-dashed border-black/40 my-2" />

          <div className="text-center text-[10px]">
            <div>{dateStr}</div>
            <div className="font-bold text-[13px]">#{order.orderNumber}</div>
            <div className="uppercase">{order.deliveryMethod === "pickup" ? "Retiro en local" : order.deliveryMethod === "delivery" ? "Delivery" : order.deliveryMethod}</div>
          </div>

          <div className="border-t border-dashed border-black/40 my-2" />

          {/* Customer */}
          <div className="mb-2">
            <div className="font-bold">Cliente:</div>
            <div>{order.customerName}</div>
            <div>{order.customerPhone}</div>
            {order.customerAddress && <div className="text-[10px]">{order.customerAddress}</div>}
          </div>

          {order.notes && (
            <>
              <div className="border-t border-dashed border-black/40 my-2" />
              <div className="mb-2">
                <div className="font-bold">Notas:</div>
                <div className="text-[10px]">{order.notes}</div>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-black/40 my-2" />

          {/* Items */}
          <div className="space-y-1">
            {order.items.map((it, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span>{it.quantity}× {it.name}</span>
                  <span>{ars((it.unitPrice + (it.optionsDelta || 0)) * it.quantity)}</span>
                </div>
                {it.note && <div className="text-[10px] italic pl-3">→ {it.note}</div>}
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black/40 my-2" />

          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{ars(subtotal)}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Envío</span>
              <span>{ars(order.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-[14px] mt-1">
            <span>TOTAL</span>
            <span>{ars(grandTotal)}</span>
          </div>

          <div className="border-t border-dashed border-black/40 my-2" />

          {/* Payment status stamp */}
          {order.paymentStatus === "PAID" ? (
            <div className="text-center font-bold border-2 border-black py-1 my-2">
              ✓ PAGADO {order.paymentMethod ? `(${order.paymentMethod})` : ""}
            </div>
          ) : (
            <div className="text-center font-bold border-2 border-black py-1 my-2">
              ⚠ COBRAR {ars(grandTotal)}
            </div>
          )}

          {/* QR for driver — PNG <img> so thermal printer drivers always render it.
             We rasterize the hidden canvas via toDataURL — see hiddenQrRef above. */}
          {driverUrl && qrPngUrl && (
            <div className="mt-3 flex flex-col items-center">
              <div className="bg-white p-1 border border-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrPngUrl}
                  alt="QR del repartidor"
                  width={140}
                  height={140}
                  style={{ display: "block", imageRendering: "pixelated" }}
                />
              </div>
              <div className="text-[10px] mt-1 text-center">Escanear → estado actual + marcar entregado</div>
            </div>
          )}

          <div className="border-t border-dashed border-black/40 my-2" />
          <div className="text-center text-[9px]">MenuSanJuan · menusanjuan.com</div>
        </div>
      </div>
    </div>
  );
}
