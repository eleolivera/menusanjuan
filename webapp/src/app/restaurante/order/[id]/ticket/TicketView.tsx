"use client";

import { useEffect, useState } from "react";

// Build stamp — printed at the bottom of the ticket so we can verify a fresh
// deploy made it to the printer. Bump whenever shipping a meaningful change.
const TICKET_BUILD = "v2026-05-15.b";

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
  // We fetch the QR as a real HTTP PNG (server-rendered by /api/qr). That URL
  // goes straight to <img src>, so the thermal driver gets a real fetchable
  // image — no data: URL, no inline <svg>, both of which some ESC/POS drivers
  // silently drop during print conversion.
  const qrSrc = driverUrl
    ? `/api/qr?data=${encodeURIComponent(driverUrl)}&size=320`
    : null;
  const [qrLoaded, setQrLoaded] = useState(!driverUrl);

  // Auto-trigger print if ?autoprint=1 — wait for the QR <img> to actually
  // load (HTTP fetch + decode) before firing print. Otherwise the print may
  // capture a missing/half-loaded image.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("autoprint")) return;
    if (!qrLoaded) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [qrLoaded]);

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
            width: 54mm !important;
            max-width: 54mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            font-size: 9px !important;
            line-height: 1.25 !important;
          }
          .ticket table { width: 100% !important; }
          /* Prevent text mid-word breaks unless absolutely needed */
          .ticket * { word-break: keep-all; overflow-wrap: break-word; }
        }
      `}</style>


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

      {/* Ticket — sized for 58mm thermal paper (printable ~48-54mm depending on driver) */}
      <div className="ticket-wrapper mx-auto py-6 px-3">
        <div className="ticket mx-auto bg-white text-black rounded-md shadow-lg p-3 max-w-[58mm] font-mono text-[10px] leading-snug">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="font-bold text-[12px] break-words">{order.restaurantName}</div>
            {order.restaurantPhone && <div className="text-[9px]">{order.restaurantPhone}</div>}
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

          {/* Items — using <table> so left/right alignment survives the thermal
             driver's print conversion. Flex/grid often collapse to inline. */}
          <table className="w-full border-collapse">
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="pr-2 py-0.5">
                    <div>{it.quantity}x {it.name}</div>
                    {it.note && <div className="text-[9px] italic pl-3">- {it.note}</div>}
                  </td>
                  <td className="text-right whitespace-nowrap py-0.5">
                    {ars((it.unitPrice + (it.optionsDelta || 0)) * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black/40 my-2" />

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="text-right whitespace-nowrap">{ars(subtotal)}</td>
              </tr>
              {order.deliveryFee > 0 && (
                <tr>
                  <td>Envio</td>
                  <td className="text-right whitespace-nowrap">{ars(order.deliveryFee)}</td>
                </tr>
              )}
              <tr className="font-bold text-[12px]">
                <td className="pt-1">TOTAL</td>
                <td className="text-right whitespace-nowrap pt-1">{ars(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

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

          {/* QR for driver — fetched as a real PNG via /api/qr. Thermal printer
             drivers fetch the URL like any normal image; no data: URL hijinks. */}
          {qrSrc && (
            <div className="mt-3 flex flex-col items-center">
              <div className="bg-white p-1 border border-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR del repartidor"
                  width={140}
                  height={140}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => setQrLoaded(true)}
                  style={{ display: "block", imageRendering: "pixelated" }}
                  crossOrigin="anonymous"
                />
              </div>
              <div className="text-[9px] mt-1 text-center">Escanear: estado actual + marcar entregado</div>
            </div>
          )}

          <div className="border-t border-dashed border-black/40 my-2" />
          <div className="text-center text-[8px]">MenuSanJuan</div>
          <div className="text-center text-[8px]">menusanjuan.com</div>
          {/* Build stamp — confirm latest code is what printed */}
          <div className="text-center text-[7px] text-black/60 mt-0.5">{TICKET_BUILD}</div>
        </div>
      </div>
    </div>
  );
}
