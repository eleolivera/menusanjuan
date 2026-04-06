"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PosBoard } from "@/components/restaurante/pos/PosBoard";

export default function PosPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [posEnabled, setPosEnabled] = useState<boolean | null>(null);
  const [tableSuggestions, setTableSuggestions] = useState<string[]>([]);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        setSlug(data.slug);
        setRestaurantName(data.name || data.slug);
      })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  useEffect(() => {
    if (!slug) return;
    fetch("/api/restaurante/pos/info")
      .then((r) => r.json())
      .then((d) => {
        setPosEnabled(d.posEnabled ?? false);
        setTableSuggestions(d.tableSuggestions || []);
      });
  }, [slug]);

  async function enablePos() {
    setEnabling(true);
    const res = await fetch("/api/restaurante/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posEnabled: true }),
    });
    if (res.ok) setPosEnabled(true);
    setEnabling(false);
  }

  if (!slug || posEnabled === null) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!posEnabled) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl text-white font-bold shadow-lg shadow-primary/25">$</div>
            <h2 className="text-xl font-bold text-white">POS — Pedidos en el local</h2>
            <p className="text-sm text-slate-400 mt-2">
              Toma pedidos desde tu tablet o celular para mesas y mostrador. Los pedidos van directo a la cocina con el pago ya cobrado.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 mb-4 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>Cobra en efectivo, tarjeta, transferencia o Mercado Pago</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>Calculadora de vuelto automatica para efectivo</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>Pedidos por mesa o mostrador, todo en el mismo Kanban de cocina</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>Modifica precios o regala items con notas (cortesia, promo, etc.)</span>
            </div>
          </div>

          <button
            onClick={enablePos}
            disabled={enabling}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-4 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {enabling ? "Habilitando..." : "Habilitar POS"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PosBoard
      slug={slug}
      restaurantName={restaurantName}
      tableSuggestions={tableSuggestions}
      onSuggestionsUpdate={setTableSuggestions}
    />
  );
}
