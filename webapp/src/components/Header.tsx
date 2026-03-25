"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

type RestaurantInfo = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
};

type SessionData = {
  authenticated: boolean;
  user: { id: string; name: string; email: string };
  restaurants: RestaurantInfo[];
  activeRestaurant: RestaurantInfo | null;
  pendingClaims: { id: string; status: string; dealer: { name: string; slug: string } }[];
} | null;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<SessionData>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setSession(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showMenu]);

  async function handleLogout() {
    await fetch("/api/restaurante/session", { method: "DELETE" });
    setSession(null);
    setShowMenu(false);
    setMobileOpen(false);
  }

  const hasRestaurants = session?.restaurants && session.restaurants.length > 0;
  const hasPendingClaims = session?.pendingClaims && session.pendingClaims.length > 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
            M
          </div>
          <span className="text-xl font-extrabold tracking-tight text-text">
            Menu<span className="gradient-text">SJ</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 mr-2">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Inicio
            </Link>
            <Link href="/#restaurantes" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Restaurantes
            </Link>
            <Link href="/#como-funciona" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Cómo Funciona
            </Link>
          </nav>

          {/* "Soy Restaurante" — always visible if not a restaurant owner yet */}
          {(!session || !hasRestaurants) && (
            <Link
              href="/restaurante/register"
              className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-primary to-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              Soy Restaurante
            </Link>
          )}

          {/* User button */}
          {session ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setShowMenu(!showMenu); setMobileOpen(false); }}
                className="flex items-center gap-2 rounded-xl border border-border/60 px-2.5 py-1.5 text-sm font-medium text-text hover:border-primary/40 transition-all"
              >
                <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-text-secondary shrink-0">
                  {session.user.name?.charAt(0)?.toUpperCase() || "U"}
                  {hasPendingClaims && (
                    <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-white" />
                  )}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate text-sm">{session.user.name}</span>
                <svg className={`h-3.5 w-3.5 text-text-muted transition-transform shrink-0 ${showMenu ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-surface shadow-xl overflow-hidden animate-fade-in z-50 max-h-[80vh] overflow-y-auto">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border/50 bg-surface-alt">
                    <div className="text-sm font-semibold text-text">{session.user.name}</div>
                    <div className="text-[11px] text-text-muted">{session.user.email}</div>
                  </div>

                  {/* Restaurants section */}
                  {hasRestaurants && (
                    <div className="py-1.5 border-b border-border/50">
                      <div className="px-4 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">Mis Restaurantes</div>
                      {session.restaurants.map((r) => (
                        <Link
                          key={r.slug}
                          href="/restaurante"
                          onClick={async () => {
                            await fetch("/api/restaurante/session", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ slug: r.slug }),
                            });
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-[10px] font-bold overflow-hidden shrink-0">
                            {r.logoUrl ? <img src={r.logoUrl} alt="" className="h-full w-full object-cover" /> : r.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.name}</div>
                            <div className="text-[10px] text-text-muted">/{r.slug}</div>
                          </div>
                        </Link>
                      ))}
                      <Link href="/restaurante/register" onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/5 transition-all">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-dashed border-primary/30 text-primary text-sm">+</span>
                        Agregar restaurante
                      </Link>
                    </div>
                  )}

                  {/* No restaurants — CTA */}
                  {!hasRestaurants && (
                    <div className="px-4 py-3 border-b border-border/50">
                      <Link href="/restaurante/register" onClick={() => setShowMenu(false)}
                        className="block text-center rounded-lg bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                        Registrar mi restaurante
                      </Link>
                    </div>
                  )}

                  {/* Pending claims */}
                  {hasPendingClaims && (
                    <div className="py-1.5 border-b border-border/50">
                      <div className="px-4 py-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider">Reclamos Pendientes</div>
                      {session.pendingClaims.map((c: any) => (
                        <Link key={c.id} href={`/${c.dealer.slug}`} onClick={() => setShowMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-all">
                          <span className="text-xs">⏳</span>
                          <span className="truncate">{c.dealer.name}</span>
                          <span className="ml-auto text-[10px] text-amber-400">
                            {c.status === "CODE_SENT" ? "Ingresar código" : "Pendiente"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Logout */}
                  <div className="py-1.5">
                    <button onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-muted hover:text-danger hover:bg-red-50 transition-all">
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/restaurante/login"
              className="rounded-xl border border-border/60 px-3 py-2 text-xs sm:text-sm font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-all"
            >
              Iniciar Sesión
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-lg p-2 text-text-secondary hover:bg-primary/5 transition-colors"
            onClick={() => { setMobileOpen(!mobileOpen); setShowMenu(false); }}
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
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 glass animate-slide-in-right">
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            <Link href="/" onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Inicio
            </Link>
            <Link href="/#restaurantes" onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Restaurantes
            </Link>
            <Link href="/#como-funciona" onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
              Cómo Funciona
            </Link>
            {(!session || !hasRestaurants) && (
              <Link href="/restaurante/register" onClick={() => setMobileOpen(false)}
                className="mt-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all">
                Soy Restaurante
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
