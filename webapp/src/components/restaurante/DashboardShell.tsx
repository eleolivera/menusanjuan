"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const DEFAULT_NAV = [
  { href: "/restaurante/profile", label: "Mi Restaurante", emoji: "🏪" },
  { href: "/restaurante/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/restaurante/pedidos", label: "Pedidos", emoji: "📋" },
  { href: "/restaurante/menu", label: "Menú", emoji: "🍽️" },
];

const USAGE_KEY = "msj_nav_usage";
const USAGE_THRESHOLD = 15; // Total clicks before sorting kicks in

// Pages that should NOT show the sidebar
const AUTH_PATHS = ["/restaurante/login", "/restaurante/register", "/restaurante/reset-password"];

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
        if (data.authenticated && data.slug) {
          setSlug(data.slug);
          setRestaurantName(data.name || data.slug);
          setAuthed(true);
        } else if (data.authenticated && !data.slug) {
          router.push("/restaurante/register");
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
        {/* Brand + toggle */}
        <div className="flex items-center border-b border-white/5 px-3 py-4 gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-base shadow-md shadow-primary/25 hover:scale-105 transition-transform"
          >
            {restaurantName.charAt(0)}
          </button>
          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div className="text-sm font-bold text-white truncate">{restaurantName}</div>
              <div className="text-[10px] text-slate-500">Panel de Control</div>
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

        {/* Collapse toggle at bottom */}
        <div className="border-t border-white/5 p-2">
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
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
