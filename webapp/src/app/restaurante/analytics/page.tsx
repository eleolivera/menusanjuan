"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/restaurante")}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard</h1>
              <p className="text-sm text-slate-400">Reportes y métricas de ventas</p>
            </div>
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
            <h3 className="text-sm font-bold text-white mb-4">📋 Estado de Pedidos</h3>
            <div className="space-y-3">
              {[
                { label: "Entregados", count: data.statusBreakdown.delivered, emoji: "✅", color: "bg-emerald-500" },
                { label: "En Cocina", count: data.statusBreakdown.processing, emoji: "🔄", color: "bg-blue-500" },
                { label: "Pagados", count: data.statusBreakdown.paid, emoji: "💰", color: "bg-amber-500" },
                { label: "Generados", count: data.statusBreakdown.generated, emoji: "📝", color: "bg-slate-500" },
                { label: "Cancelados", count: data.statusBreakdown.cancelled, emoji: "❌", color: "bg-red-500" },
              ].map((st) => {
                const pct = s.totalOrders > 0 ? (st.count / s.totalOrders) * 100 : 0;
                return (
                  <div key={st.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">
                        {st.emoji} {st.label}
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
