"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  PackageCheck,
  ChefHat,
  Wallet,
  FileText,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Analytics = {
  period: string;
  summary: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    pendingRevenue: number;
    avgOrderValue: number;
    peakHour: string;
    peakHourOrders: number;
  };
  statusBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  hourlyBreakdown: { hour: number; label: string; count: number; revenue: number }[];
  dailyBreakdown: { date: string; label: string; count: number; revenue: number; delivered: number; cancelled: number }[];
};

type ItemsAnalytics = {
  topByRevenue: Array<{ menuItemId: string | null; name: string; category: string; qty: number; revenue: number; ordersWithItem: number }>;
  topByQuantity: Array<{ menuItemId: string | null; name: string; category: string; qty: number; revenue: number; ordersWithItem: number }>;
  categoryRollup: Array<{ category: string; qty: number; revenue: number; share: number }>;
  deadSkus: Array<{ menuItemId: string; name: string; category: string; priceARS: number }>;
  attachPairs: Array<{ whenBuying: string; alsoBuys: string; bothOrders: number; whenOrders: number; rate: number }>;
};

type FulfillmentAnalytics = {
  timing: { avgMinsToDelivered: number | null; p50MinsToDelivered: number | null; p90MinsToDelivered: number | null; sample: number };
  cancelByChannel: Array<{ channel: string; total: number; cancelled: number; rate: number }>;
  receiptAttach: { nonCash: number; withReceipt: number; rate: number };
  paymentAssumed: { delivered: number; assumed: number; rate: number };
  markedDeliveredBy: Array<{ surface: string; count: number }>;
};

type Tab = "resumen" | "items" | "ops";

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "weekend", label: "Fin de Semana" },
  { value: "week", label: "Últimos 7 días" },
  { value: "month", label: "Últimos 30 días" },
];

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [items, setItems] = useState<ItemsAnalytics | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [ops, setOps] = useState<FulfillmentAnalytics | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setSlug(d.slug))
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/analytics?restaurante=${slug}&period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [slug, period]);

  // Items tab: fetch on tab-activation and period-change. On-demand keeps
  // the initial page load fast for the 90% of visits that stay on Resumen.
  useEffect(() => {
    if (!slug || tab !== "items") return;
    setItemsLoading(true);
    fetch(`/api/restaurante/analytics/items?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setItems(d); setItemsLoading(false); })
      .catch(() => setItemsLoading(false));
  }, [slug, tab, period]);

  // Ops tab: fetch fulfillment data on activation.
  useEffect(() => {
    if (!slug || tab !== "ops") return;
    setOpsLoading(true);
    fetch(`/api/restaurante/analytics/fulfillment?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setOps(d); setOpsLoading(false); })
      .catch(() => setOpsLoading(false));
  }, [slug, tab, period]);

  function handlePrint() {
    window.print();
  }

  if (!slug || loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const s = data.summary;
  const maxHourly = Math.max(...data.hourlyBreakdown.map((h) => h.count), 1);
  const maxDaily = Math.max(...data.dailyBreakdown.map((d) => d.revenue), 1);

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-slate-400">Reportes y métricas de ventas</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Imprimir Reporte
          </button>
        </div>
      </header>

      <div ref={reportRef} className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Period selector */}
        <div className="flex flex-wrap gap-2 print:hidden">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                period === p.value
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Print header (only visible when printing) */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold">MenuSanJuan — Reporte de Ventas</h1>
          <p className="text-sm text-gray-600 mt-1">
            {PERIODS.find((p) => p.value === period)?.label} — {slug}
          </p>
        </div>

        {/* Tab bar */}
        <div className="border-b border-white/5 flex gap-1 print:hidden -mt-2">
          {([
            { key: "resumen" as Tab, label: "Resumen" },
            { key: "items" as Tab, label: "Ítems" },
            { key: "ops" as Tab, label: "Operaciones" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? "text-primary border-primary"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "resumen" && <>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-2xl font-extrabold text-emerald-400 tracking-tight">
              ${fmt(s.totalRevenue)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">Ventas Totales</div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-5">
            <div className="text-2xl mb-1">📦</div>
            <div className="text-2xl font-extrabold text-blue-400 tracking-tight">
              {s.totalOrders}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">Pedidos Totales</div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5">
            <div className="text-2xl mb-1">🧾</div>
            <div className="text-2xl font-extrabold text-amber-400 tracking-tight">
              ${fmt(s.avgOrderValue)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">Ticket Promedio</div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-5">
            <div className="text-2xl mb-1">⏰</div>
            <div className="text-2xl font-extrabold text-purple-400 tracking-tight">
              {s.peakHour}hs
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Hora Pico ({s.peakHourOrders} pedidos)
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Revenue Chart */}
          {data.dailyBreakdown.length > 1 && (
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
              <h3 className="text-sm font-bold text-white mb-4">📊 Ventas por Día</h3>
              <div className="space-y-2">
                {data.dailyBreakdown.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-slate-500 shrink-0">{day.label}</span>
                    <div className="flex-1 h-7 relative">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-primary/80 to-amber-500/60"
                        style={{ width: `${Math.max((day.revenue / maxDaily) * 100, 2)}%` }}
                      />
                      <div className="absolute inset-y-0 flex items-center px-2">
                        <span className="text-[11px] font-bold text-white drop-shadow">
                          ${fmt(day.revenue)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 w-10 text-right">{day.count}p</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hourly Distribution */}
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <h3 className="text-sm font-bold text-white mb-4">⏱️ Pedidos por Hora</h3>
            <div className="flex items-end gap-1 h-40">
              {Array.from({ length: 24 }, (_, h) => {
                const hourData = data.hourlyBreakdown.find((hb) => hb.hour === h);
                const count = hourData?.count || 0;
                const pct = maxHourly > 0 ? (count / maxHourly) * 100 : 0;
                const isActive = count > 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <span className={`text-[9px] font-bold ${isActive ? "text-white" : "text-transparent"}`}>
                      {count}
                    </span>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isActive
                          ? "bg-gradient-to-t from-primary to-amber-500"
                          : "bg-white/5"
                      }`}
                      style={{ height: `${Math.max(pct, 3)}%` }}
                    />
                    {h % 3 === 0 && (
                      <span className="text-[9px] text-slate-600">{h}h</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Items + Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products */}
          <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3">
              <h3 className="text-sm font-bold text-white">🏆 Productos Más Vendidos</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500">
                  <th className="px-5 py-2.5 text-left font-semibold">#</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Producto</th>
                  <th className="px-5 py-2.5 text-center font-semibold">Cantidad</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {data.topItems.slice(0, 10).map((item, i) => (
                  <tr key={item.name} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className={`text-sm font-bold ${
                        i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-slate-500"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-sm text-white">{item.name}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-lg bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-sm text-right font-semibold text-white">
                      ${fmt(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/5">
                  <td colSpan={2} className="px-5 py-3 text-sm font-bold text-white">TOTAL</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-lg bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white">
                      {data.topItems.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-extrabold text-white">
                    ${fmt(data.topItems.reduce((s, i) => s + i.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <h3 className="inline-flex items-center gap-2 text-sm font-bold text-white mb-4">
              <ClipboardList className="h-4 w-4 text-primary" strokeWidth={2} />
              Estado de Pedidos
            </h3>
            <div className="space-y-3">
              {([
                { label: "Entregados", count: data.statusBreakdown.delivered, Icon: PackageCheck as LucideIcon, color: "bg-emerald-500" },
                { label: "En Cocina", count: data.statusBreakdown.processing, Icon: ChefHat as LucideIcon, color: "bg-blue-500" },
                { label: "Pagados", count: data.statusBreakdown.paid, Icon: Wallet as LucideIcon, color: "bg-amber-500" },
                { label: "Generados", count: data.statusBreakdown.generated, Icon: FileText as LucideIcon, color: "bg-slate-500" },
                { label: "Cancelados", count: data.statusBreakdown.cancelled, Icon: XCircle as LucideIcon, color: "bg-red-500" },
              ]).map((st) => {
                const pct = s.totalOrders > 0 ? (st.count / s.totalOrders) * 100 : 0;
                return (
                  <div key={st.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <st.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        {st.label}
                      </span>
                      <span className="text-xs font-bold text-white">{st.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${st.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick stats */}
            <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tasa de entrega</span>
                <span className="font-bold text-emerald-400">
                  {s.totalOrders > 0 ? Math.round((s.deliveredOrders / s.totalOrders) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tasa de cancelación</span>
                <span className="font-bold text-red-400">
                  {s.totalOrders > 0 ? Math.round((s.cancelledOrders / s.totalOrders) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Pendiente de cobro</span>
                <span className="font-bold text-amber-400">${fmt(s.pendingRevenue)}</span>
              </div>
            </div>
          </div>
        </div>

        </>}

        {tab === "items" && <ItemsTab data={items} loading={itemsLoading} />}

        {tab === "ops" && <OpsTab data={ops} loading={opsLoading} />}

      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .glass-dark { background: white !important; border-color: #ddd !important; }
          [class*="bg-slate"] { background: white !important; }
          [class*="border-white"] { border-color: #ddd !important; }
          [class*="text-white"] { color: black !important; }
          [class*="text-slate"] { color: #666 !important; }
          [class*="text-emerald"], [class*="text-blue"], [class*="text-amber"], [class*="text-purple"], [class*="text-primary"], [class*="text-red"] { color: #333 !important; }
          [class*="from-primary"], [class*="from-emerald"], [class*="from-blue"], [class*="from-amber"] { background: #eee !important; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Ítems tab ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS = ["#f97316", "#f59e0b", "#eab308", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444"];

function ItemsTab({ data, loading }: { data: ItemsAnalytics | null; loading: boolean }) {
  if (loading || !data) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  const hasData = data.topByRevenue.length > 0;
  if (!hasData) {
    return <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center text-sm text-slate-400">No hay ventas en este período todavía.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top by revenue */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
        <h3 className="text-sm font-bold text-white mb-4">💰 Top ítems por ingresos</h3>
        <ResponsiveContainer width="100%" height={Math.max(240, data.topByRevenue.length * 34)}>
          <BarChart data={data.topByRevenue.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#ffffff10" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${(v as number).toLocaleString("es-AR")}`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#e2e8f0", fontSize: 11 }} width={140} interval={0} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
              formatter={(v, k) => k === "revenue" ? [`$${(v as number).toLocaleString("es-AR")}`, "Ingresos"] : [v, k]}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: category rollup + top-by-quantity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-4">🏷️ Ingresos por categoría</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.categoryRollup}
                dataKey="revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(props: any) => `${props.category ?? ""} ${((props.share ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.categoryRollup.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => `$${(v as number).toLocaleString("es-AR")}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-4">🔥 Más vendidos (cantidad)</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.topByQuantity.slice(0, 10).map((it, i) => (
              <div key={it.menuItemId || it.name} className="flex items-center gap-3">
                <span className="w-6 text-xs font-bold text-slate-500">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{it.name}</div>
                  <div className="text-[11px] text-slate-500">{it.category}</div>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">{it.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attach pairs */}
      {data.attachPairs.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-1">🤝 Se llevan juntos</h3>
          <p className="text-xs text-slate-500 mb-4">Cuando alguien pide el primero, con qué frecuencia también lleva el segundo.</p>
          <div className="space-y-2">
            {data.attachPairs.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="text-white truncate flex-1">{p.whenBuying}</span>
                <span className="text-slate-500">→</span>
                <span className="text-white truncate flex-1">{p.alsoBuys}</span>
                <span className="font-bold text-primary whitespace-nowrap">{(p.rate * 100).toFixed(0)}%</span>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">({p.bothOrders}/{p.whenOrders})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dead SKUs */}
      {data.deadSkus.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-1">💤 Sin ventas en este período</h3>
          <p className="text-xs text-slate-500 mb-4">Ítems disponibles que no se vendieron. Considerá promocionarlos o revisarlos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {data.deadSkus.map((sku) => (
              <div key={sku.menuItemId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="text-white truncate">{sku.name}</div>
                  <div className="text-[11px] text-slate-500">{sku.category}</div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">${sku.priceARS.toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Operaciones tab ───────────────────────────────────────────────────────

function OpsTab({ data, loading }: { data: FulfillmentAnalytics | null; loading: boolean }) {
  if (loading || !data) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  const t = data.timing;
  const totalMarked = data.markedDeliveredBy.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      {/* Timing tiles */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3">⏱️ Tiempo a entrega</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Promedio" value={t.avgMinsToDelivered != null ? `${t.avgMinsToDelivered} min` : "—"} tint="emerald" />
          <StatTile label="Mediana (p50)" value={t.p50MinsToDelivered != null ? `${t.p50MinsToDelivered} min` : "—"} tint="blue" />
          <StatTile label="Alto (p90)" value={t.p90MinsToDelivered != null ? `${t.p90MinsToDelivered} min` : "—"} tint="amber" hint={`sobre ${t.sample.toLocaleString("es-AR")} entregados`} />
        </div>
      </div>

      {/* Cancel by channel */}
      {data.cancelByChannel.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-3">🚫 Cancelación por canal</h3>
          <div className="space-y-3">
            {data.cancelByChannel.map((c) => (
              <div key={c.channel}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{c.channel}</span>
                  <span className="text-slate-300"><b>{c.cancelled}</b> de {c.total} · <span className="text-red-400 font-bold">{(c.rate * 100).toFixed(1)}%</span></span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${c.rate * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment reconciliation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Comprobantes</h4>
          <div className="text-2xl font-extrabold text-white">{(data.receiptAttach.rate * 100).toFixed(0)}%</div>
          <p className="text-xs text-slate-500 mt-1">
            {data.receiptAttach.withReceipt} de {data.receiptAttach.nonCash} pedidos no-efectivo con comprobante adjunto
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Cobros asumidos</h4>
          <div className="text-2xl font-extrabold text-white">{(data.paymentAssumed.rate * 100).toFixed(0)}%</div>
          <p className="text-xs text-slate-500 mt-1">
            {data.paymentAssumed.assumed} de {data.paymentAssumed.delivered} entregas marcadas pagadas sin verificar
          </p>
        </div>
      </div>

      {/* markedDeliveredBy */}
      {totalMarked > 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <h3 className="text-sm font-bold text-white mb-1">📦 Quién cierra los pedidos</h3>
          <p className="text-xs text-slate-500 mb-4">En qué superficie se marca DELIVERED cada pedido.</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.markedDeliveredBy}
                dataKey="count"
                nameKey="surface"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(props: any) => `${props.surface ?? ""} (${props.count ?? 0})`}
                labelLine={false}
              >
                {data.markedDeliveredBy.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, hint, tint }: { label: string; value: string; hint?: string; tint: "emerald" | "blue" | "amber" }) {
  const color = tint === "emerald" ? "text-emerald-400" : tint === "blue" ? "text-blue-400" : "text-amber-400";
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
      <div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-extrabold tracking-tight mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-600 mt-1">{hint}</div>}
    </div>
  );
}
