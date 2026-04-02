"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/restaurante/KanbanBoard";
import type { Order, OrderStatus } from "@/lib/orders-store";

export default function AdminOrdersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState(slug);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.authenticated) setAuthed(true);
        else window.location.href = "/admin";
      })
      .catch(() => { window.location.href = "/admin"; });
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch(`/api/admin/restaurants?slug=${slug}`)
      .then((r) => r.ok ? r.json() : [])
      .then((restas) => {
        const r = restas.find?.((r: any) => r.slug === slug);
        if (r) setRestaurantName(r.name);
      })
      .catch(() => {});
  }, [authed, slug]);

  const fetchOrders = useCallback(() => {
    if (!authed) return;
    fetch(`/api/orders?restaurante=${slug}`)
      .then((r) => r.json())
      .then((d) => { setOrders(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authed, slug]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o));
  }

  if (!authed) return <div className="h-screen bg-slate-950" />;

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-slate-500 hover:text-white transition-colors text-sm">← Admin</a>
          <h1 className="text-sm font-bold text-white">{restaurantName}</h1>
          <span className="text-xs text-slate-500">{orders.length} pedidos hoy</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={`https://menusanjuan.com/${slug}`} target="_blank" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-400 hover:bg-white/5 transition-colors">Ver pagina</a>
          <button onClick={fetchOrders} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-400 hover:bg-white/5 transition-colors">Actualizar</button>
        </div>
      </div>
      <div className="flex-1 px-3 py-2 flex flex-col" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <KanbanBoard orders={orders} onUpdateStatus={updateStatus} restaurantName={restaurantName} />
        )}
      </div>
    </div>
  );
}
