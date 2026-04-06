"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PosBoard } from "@/components/restaurante/pos/PosBoard";

export default function PosPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [posEnabled, setPosEnabled] = useState<boolean | null>(null);
  const [tableSuggestions, setTableSuggestions] = useState<string[]>([]);

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

  if (!slug || posEnabled === null) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!posEnabled) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl text-white font-bold">$</div>
          <h2 className="text-xl font-bold text-white mb-2">POS no esta habilitado</h2>
          <p className="text-sm text-slate-400 mb-6">
            Activa el POS desde tu perfil para empezar a tomar pedidos en el local. Funciona en tablet o celular, ideal para mostrador o mesas.
          </p>
          <Link href="/restaurante/profile#pos" className="inline-flex rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all">
            Habilitar POS
          </Link>
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
