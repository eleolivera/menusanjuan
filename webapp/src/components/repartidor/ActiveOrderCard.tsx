"use client";

import Link from "next/link";

type Props = {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerAddress: string | null;
    total: number;
    deliveryFee: number;
    pickedUpAt: string | null;
    restaurantName: string;
  };
};

export function ActiveOrderCard({ order }: Props) {
  const stage = order.pickedUpAt ? "En camino" : "Retirar";
  const stageClass = order.pickedUpAt
    ? "bg-blue-500/20 text-blue-300"
    : "bg-amber-500/20 text-amber-300";
  const totalAll = Math.round(order.total + order.deliveryFee);

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-slate-900/60 to-slate-900/50 p-5 shadow-lg shadow-primary/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Pedido activo
        </span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${stageClass}`}>
          {stage}
        </span>
      </div>

      <div className="mb-1 text-lg font-bold text-white">{order.restaurantName}</div>
      <div className="text-xs text-slate-400">#{order.orderNumber}</div>

      {order.customerAddress && (
        <div className="mt-3 rounded-xl border border-white/5 bg-white/5 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Entregar a
          </div>
          <div className="text-sm text-white">{order.customerName}</div>
          <div className="mt-0.5 text-xs text-slate-400">📍 {order.customerAddress}</div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <div className="text-xs text-slate-500">Total a cobrar</div>
          <div className="font-bold text-white">
            ${totalAll.toLocaleString("es-AR")}
          </div>
        </div>
        <Link
          href={`/repartidor/pedido/${order.id}`}
          className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          Continuar
        </Link>
      </div>
    </div>
  );
}
