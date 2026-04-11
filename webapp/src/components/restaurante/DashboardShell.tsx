"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const DEFAULT_NAV = [
  { href: "/restaurante/menu", label: "Menú", emoji: "🍽️" },
  { href: "/restaurante/profile", label: "Mi Restaurante", emoji: "🏪" },
  { href: "/restaurante/pedidos", label: "Pedidos", emoji: "📋" },
  { href: "/restaurante/pos", label: "POS", emoji: "💵" },
  { href: "/restaurante/dashboard", label: "Dashboard", emoji: "📊" },
];

const USAGE_KEY = "msj_nav_usage";
const USAGE_THRESHOLD = 15; // Total clicks before sorting kicks in
const WELCOME_KEY = "msj_welcome_seen";

// Pages that should NOT show the sidebar
const AUTH_PATHS = [
  "/restaurante/login",
  "/restaurante/register",
  "/restaurante/reset-password",
  "/restaurante/setup",
  "/restaurante/esperando-codigo",
  "/restaurante/agregar",
  "/restaurante/bienvenida",
];

function getUsage(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}"); } catch { return {}; }
}

function trackUsage(href: string) {
  const usage = getUsage();
  usage[href] = (usage[href] || 0) + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [slug, setSlug] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [navVersion, setNavVersion] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [restaurants, setRestaurants] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [pendingClaims, setPendingClaims] = useState<Array<{ id: string; status: string; dealer: { id: string; name: string; slug: string } }>>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Sort nav by usage after threshold
  const navItems = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_NAV;
    const usage = getUsage();
    const totalClicks = Object.values(usage).reduce((s, v) => s + v, 0);
    if (totalClicks < USAGE_THRESHOLD) return DEFAULT_NAV;
    return [...DEFAULT_NAV].sort((a, b) => (usage[b.href] || 0) - (usage[a.href] || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navVersion]);

  // Track page visits
  useEffect(() => {
    if (isAuthPage || !authed) return;
    const match = DEFAULT_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
    if (match) {
      trackUsage(match.href);
      setNavVersion((v) => v + 1);
    }
  }, [pathname, isAuthPage, authed]);

  useEffect(() => {
    if (isAuthPage) { setAuthed(false); return; }
    fetch("/api/restaurante/session")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.authenticated && data.mustChangePassword) {
          router.push("/restaurante/setup");
          return;
        }
        if (data.authenticated) {
          setRestaurants(data.restaurants || []);
          setPendingClaims(data.pendingClaims || []);

          // No owned restaurants at all
          if (!data.slug) {
            if ((data.pendingClaims || []).length > 0) {
              // User only has pending claims — always route to waiting page
              router.push("/restaurante/esperando-codigo");
              return;
            }
            // Nothing at all — send to add-restaurant flow
            router.push("/restaurante/agregar");
            return;
          }

          setSlug(data.slug);
          setRestaurantName(data.name || data.slug);
          setAuthed(true);
          if (!localStorage.getItem(WELCOME_KEY)) setShowWelcome(true);
        } else {
          setAuthed(false);
          router.push("/restaurante/login");
        }
      })
      .catch(() => {
        setAuthed(false);
        if (!isAuthPage) router.push("/restaurante/login");
      });
  }, [pathname, isAuthPage, router]);

  if (isAuthPage) return <>{children}</>;

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authed) return null;

  function isActive(item: typeof DEFAULT_NAV[0]) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-white/5 bg-slate-900 transition-all duration-200 shrink-0 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand + restaurant switcher */}
        <div className="relative border-b border-white/5">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className="flex w-full items-center px-3 py-4 gap-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-base shadow-md shadow-primary/25">
              {restaurantName.charAt(0)}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-bold text-white truncate">{restaurantName}</div>
                  <div className="text-[10px] text-slate-500">
                    {restaurants.length + pendingClaims.length > 1
                      ? `${restaurants.length + pendingClaims.length} restaurantes · Cambiar`
                      : "Panel de Control"}
                  </div>
                </div>
                <svg className={`h-4 w-4 text-slate-500 transition-transform ${switcherOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </>
            )}
          </button>

          {/* Dropdown panel */}
          {switcherOpen && !collapsed && (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl border border-white/10 bg-slate-900 shadow-xl overflow-hidden">
              {restaurants.length > 0 && (
                <div className="p-1">
                  <div className="px-2 py-1 text-[9px] font-bold text-slate-500 uppercase">Tuyos</div>
                  {restaurants.map((r) => (
                    <button
                      key={r.id}
                      onClick={async () => {
                        setSwitcherOpen(false);
                        if (r.slug === slug) return;
                        await fetch("/api/restaurante/session", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ slug: r.slug }),
                        });
                        window.location.href = "/restaurante";
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                        r.slug === slug ? "bg-primary/10 text-primary-light" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-amber-500 text-white text-[10px] font-bold">
                        {r.name.charAt(0)}
                      </span>
                      <span className="flex-1 truncate">{r.name}</span>
                      {r.slug === slug && <span className="text-[9px] text-primary">activo</span>}
                    </button>
                  ))}
                </div>
              )}

              {pendingClaims.length > 0 && (
                <div className="border-t border-white/5 p-1">
                  <div className="px-2 py-1 text-[9px] font-bold text-slate-500 uppercase">Pendientes</div>
                  {pendingClaims.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSwitcherOpen(false);
                        router.push(`/restaurante/esperando-codigo?claimId=${c.id}`);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-400 hover:bg-white/5 transition-colors"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/10 text-amber-400 text-xs">
                        ⏳
                      </span>
                      <span className="flex-1 truncate">{c.dealer.name}</span>
                      <span className="text-[9px] text-amber-400 shrink-0">esperando código</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-white/5 p-1">
                <button
                  onClick={() => {
                    setSwitcherOpen(false);
                    router.push("/restaurante/agregar");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-primary hover:bg-primary/5 transition-colors"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-base leading-none">
                    +
                  </span>
                  <span className="font-medium">Agregar restaurante</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg transition-colors ${
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "bg-primary/15 text-primary-light"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                <span className={collapsed ? "text-lg" : "text-base mr-2.5"}>{item.emoji}</span>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}

          {/* View public page */}
          {slug && (
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title={collapsed ? "Ver Página" : undefined}
              className={`flex items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              }`}
            >
              <span className={collapsed ? "text-lg" : "text-base mr-2.5"}>👁️</span>
              {!collapsed && (
                <span className="text-sm font-medium flex items-center gap-1.5">
                  Ver Página
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </span>
              )}
            </a>
          )}
        </nav>

        {/* Logout + collapse */}
        <div className="border-t border-white/5 p-2 space-y-1">
          <button
            onClick={async () => {
              await fetch("/api/restaurante/session", { method: "DELETE" });
              router.push("/restaurante/login");
            }}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={`flex w-full items-center rounded-lg py-2 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors ${
              collapsed ? "justify-center" : "px-3 gap-2"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            {!collapsed && <span className="text-xs font-medium">Cerrar sesión</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg py-2 text-slate-600 hover:bg-white/5 hover:text-slate-400 transition-colors"
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-hidden min-w-0">
        {children}
      </main>

      {/* First-time welcome popup */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl mx-4 animate-scale-in">
            <div className="text-center mb-5">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-3xl text-white font-bold shadow-lg shadow-primary/25">
                {restaurantName.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-white">Bienvenido a MenuSanJuan</h2>
              <p className="text-sm text-slate-400 mt-1">Tu panel de control para <span className="text-primary font-medium">{restaurantName}</span></p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <span className="text-lg mt-0.5">🍽️</span>
                <div>
                  <p className="text-sm font-semibold text-white">Menu</p>
                  <p className="text-xs text-slate-400">Edita tus platos, precios, categorias e imagenes. Es lo primero que ven tus clientes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <span className="text-lg mt-0.5">🏪</span>
                <div>
                  <p className="text-sm font-semibold text-white">Mi Restaurante</p>
                  <p className="text-xs text-slate-400">Configura tu direccion, horarios, telefono de WhatsApp, y datos de pago.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <span className="text-lg mt-0.5">📋</span>
                <div>
                  <p className="text-sm font-semibold text-white">Pedidos</p>
                  <p className="text-xs text-slate-400">Aca llegan los pedidos de tus clientes. Te llegan por WhatsApp y los ves aca tambien.</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center mb-4">
              Tu pagina publica es <a href={`/${slug}`} target="_blank" className="text-primary hover:underline">menusanjuan.com/{slug}</a> — compartila con tus clientes!
            </p>

            <button
              onClick={() => { setShowWelcome(false); localStorage.setItem(WELCOME_KEY, "1"); }}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              Empezar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
