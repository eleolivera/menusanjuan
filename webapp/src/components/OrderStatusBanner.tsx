"use client";

import { useState, useEffect, useRef } from "react";

type OrderStatus = "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED";

const STATUS_LABELS: Record<OrderStatus, string> = {
  GENERATED: "Enviado",
  PAID: "Pagado",
  PROCESSING: "En preparación",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  GENERATED: "bg-primary",
  PAID: "bg-blue-500",
  PROCESSING: "bg-amber-500",
  DELIVERED: "bg-emerald-500",
  CANCELLED: "bg-red-500",
};

export function OrderStatusBanner({
  orderId,
  token,
  orderNumber,
  onTap,
  onDismiss,
}: {
  orderId: string;
  token: string;
  orderNumber: string;
  onTap: () => void;
  onDismiss: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus>("GENERATED");
  const [dismissed, setDismissed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/orders/track?id=${orderId}&token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          if (data.status === "DELIVERED") {
            // Auto-dismiss after 30 seconds
            setTimeout(() => { setDismissed(true); onDismiss(); }, 30000);
            if (pollRef.current) clearInterval(pollRef.current);
          }
          if (data.status === "CANCELLED") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } else {
          // Order not found — dismiss
          setDismissed(true);
          onDismiss();
        }
      } catch {}
    }
    poll();
    pollRef.current = setInterval(poll, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, token, onDismiss]);

  if (dismissed) return null;

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-4 py-3 shadow-sm hover:shadow-md transition-all mb-4 animate-fade-in"
    >
      <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]} animate-pulse`} />
      <div className="flex-1 text-left">
        <span className="text-sm font-bold text-text">{orderNumber}</span>
        <span className="text-xs text-text-muted ml-2">{STATUS_LABELS[status]}</span>
      </div>
      <span className="text-xs font-medium text-primary">Ver pedido →</span>
    </button>
  );
}
