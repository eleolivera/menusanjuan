"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Order, OrderStatus } from "@/lib/orders-store";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; emoji: string; bg: string; text: string; next?: OrderStatus; nextLabel?: string }
> = {
  GENERATED: {
    label: "Generado",
    emoji: "📝",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    next: "PAID",
    nextLabel: "Marcar Pagado",
  },
  PAID: {
    label: "Pagado",
    emoji: "💰",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    next: "PROCESSING",
    nextLabel: "Enviar a Cocina",
  },
  PROCESSING: {
    label: "En Cocina",
    emoji: "🔄",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    next: "DELIVERED",
    nextLabel: "Marcar Entregado",
  },
  DELIVERED: {
    label: "Entregado",
    emoji: "✅",
    bg: "bg-slate-500/15",
    text: "text-slate-400",
  },
  CANCELLED: {
    label: "Cancelado",
    emoji: "❌",
    bg: "bg-red-500/15",
    text: "text-red-400",
  },
};

export function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: Order;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIG[order.status];
  const timeSince = getTimeSince(order.createdAt);

  const cleanPhone = order.customerPhone.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}`;
  const mapsUrl =
    order.latitude && order.longitude
      ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
      : order.customerAddress
        ? `https://www.google.com/maps/search/${encodeURIComponent(order.customerAddress)}`
        : null;

  function handlePrint() {
    if (!receiptRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 8px; width: 80mm; }
            .receipt { font-size: 12px; line-height: 1.4; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; }
            .total-row { font-size: 16px; font-weight: bold; }
            .qr-row { display: flex; justify-content: space-around; margin-top: 8px; }
            .qr-label { font-size: 10px; text-align: center; margin-top: 2px; }
            svg { display: block; margin: 0 auto; }
            @media print { body { width: 80mm; } }
          </style>
        </head>
        <body>
          ${receiptRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden transition-all hover:border-white/10">
      {/* Compact view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
              {config.emoji} {config.label}
            </span>
            <span className="text-sm font-bold text-white truncate">
              {order.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold text-white">
              ${order.total.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-slate-500">{timeSince}</span>
            <svg
              className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
          <span>👤 {order.customerName}</span>
          <span>·</span>
          <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
          {order.whatsappSent && (
            <>
              <span>·</span>
              <span className="text-green-500">WhatsApp ✓</span>
            </>
          )}
        </div>
      </button>

      {/* Expanded: Receipt-style ticket */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-4 animate-fade-in">
          {/* Receipt */}
          <div
            ref={receiptRef}
            className="mx-auto max-w-xs rounded-xl bg-white text-slate-900 p-5 font-mono text-xs shadow-lg"
          >
            {/* Header */}
            <div className="text-center mb-3">
              <div className="text-lg font-bold tracking-tight">MenuSanJuan</div>
              <div className="text-[10px] text-slate-500 mt-0.5">menusanjuan.com</div>
              <div className="border-t-2 border-dashed border-slate-300 mt-3" />
            </div>

            {/* Order number + date */}
            <div className="flex justify-between mb-1">
              <span className="font-bold text-sm">{order.orderNumber}</span>
              <span className="font-bold text-[10px] uppercase">
                {config.emoji} {config.label}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mb-3">
              {new Date(order.createdAt).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Items */}
            <div className="space-y-1.5 mb-2">
              {order.items.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{item.quantity}x {item.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span className="pl-4">${item.unitPrice.toLocaleString("es-AR")} c/u</span>
                    <span className="font-semibold text-slate-700">${item.total.toLocaleString("es-AR")}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Total */}
            <div className="flex justify-between text-base font-bold mb-3">
              <span>TOTAL</span>
              <span>${order.total.toLocaleString("es-AR")}</span>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Customer */}
            <div className="space-y-1 mb-3">
              <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500">
                Cliente
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre</span>
                <span className="font-semibold">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tel</span>
                <span className="font-semibold">{order.customerPhone}</span>
              </div>
              {order.customerAddress && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Dir</span>
                  <span className="font-semibold text-right max-w-[60%]">{order.customerAddress}</span>
                </div>
              )}
              {order.notes && (
                <div className="mt-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[10px]">
                  📝 {order.notes}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* QR Codes */}
            <div className="flex justify-around items-start pt-2">
              <div className="text-center">
                <QRCodeSVG value={whatsappUrl} size={70} level="M" />
                <div className="text-[9px] text-slate-500 mt-1 font-semibold">WhatsApp</div>
              </div>
              {mapsUrl && (
                <div className="text-center">
                  <QRCodeSVG value={mapsUrl} size={70} level="M" />
                  <div className="text-[9px] text-slate-500 mt-1 font-semibold">Ubicación</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center mt-3 pt-2 border-t border-dashed border-slate-300">
              <div className="text-[9px] text-slate-400">Gracias por tu pedido</div>
              <div className="text-[9px] text-slate-400">menusanjuan.com</div>
            </div>
          </div>

          {/* Actions (outside receipt, screen only) */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Imprimir
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 py-2 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
            >
              WhatsApp
            </a>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/25 transition-colors"
              >
                Maps
              </a>
            )}
          </div>

          {/* Status actions */}
          <div className="mt-3 flex gap-2">
            {config.next && config.nextLabel && (
              <button
                onClick={() => onUpdateStatus(order.id, config.next!)}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                {config.nextLabel}
              </button>
            )}
            {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
              <button
                onClick={() => onUpdateStatus(order.id, "CANCELLED")}
                className="rounded-xl border border-red-500/20 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
