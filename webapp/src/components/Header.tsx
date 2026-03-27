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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    if (showMenu) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showMenu]);

  async function handleLogout() {
    await fetch("/api/restaurante/session", { method: "DELETE" });
    window.location.href = "/";
  }

  const hasRestas = session?.restaurants && session.restaurants.length > 0;
  const hasClaims = session?.pendingClaims && session.pendingClaims.length > 0;

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
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 mr-2">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Inicio</Link>
            <Link href="/#restaurantes" scroll={false} onClick={() => { if (window.location.pathname === "/") { document.getElementById("restaurantes")?.scrollIntoView({ behavior: "smooth" }); } }} className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Restaurantes</Link>
            <Link href="/#como-funciona" scroll={false} onClick={() => { if (window.location.pathname === "/") { document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" }); } }} className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Cómo Funciona</Link>
          </nav>

          {/* "Soy Restaurante" — visible when user has no restaurants */}
          {!hasRestas && (
            <Link href={session ? "/restaurante/register" : "/para-restaurantes"}
              className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-primary to-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Soy Restaurante
            </Link>
          )}

          {/* User email / login */}
          {session ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setShowMenu(!showMenu); setMobileOpen(false); }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 px-2.5 py-1.5 text-sm font-medium text-text hover:border-primary/40 transition-all"
              >
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-surface-hover text-[11px] font-bold text-text-secondary shrink-0">
                  {session.user.name?.charAt(0)?.toUpperCase() || "U"}
                  {hasClaims && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 border border-white" />}
                </div>
                <span className="hidden sm:inline max-w-[140px] truncate text-xs text-text-secondary">{session.user.email}</span>
                <svg className={`h-3 w-3 text-text-muted transition-transform shrink-0 ${showMenu ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-surface shadow-xl overflow-hidden animate-fade-in z-50 max-h-[80vh] overflow-y-auto">
                  {/* User */}
                  <div className="px-4 py-3 border-b border-border/50 bg-surface-alt">
                    <div className="text-sm font-semibold text-text">{session.user.name}</div>
                    <div className="text-[11px] text-text-muted">{session.user.email}</div>
                  </div>

                  {/* Restaurants */}
                  {hasRestas && (
                    <div className="py-1.5 border-b border-border/50">
                      <div className="px-4 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">Mis Restaurantes</div>
                      {session.restaurants.map((r) => (
                        <Link key={r.slug} href="/restaurante"
                          onClick={async () => {
                            await fetch("/api/restaurante/session", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ slug: r.slug }),
                            });
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">
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

                  {/* No restaurants */}
                  {!hasRestas && (
                    <div className="px-4 py-3 border-b border-border/50">
                      <Link href="/restaurante/register" onClick={() => setShowMenu(false)}
                        className="block text-center rounded-lg bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                        Registrar mi restaurante
                      </Link>
                    </div>
                  )}

                  {/* Pending claims */}
                  {hasClaims && (
                    <div className="py-2 px-3 border-b border-border/50">
                      <div className="px-1 py-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider">Restaurantes en proceso</div>
                      {session.pendingClaims.map((c: any) => (
                        <div key={c.id} className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-1.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">⏳</span>
                            <span className="text-sm font-semibold text-amber-800 truncate">{c.dealer.name}</span>
                          </div>
                          {c.status === "CODE_SENT" ? (
                            <div>
                              <p className="text-[11px] text-amber-700 mb-2">Te enviamos un código. Ingresalo para completar el reclamo.</p>
                              <Link href={`/${c.dealer.slug}`} onClick={() => setShowMenu(false)}
                                className="block text-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                                Ingresar código
                              </Link>
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-600">Estamos revisando tu solicitud. Te vamos a contactar pronto.</p>
                          )}
                        </div>
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
            <Link href="/restaurante/login"
              className="rounded-xl border border-border/60 px-3 py-2 text-xs sm:text-sm font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-all">
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
            <Link href="/" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Inicio</Link>
            <Link href="/#restaurantes" onClick={() => { setMobileOpen(false); if (window.location.pathname === "/") { setTimeout(() => document.getElementById("restaurantes")?.scrollIntoView({ behavior: "smooth" }), 100); } }} className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Restaurantes</Link>
            <Link href="/#como-funciona" onClick={() => { setMobileOpen(false); if (window.location.pathname === "/") { setTimeout(() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" }), 100); } }} className="rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all">Cómo Funciona</Link>
            {!hasRestas && (
              <Link href={session ? "/restaurante/register" : "/para-restaurantes"} onClick={() => setMobileOpen(false)}
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
