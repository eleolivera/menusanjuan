"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { RestaurantQrCard } from "@/components/RestaurantQrCard";
import { ChevronDown, ExternalLink, LogOut, ChevronRight, UtensilsCrossed, Store, ClipboardList, Wallet, BarChart3, Gift, Users, Bike, Menu as MenuIcon, X as XIcon, type LucideIcon } from "lucide-react";

// Nav uses Lucide line icons (same style as the rest of the app) instead of
// emoji — emoji read as "consumer / playful" which felt off for the owner-side
// dashboard. Each entry maps to a specific icon that visually represents the
// destination at a glance.
const REWARDS_ENABLED = process.env.NEXT_PUBLIC_REWARDS_ENABLED === "true";

const DEFAULT_NAV: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/restaurante/menu", label: "Menú", Icon: UtensilsCrossed },
  { href: "/restaurante/profile", label: "Mi Restaurante", Icon: Store },
  { href: "/restaurante/pedidos", label: "Pedidos", Icon: ClipboardList },
  { href: "/restaurante/pos", label: "POS", Icon: Wallet },
  { href: "/restaurante/dashboard", label: "Dashboard", Icon: BarChart3 },
  { href: "/restaurante/clientes", label: "Clientes", Icon: Users },
  ...(REWARDS_ENABLED ? [{ href: "/restaurante/rewards", label: "Rewards", Icon: Gift }] : []),
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
  const [qrOpen, setQrOpen] = useState(false);
  // Mobile drawer state: full-screen slide-in that mirrors the desktop
  // sidebar's nav + account section. Bottom-nav (Pedidos/Menú/POS) always
  // stays visible; the drawer surfaces the rest.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Delivery mode from the current resta — drives whether the "Repartidores"
  // nav entry is visible. Only shown when the resta has OWN or HYBRID.
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null);

  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Sort nav by usage after threshold. Adds "Repartidores" only when the
  // resta's delivery mode uses the PWA (OWN or HYBRID) — MANUAL/NETWORK
  // don't need it since those modes never surface resta-owned drivers.
  const navItems = useMemo(() => {
    const base = deliveryMode === "OWN" || deliveryMode === "HYBRID"
      ? [...DEFAULT_NAV, { href: "/restaurante/drivers", label: "Repartidores", Icon: Bike as LucideIcon }]
      : DEFAULT_NAV;
    if (typeof window === "undefined") return base;
    const usage = getUsage();
    const totalClicks = Object.values(usage).reduce((s, v) => s + v, 0);
    if (totalClicks < USAGE_THRESHOLD) return base;
    return [...base].sort((a, b) => (usage[b.href] || 0) - (usage[a.href] || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navVersion, deliveryMode]);

  // Track page visits
  useEffect(() => {
    if (isAuthPage || !authed) return;
    const match = DEFAULT_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
    if (match) {
      trackUsage(match.href);
      setNavVersion((v) => v + 1);
    }
  }, [pathname, isAuthPage, authed]);

  // Close mobile drawer whenever the user navigates elsewhere.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
          setDeliveryMode(data.deliveryMode ?? null);
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

  // Mobile bottom-nav: the three surfaces owners live in. Everything else
  // (Dashboard, Clientes, Rewards, Mi Restaurante) lives in the drawer.
  const bottomNav = [
    DEFAULT_NAV.find((n) => n.href === "/restaurante/pedidos"),
    DEFAULT_NAV.find((n) => n.href === "/restaurante/menu"),
    DEFAULT_NAV.find((n) => n.href === "/restaurante/pos"),
  ].filter(Boolean) as typeof DEFAULT_NAV;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (desktop only — mobile uses the drawer + bottom nav below) */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/5 bg-slate-900 transition-all duration-200 shrink-0 ${
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
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
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
                <item.Icon className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4 mr-2.5"}`} strokeWidth={1.75} />
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
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </span>
              )}
            </a>
          )}

          {/* My QR — opens modal */}
          {slug && (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              title={collapsed ? "Mi QR" : undefined}
              className={`w-full flex items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              }`}
            >
              <span className={collapsed ? "text-lg" : "text-base mr-2.5"}>📱</span>
              {!collapsed && <span className="text-sm font-medium">Mi QR</span>}
            </button>
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
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            {!collapsed && <span className="text-xs font-medium">Cerrar sesión</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg py-2 text-slate-600 hover:bg-white/5 hover:text-slate-400 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* Content — mobile gets top/bottom padding to sit clear of the fixed
          mobile top bar (h-14) and bottom nav (h-16 + safe-area). Desktop
          keeps the split-scroll model unchanged. */}
      <main className="flex-1 overflow-hidden min-w-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
        {children}
      </main>

      {/* ─── Mobile chrome (< lg) ─────────────────────────────────────── */}

      {/* Top bar: brand + hamburger */}
      <div className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-white/5 bg-slate-900/85 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-sm shadow-md shadow-primary/25">
            {restaurantName.charAt(0) || "M"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{restaurantName || "MenuSanJuan"}</div>
          </div>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 active:bg-white/10 transition-colors"
          aria-label="Abrir menú"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom nav: Pedidos / Menú / POS */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-slate-900/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-16">
          {bottomNav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-slate-400 active:text-slate-200"
                }`}
              >
                <item.Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className={`text-[10px] font-semibold ${active ? "" : "font-medium"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Drawer overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div
            className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-slate-900 border-l border-white/5 shadow-2xl flex flex-col animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="text-sm font-bold text-white truncate">{restaurantName}</div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5"
                aria-label="Cerrar menú"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer nav — everything from DEFAULT_NAV */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {navItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/15 text-primary-light"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <item.Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {slug && (
                <a
                  href={`/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span>Ver página pública</span>
                </a>
              )}
              {slug && (
                <button
                  type="button"
                  onClick={() => { setMobileNavOpen(false); setQrOpen(true); }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <span className="text-lg">📱</span>
                  <span>Mi QR</span>
                </button>
              )}
            </nav>

            {/* Drawer footer — logout */}
            <div className="border-t border-white/5 p-2">
              <button
                onClick={async () => {
                  await fetch("/api/restaurante/session", { method: "DELETE" });
                  router.push("/restaurante/login");
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* QR modal — accessed from sidebar */}
      {qrOpen && slug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setQrOpen(false)}
        >
          <div className="w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <RestaurantQrCard slug={slug} name={restaurantName || slug} />
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
