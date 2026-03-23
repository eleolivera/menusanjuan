"use client";

import Link from "next/link";

export function RestauranteSidebar({
  restaurantName,
  slug,
  onLogout,
}: {
  restaurantName: string;
  slug: string;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-slate-900">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg shadow-md shadow-primary/25">
          {restaurantName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">
            {restaurantName}
          </div>
          <div className="text-xs text-slate-500">Panel de Control</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="rounded-lg bg-primary/15 px-3 py-2.5 text-sm font-medium text-primary-light">
          <span className="mr-2">📋</span> Pedidos
        </div>
        <Link
          href={`/${slug}`}
          target="_blank"
          className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-colors"
        >
          <span className="mr-2">🍽️</span> Ver Menú Público
        </Link>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-4">
        <button
          onClick={onLogout}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
