"use client";

import type { Order } from "@/lib/orders-store";

export function OrderTotals({ orders }: { orders: Order[] }) {
  const generated = orders.filter((o) => o.status === "GENERATED");
  const paid = orders.filter((o) => o.status === "PAID");
  const processing = orders.filter((o) => o.status === "PROCESSING");
  const delivered = orders.filter((o) => o.status === "DELIVERED");

  // Revenue from paid + processing + delivered
  const activeOrders = [...paid, ...processing, ...delivered];
  const activeTotal = activeOrders.reduce((s, o) => s + o.total, 0);

  // Aggregate item consumption across active orders
  const itemAggregation: Record<string, { name: string; quantity: number; total: number }> = {};
  for (const order of activeOrders) {
    for (const item of order.items) {
      if (itemAggregation[item.name]) {
        itemAggregation[item.name].quantity += item.quantity;
        itemAggregation[item.name].total += item.total;
      } else {
        itemAggregation[item.name] = {
          name: item.name,
          quantity: item.quantity,
          total: item.total,
        };
      }
    }
  }
  const aggregatedItems = Object.values(itemAggregation).sort(
    (a, b) => b.quantity - a.quantity
  );

  const stats = [
    {
      label: "Nuevos",
      count: generated.length,
      emoji: "📝",
      color: "border-amber-500/20 from-amber-500/10 to-amber-600/5",
      textColor: "text-amber-400",
    },
    {
      label: "Pagados",
      count: paid.length,
      emoji: "💰",
      color: "border-emerald-500/20 from-emerald-500/10 to-emerald-600/5",
      textColor: "text-emerald-400",
    },
    {
      label: "En Cocina",
      count: processing.length,
      emoji: "🔄",
      color: "border-blue-500/20 from-blue-500/10 to-blue-600/5",
      textColor: "text-blue-400",
    },
    {
      label: "Entregados",
      count: delivered.length,
      emoji: "✅",
      color: "border-slate-500/20 from-slate-500/10 to-slate-600/5",
      textColor: "text-slate-400",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border bg-gradient-to-br ${stat.color} p-5 backdrop-blur-sm`}
          >
            <div className="text-2xl mb-2">{stat.emoji}</div>
            <div className={`text-2xl font-extrabold ${stat.textColor} tracking-tight`}>
              {stat.count}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Consumption totals table */}
      {aggregatedItems.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <h3 className="text-sm font-bold text-white">
              🧾 Consumo Total
            </h3>
            <span className="text-xs text-slate-500">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? "s" : ""} activo{activeOrders.length !== 1 ? "s" : ""}
            </span>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500">
                <th className="px-5 py-2.5 text-left font-semibold">Producto</th>
                <th className="px-5 py-2.5 text-center font-semibold">Cantidad</th>
                <th className="px-5 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedItems.map((item) => (
                <tr
                  key={item.name}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="px-5 py-2.5 text-sm text-white">{item.name}</td>
                  <td className="px-5 py-2.5 text-sm text-center">
                    <span className="inline-flex items-center justify-center rounded-lg bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-semibold text-white">
                    ${item.total.toLocaleString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-white/5">
                <td className="px-5 py-3 text-sm font-bold text-white">TOTAL</td>
                <td className="px-5 py-3 text-sm text-center">
                  <span className="inline-flex items-center justify-center rounded-lg bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white">
                    {aggregatedItems.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-right font-extrabold text-white">
                  ${activeTotal.toLocaleString("es-AR")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
