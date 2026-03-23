"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { KanbanBoard } from "@/components/restaurante/KanbanBoard";
import { RestauranteSidebar } from "@/components/restaurante/RestauranteSidebar";
import { OrderTotals } from "@/components/restaurante/OrderTotals";

export default function RestauranteDashboard() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Check session
  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => setSlug(data.slug))
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  // Fetch orders
  const fetchOrders = useCallback(() => {
    if (!slug) return;
    fetch(`/api/orders?restaurante=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    fetchOrders();
    // Poll every 10 seconds for new orders
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Update order status
  async function updateStatus(orderId: string, status: OrderStatus) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
      )
    );
  }

  async function handleLogout() {
    await fetch("/api/restaurante/session", { method: "DELETE" });
    router.push("/restaurante/login");
  }

  const restaurant = DEMO_RESTAURANTS.find((r) => r.slug === slug);

  if (!slug || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <RestauranteSidebar
        restaurantName={restaurant?.name || slug}
        slug={slug}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Pedidos</h1>
              <p className="text-sm text-slate-400">
                {orders.length} pedido{orders.length !== 1 ? "s" : ""} total
                {orders.length > 0 && " · "}
                {orders.filter((o) => o.status === "GENERATED").length > 0 && (
                  <span className="text-amber-400">
                    {orders.filter((o) => o.status === "GENERATED").length} nuevo{orders.filter((o) => o.status === "GENERATED").length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Totals */}
          <OrderTotals orders={orders} />

          {/* Kanban */}
          <KanbanBoard orders={orders} onUpdateStatus={updateStatus} />
        </div>
      </div>
    </div>
  );
}
