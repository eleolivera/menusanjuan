"use client";

type Props = {
  amountArs: number;
};

export function CashTile({ amountArs }: Props) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/50 p-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Efectivo en mano
        </div>
        <div className="mt-1 text-2xl font-bold text-white tabular-nums">
          ${amountArs.toLocaleString("es-AR")}
        </div>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">
        💵
      </div>
    </div>
  );
}
