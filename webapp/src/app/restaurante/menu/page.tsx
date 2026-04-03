"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MenuEditor } from "@/components/MenuEditor";

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
    fetch("/api/restaurante/menu")
      .then((r) => r.json())
      .then((d) => { setCategories(d); setLoading(false); });
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/5 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Menu</h1>
            <p className="text-xs text-slate-500">
              {loading ? "Cargando..." : `${categories.length} categorias, ${totalItems} items`}
            </p>
          </div>
          {slug && (
            <a href={`https://menusanjuan.com/${slug}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">
              Ver pagina
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <MenuEditor
            categories={categories}
            onRefresh={fetchMenu}
            apiBase="/api/restaurante/menu"
          />
        )}
      </div>
    </div>
  );
}
