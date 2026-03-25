"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { KanbanBoard } from "@/components/restaurante/KanbanBoard";
import { RestauranteSidebar } from "@/components/restaurante/RestauranteSidebar";
import { OrderTotals } from "@/components/restaurante/OrderTotals";

// Get today's date in AR timezone as YYYY-MM-DD
function getArDateString(offset = 0): string {
  const now = new Date();
  const arTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // If before 6am AR, we're still on the previous business day
  if (arTime.getUTCHours() < 6 && offset === 0) {
    arTime.setUTCDate(arTime.getUTCDate() - 1);
  }
  if (offset !== 0) {
    arTime.setUTCDate(arTime.getUTCDate() + offset);
  }
  return arTime.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const today = getArDateString(0);
  const yesterday = getArDateString(-1);

  if (dateStr === today) return "Hoy";
  if (dateStr === yesterday) return "Ayer";

  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function RestauranteDashboard() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getArDateString(0));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isToday = selectedDate === getArDateString(0);

  // Check session
  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => {
        setSlug(data.slug);
        setRestaurantName(data.name || data.slug);
      })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  // Fetch orders for selected date
  const initialLoadDone = useRef(false);
  const fetchOrders = useCallback(() => {
    if (!slug) return;
    // Only show loading spinner on first load or date change, not on polls
    if (!initialLoadDone.current) setLoading(true);
    const dateParam = isToday ? "" : `&date=${selectedDate}`;
    fetch(`/api/orders?restaurante=${slug}${dateParam}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
        initialLoadDone.current = true;
      });
  }, [slug, selectedDate, isToday]);

  // Reset loading state when date changes
  useEffect(() => {
    initialLoadDone.current = false;
  }, [selectedDate]);

  useEffect(() => {
    fetchOrders();
    // Only auto-poll for today
    if (isToday) {
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchOrders, isToday]);

  // Navigate dates
  function goBack() {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev.toISOString().split("T")[0]);
  }

  function goForward() {
    const today = getArDateString(0);
    if (selectedDate >= today) return; // can't go past today
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next.toISOString().split("T")[0]);
  }

  function goToday() {
    setSelectedDate(getArDateString(0));
  }

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
    window.location.href = "/";
  }

  const newOrders = orders.filter((o) => o.status === "GENERATED").length;

  if (!slug) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <RestauranteSidebar
        restaurantName={restaurantName || slug}
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
                {loading ? "Cargando..." : (
                  <>
                    {orders.length} pedido{orders.length !== 1 ? "s" : ""}
                    {newOrders > 0 && (
                      <span className="text-amber-400">
                        {" · "}{newOrders} nuevo{newOrders !== 1 ? "s" : ""}
                      </span>
                    )}
                    {!isToday && (
                      <span className="text-slate-500"> · vista histórica</span>
                    )}
                  </>
                )}
              </p>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-2">
              {/* Back */}
              <button
                onClick={goBack}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Date display / picker */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    isToday
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/10 bg-white/5 text-white"
                  }`}
                >
                  {formatDateLabel(selectedDate)}
                </button>

                {showDatePicker && (
                  <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-white/10 bg-slate-900 p-3 shadow-xl">
                    <input
                      type="date"
                      value={selectedDate}
                      max={getArDateString(0)}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setShowDatePicker(false);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                    {!isToday && (
                      <button
                        onClick={() => { goToday(); setShowDatePicker(false); }}
                        className="mt-2 w-full rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
                      >
                        Ir a Hoy
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Forward */}
              <button
                onClick={goForward}
                disabled={isToday}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Today shortcut */}
              {!isToday && (
                <button
                  onClick={goToday}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
                >
                  Hoy
                </button>
              )}

              {/* Refresh (only for today) */}
              {isToday && (
                <button
                  onClick={fetchOrders}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                >
                  ↻
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Historical banner */}
              {!isToday && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">📅</span>
                    <span className="text-sm text-amber-300">
                      Viendo pedidos del <strong>{formatDateLabel(selectedDate)}</strong>
                    </span>
                  </div>
                  <button
                    onClick={goToday}
                    className="text-xs font-medium text-amber-400 hover:text-amber-300 underline transition-colors"
                  >
                    Volver a hoy
                  </button>
                </div>
              )}

              {/* Totals */}
              <OrderTotals orders={orders} />

              {/* Kanban */}
              <KanbanBoard orders={orders} onUpdateStatus={updateStatus} restaurantName={restaurantName || slug} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
