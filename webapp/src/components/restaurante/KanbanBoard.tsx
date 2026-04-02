"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { OrderCard } from "./OrderCard";
import { ORDER_STATUSES } from "@/lib/admin-config";
import { timeAgo, formatARS } from "@/lib/admin-utils";

const COLUMNS = ORDER_STATUSES;

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
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, orderId: string) {
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: OrderStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }

  function handleDrop(e: React.DragEvent, status: OrderStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) onUpdateStatus(orderId, status);
  }

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-bold text-white mb-2">Sin pedidos</h3>
          <p className="text-sm text-slate-500">Los pedidos aparecen aca cuando los clientes ordenen.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 flex-1" style={{ minHeight: 0 }}>
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const isDragOver = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              className={`min-w-[220px] flex-1 rounded-2xl border p-3 transition-colors flex flex-col ${
                isDragOver ? "border-primary/50 bg-primary/5" : "border-white/5 bg-slate-900/30"
              } ${col.status === "CANCELLED" ? "opacity-60" : ""}`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${col.bgColor} ${col.color}`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                {colOrders.map((order) => {
                  const items = (typeof order.items === "string" ? JSON.parse(order.items) : order.items) as any[];
                  const itemSummary = items.slice(0, 2).map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
                  const more = items.length > 2 ? ` +${items.length - 2}` : "";

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                      className="rounded-xl border border-white/5 bg-slate-800/50 p-3 hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-primary">{order.orderNumber}</span>
                        <span className="text-[10px] text-slate-600">{timeAgo(order.createdAt)}</span>
                      </div>
                      <p className="text-xs font-medium text-white truncate">{order.customerName}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{itemSummary}{more}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold text-white">{formatARS(order.total)}</span>
                        <span className="text-[9px] text-slate-600">
                          {order.deliveryMethod === "pickup" ? "Retiro" : "Delivery"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {colOrders.length === 0 && (
                  <div className={`rounded-xl border border-dashed py-8 text-center ${isDragOver ? "border-white/30" : "border-white/10"}`}>
                    <p className="text-xs text-slate-600">{isDragOver ? "Soltar aca" : "Sin pedidos"}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (() => {
        const order = orders.find((o) => o.id === selectedOrder);
        if (!order) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-slate-950 rounded-2xl border border-white/10 p-1" onClick={(e) => e.stopPropagation()}>
              <OrderCard order={order} onUpdateStatus={onUpdateStatus} restaurantName={restaurantName} />
              <div className="px-4 pb-3">
                <button onClick={() => setSelectedOrder(null)} className="w-full rounded-xl border border-white/10 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
