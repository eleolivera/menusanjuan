"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { OrderCard } from "./OrderCard";

const COLUMNS: { status: OrderStatus; label: string; emoji: string; headerColor: string; borderColor: string }[] = [
  { status: "GENERATED", label: "Generado", emoji: "📝", headerColor: "text-amber-400", borderColor: "border-amber-500" },
  { status: "PAID", label: "Pagado", emoji: "💰", headerColor: "text-emerald-400", borderColor: "border-emerald-500" },
  { status: "PROCESSING", label: "En Cocina", emoji: "🔄", headerColor: "text-blue-400", borderColor: "border-blue-500" },
  { status: "DELIVERED", label: "Entregado", emoji: "✅", headerColor: "text-slate-400", borderColor: "border-slate-500" },
];

export function KanbanBoard({
  orders,
  onUpdateStatus,
  restaurantName,
}: {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  restaurantName: string;
}) {
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null);

  function handleDragStart(e: React.DragEvent, orderId: string) {
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: OrderStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  function handleDrop(e: React.DragEvent, status: OrderStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) {
      onUpdateStatus(orderId, status);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
        <div className="mx-auto mb-4 text-4xl">📋</div>
        <h3 className="text-lg font-bold text-white mb-2">Sin pedidos todavía</h3>
        <p className="text-sm text-slate-500">
          Los pedidos aparecerán acá cuando los clientes ordenen desde tu menú.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        const isDragOver = dragOverCol === col.status;

        return (
          <div
            key={col.status}
            className="space-y-3"
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <h3 className={`text-sm font-bold ${col.headerColor}`}>
                {col.emoji} {col.label}
              </h3>
              <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {colOrders.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={`space-y-2 min-h-[200px] rounded-xl p-1 transition-all ${
                isDragOver
                  ? `border-2 border-dashed ${col.borderColor} bg-white/5`
                  : "border-2 border-transparent"
              }`}
            >
              {colOrders.map((order) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <OrderCard
                    order={order}
                    onUpdateStatus={onUpdateStatus}
                    restaurantName={restaurantName}
                  />
                </div>
              ))}
              {colOrders.length === 0 && (
                <div className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
                  isDragOver ? "border-white/30" : "border-white/10"
                }`}>
                  <p className="text-xs text-slate-600">
                    {isDragOver ? "Soltar acá" : "Sin pedidos"}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
