"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MenuEditor } from "@/components/MenuEditor";
import { PresetManager } from "@/components/PresetManager";

type Category = {
  id: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
  items: any[];
};

export default function MenuManagementPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [tab, setTab] = useState<"menu" | "listas">("menu");

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setSlug(data.slug); })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  useEffect(() => {
    if (!slug) return;
    fetchMenu();
  }, [slug]);

  function fetchMenu() {
    return fetch("/api/restaurante/menu")
      .then((r) => r.json())
      .then((d) => { setCategories(d); setLoading(false); });
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/5 px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Menú</h1>
            <p className="text-xs text-slate-500">
              {loading ? "Cargando..." : `${categories.length} categorías, ${totalItems} items`}
            </p>
          </div>
          {slug && (
            <a href={`https://menusanjuan.com/${slug}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">
              Ver página
            </a>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab("menu")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "menu" ? "bg-primary/15 text-primary" : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            🍽️ Categorías e Items
          </button>
          <button
            onClick={() => setTab("listas")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "listas" ? "bg-primary/15 text-primary" : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            📋 Listas de Opciones
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : tab === "menu" ? (
          <MenuEditor
            categories={categories}
            onRefresh={fetchMenu}
            apiBase="/api/restaurante/menu"
          />
        ) : (
          <div>
            <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4 mb-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Las listas de opciones son conjuntos de variantes que podés reusar en varios items.
                Por ejemplo, una heladería crea la lista <strong className="text-white">"Gustos"</strong> una vez
                y la asigna a todos los tamaños de helado. Si un gusto se queda sin stock,
                lo desactivás acá y se oculta en todos los items que lo usan.
              </p>
            </div>
            <PresetManager />
          </div>
        )}
      </div>
    </div>
  );
}
