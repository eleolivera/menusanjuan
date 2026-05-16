"use client";

import { useEffect } from "react";
// SVG QR (not Canvas) — thermal printers + browser print engines render SVG
// reliably; Canvas often comes out blank or pixelated on print.
import { QRCodeSVG } from "qrcode.react";

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
  // Auto-trigger print if ?autoprint=1
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("autoprint")) {
      setTimeout(() => window.print(), 400);
    }
  }, []);

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
          @page { margin: 0; size: 80mm auto; }
          /* Strip everything: html/body padding, the outer screen-only chrome */
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          /* Force exact colors (otherwise Chrome may bleach backgrounds + the QR) */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          /* Make the ticket the only visible block, no shadow/border/extra padding */
          .ticket-wrapper { padding: 0 !important; margin: 0 !important; }
          .ticket {
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            max-width: 80mm !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
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

          {/* QR for driver — SVG so thermal printers render it reliably */}
          {driverUrl && (
            <div className="mt-3 flex flex-col items-center">
              <div className="bg-white p-2 border border-black">
                <QRCodeSVG
                  value={driverUrl}
                  size={160}
                  level="H"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#000000"
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
