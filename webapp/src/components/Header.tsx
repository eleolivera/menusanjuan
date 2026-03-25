"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type SessionData = {
  authenticated: boolean;
  slug: string;
  name: string;
  logoUrl?: string;
} | null;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<SessionData>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setSession(data);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/restaurante/session", { method: "DELETE" });
    setSession(null);
    setShowMenu(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
            M
          </div>
          <span className="text-xl font-extrabold tracking-tight text-text">
            Menu<span className="gradient-text">SJ</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Inicio
          </Link>
          <Link
            href="/#restaurantes"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Restaurantes
          </Link>
          <Link
            href="/#como-funciona"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Cómo Funciona
          </Link>

          {session ? (
            /* Logged in — show restaurant name + dropdown */
            <div className="relative ml-2">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-1.5 text-sm font-medium text-text hover:border-primary/40 transition-all"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-xs font-bold overflow-hidden">
                  {session.logoUrl ? (
                    <img src={session.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    session.name?.charAt(0) || "R"
                  )}
                </div>
                <span className="max-w-[120px] truncate">{session.name}</span>
                <svg className={`h-3.5 w-3.5 text-text-muted transition-transform ${showMenu ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-fade-in z-50">
                  <div className="px-4 py-3 border-b border-border/50">
                    <div className="text-sm font-semibold text-text truncate">{session.name}</div>
                    <div className="text-[11px] text-text-muted">menusanjuan.com/{session.slug}</div>
                  </div>
                  <div className="py-1">
                    <Link href="/restaurante"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
                      <span className="text-base">📋</span> Pedidos
                    </Link>
                    <Link href="/restaurante/menu"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
                      <span className="text-base">🍽️</span> Mi Menú
                    </Link>
                    <Link href="/restaurante/analytics"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
                      <span className="text-base">📊</span> Analíticas
                    </Link>
                    <Link href="/restaurante/profile"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
                      <span className="text-base">⚙️</span> Mi Restaurante
                    </Link>
                    <Link href={`/${session.slug}`}
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
                      <span className="text-base">👁️</span> Ver Página Pública
                    </Link>
                  </div>
                  <div className="border-t border-border/50 py-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-muted hover:text-danger hover:bg-red-50 transition-all">
                      <span className="text-base">🚪</span> Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Not logged in */
            <Link
              href="/restaurante/login"
              className="ml-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
            >
              Soy Restaurante
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-lg p-2 text-text-secondary hover:bg-primary/5 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 glass animate-slide-in-right">
          <nav className="flex flex-col gap-1 px-4 py-3">
            <Link href="/" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}>Inicio</Link>
            <Link href="/#restaurantes" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}>Restaurantes</Link>
            <Link href="/#como-funciona" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}>Cómo Funciona</Link>

            {session ? (
              <>
                <div className="mt-2 mb-1 px-3 py-2 rounded-lg bg-surface-alt">
                  <div className="text-sm font-semibold text-text">{session.name}</div>
                  <div className="text-[11px] text-text-muted">/{session.slug}</div>
                </div>
                <Link href="/restaurante" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
                  onClick={() => setMobileOpen(false)}>📋 Pedidos</Link>
                <Link href="/restaurante/menu" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
                  onClick={() => setMobileOpen(false)}>🍽️ Mi Menú</Link>
                <Link href="/restaurante/analytics" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
                  onClick={() => setMobileOpen(false)}>📊 Analíticas</Link>
                <Link href="/restaurante/profile" className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
                  onClick={() => setMobileOpen(false)}>⚙️ Mi Restaurante</Link>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-muted hover:text-danger transition-all">
                  🚪 Cerrar Sesión
                </button>
              </>
            ) : (
              <Link href="/restaurante/login"
                className="mt-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all"
                onClick={() => setMobileOpen(false)}>Soy Restaurante</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
