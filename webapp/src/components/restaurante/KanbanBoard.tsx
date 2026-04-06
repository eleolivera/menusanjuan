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
  const [channelFilter, setChannelFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "ALL";
    return localStorage.getItem("kanban-channel-filter") || "ALL";
  });

  function setFilter(f: string) {
    setChannelFilter(f);
    if (typeof window !== "undefined") localStorage.setItem("kanban-channel-filter", f);
  }

  const filteredOrders = channelFilter === "ALL" ? orders : orders.filter((o) => (o.channel || "ONLINE") === channelFilter);

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

  const FILTER_CHIPS = [
    { value: "ALL", label: "Todos", count: orders.length },
    { value: "ONLINE", label: "Online", count: orders.filter((o) => (o.channel || "ONLINE") === "ONLINE").length },
    { value: "DINE_IN", label: "Salon", count: orders.filter((o) => o.channel === "DINE_IN").length },
    { value: "COUNTER", label: "Mostrador", count: orders.filter((o) => o.channel === "COUNTER").length },
  ];

  return (
    <>
      {/* Filter chips */}
      <div className="shrink-0 flex gap-1.5 mb-2 overflow-x-auto">
        {FILTER_CHIPS.map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)}
            className={`shrink-0 rounded-lg px-3 py-1 text-[10px] font-semibold transition-all ${
              channelFilter === c.value ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"
            }`}>
            {c.label} <span className="opacity-60">({c.count})</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 flex-1" style={{ minHeight: 0 }}>
        {COLUMNS.map((col) => {
          const colOrders = filteredOrders.filter((o) => o.status === col.status)
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

                  const channel = order.channel || "ONLINE";
                  const stripeColor = channel === "DINE_IN" ? "bg-cyan-400" : channel === "COUNTER" ? "bg-purple-400" : "bg-blue-400";
                  const channelLabel = channel === "DINE_IN" ? `Mesa ${order.tableNumber || ""}` : channel === "COUNTER" ? "Mostrador" : (order.deliveryMethod === "pickup" ? "Retiro" : "Delivery");
                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                      className="rounded-xl border border-white/5 bg-slate-800/50 p-3 hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden"
                    >
                      {/* Channel stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripeColor}`} />
                      <div className="flex items-start justify-between mb-1 ml-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-primary">{order.orderNumber}</span>
                          {order.paymentStatus === "PAID" && <span className="rounded bg-emerald-400/15 px-1 text-[8px] font-bold text-emerald-400">PAGADO</span>}
                        </div>
                        <span className="text-[10px] text-slate-600">{timeAgo(order.createdAt)}</span>
                      </div>
                      <p className="text-xs font-medium text-white truncate ml-1">{order.customerName}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 ml-1">{itemSummary}{more}</p>
                      <div className="flex items-center justify-between mt-1.5 ml-1">
                        <span className="text-xs font-bold text-white">{formatARS(order.total)}</span>
                        <span className="text-[9px] text-slate-600">{channelLabel}</span>
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
