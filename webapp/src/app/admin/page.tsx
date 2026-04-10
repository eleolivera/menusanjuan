"use client";

import { useState, useEffect, useCallback } from "react";
import { flexMatch } from "@/lib/search";
import { OnboardingBoard } from "@/components/OnboardingBoard";

type Claim = {
  id: string;
  status: string;
  code: string | null;
  notes: string | null;
  requestedAt: string;
  user: { id: string; email: string; name: string; phone: string | null };
  dealer: { id: string; name: string; slug: string; phone: string };
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  cuisineType: string;
  ownerEmail: string;
  isPlaceholder: boolean;
  isVerified: boolean;
  isActive: boolean;
  categoryCount: number;
  orderCount: number;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  type AdminTab = "onboarding" | "claims" | "users" | "settings";
  const validTabs: AdminTab[] = ["onboarding", "claims", "users", "settings"];
  const tabAliases: Record<string, AdminTab> = { tablero: "onboarding", reclamos: "claims", usuarios: "users", configuracion: "settings" };

  function getInitialTab(): AdminTab {
    if (typeof window === "undefined") return "onboarding";
    const p = new URLSearchParams(window.location.search).get("tab") || "";
    if (validTabs.includes(p as AdminTab)) return p as AdminTab;
    if (tabAliases[p]) return tabAliases[p];
    return "onboarding";
  }

  const [tab, setTabState] = useState<AdminTab>(getInitialTab);

  const setTab = useCallback((t: AdminTab) => {
    setTabState(t);
    const label = t === "onboarding" ? "tablero" : t;
    window.history.replaceState({}, "", t === "onboarding" ? "/admin" : `/admin?tab=${label}`);
  }, []);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewResta, setShowNewResta] = useState(false);
  // Cuisine types (settings tab)
  const [cuisineTypes, setCuisineTypes] = useState<any[]>([]);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeEmoji, setNewTypeEmoji] = useState("");
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeLabel, setEditTypeLabel] = useState("");
  const [editTypeEmoji, setEditTypeEmoji] = useState("");
  const [newRestaName, setNewRestaName] = useState("");
  const [newRestaPhone, setNewRestaPhone] = useState("");
  const [creatingResta, setCreatingResta] = useState(false);
  const [showMajo, setShowMajo] = useState(true);

  // Check existing session
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) { setAuthed(true); setAdminEmail(data.email); if (window.location.search) window.history.replaceState({}, "", "/admin"); }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // Dismiss Majo splash after 4s once authed
  useEffect(() => {
    if (authed && showMajo) {
      const t = setTimeout(() => setShowMajo(false), 4000);
      return () => clearTimeout(t);
    }
  }, [authed, showMajo]);

  async function handleLogin() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { setAuthed(true); setAdminEmail(email); window.history.replaceState({}, "", "/admin"); }
    else { const d = await res.json(); setLoginError(d.error || "Error"); }
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/admin";
  }

  const [fetchError, setFetchError] = useState(false);

  function loadTabData() {
    if (!authed) return;
    if (tab === "onboarding") return;
    setLoading(true);
    setFetchError(false);
    const endpoint = tab === "claims" ? "/api/admin/claims" : tab === "users" ? "/api/admin/users" : "/api/admin/cuisine-types";
    fetch(endpoint)
      .then(r => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then(d => {
        if (tab === "claims") setClaims(d);
        else if (tab === "users") setUsers(d);
        else setCuisineTypes(d);
        setLoading(false);
      })
      .catch(() => { setFetchError(true); setLoading(false); });
  }

  useEffect(() => { loadTabData(); }, [authed, tab]);

  async function generateCode(claimId: string) {
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, action: "generate_code" }) });
    fetch("/api/admin/claims").then(r => r.json()).then(setClaims);
  }

  async function rejectClaim(claimId: string) {
    const notes = prompt("Motivo (opcional):");
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, action: "reject", notes }) });
    fetch("/api/admin/claims").then(r => r.json()).then(setClaims);
  }

  async function toggleRestaurant(id: string, isActive: boolean) {
    await fetch(`/api/admin/restaurants/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    fetch("/api/admin/restaurants").then(r => r.json()).then(setRestaurants);
  }

  async function deleteRestaurant(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}" permanentemente? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/admin/restaurants/${id}`, { method: "DELETE" });
    fetch("/api/admin/restaurants").then(r => r.json()).then(setRestaurants);
  }

  async function changeUserRole(userId: string, role: string) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
    fetch("/api/admin/users").then(r => r.json()).then(setUsers);
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`¿Eliminar usuario "${email}"? Se eliminan también sus restaurantes y datos.`)) return;
    await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
    fetch("/api/admin/users").then(r => r.json()).then(setUsers);
  }

  // Still checking session or redirecting to Google
  if (checking || googleLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
      <div className="text-center animate-fade-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-lg shadow-primary/25">M</div>
        {googleLoading && <p className="text-xs text-slate-500 mt-3">Conectando con Google...</p>}
      </div>
    </div>
  );

  // Not authed — show login form
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-lg shadow-primary/25">M</div>
            <p className="text-xs text-slate-600">MenuSanJuan Admin</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-3">
            <button
              type="button"
              onClick={() => { setGoogleLoading(true); window.location.href = "/api/auth/google?redirect=/admin"; }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-xs"><span className="bg-slate-900/50 px-3 text-slate-500">o con email</span></div>
            </div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Contraseña"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            {loginError && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{loginError}</p>}
            <button onClick={handleLogin} disabled={!email || !password}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-30">
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Majo splash — plays every time admin loads, auto-dismisses after 4s
  if (showMajo) {
    const particles = Array.from({ length: 50 }, (_, i) => i);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden relative" onClick={() => setShowMajo(false)}>
        <style>{`
          @keyframes majo-fall {
            0% { transform: translateY(-10vh) rotate(0deg) scale(0); opacity: 0; }
            10% { opacity: 1; transform: translateY(0vh) rotate(30deg) scale(1); }
            90% { opacity: 1; }
            100% { transform: translateY(105vh) rotate(720deg) scale(0.5); opacity: 0; }
          }
          @keyframes majo-text-in {
            0% { transform: scale(0) rotate(-20deg); opacity: 0; }
            50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
            70% { transform: scale(0.9) rotate(-2deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes majo-glow {
            0%, 100% { text-shadow: 0 0 20px rgba(249,115,22,0.5), 0 0 40px rgba(249,115,22,0.3); }
            50% { text-shadow: 0 0 40px rgba(249,115,22,0.8), 0 0 80px rgba(249,115,22,0.5), 0 0 120px rgba(251,191,36,0.3); }
          }
          @keyframes majo-subtitle {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .majo-particle {
            position: absolute;
            animation: majo-fall linear forwards;
            pointer-events: none;
            font-size: clamp(1rem, 3vw, 2.5rem);
          }
        `}</style>
        {particles.map((i) => {
          const emojis = ["❤️", "🧡", "💛", "✨", "🌟", "💖", "🔥", "⭐", "💫", "🎉", "💝", "🩷"];
          const emoji = emojis[i % emojis.length];
          const left = Math.random() * 100;
          const delay = Math.random() * 2;
          const duration = 2.5 + Math.random() * 2;
          const size = 0.6 + Math.random() * 1.2;
          return (
            <span key={i} className="majo-particle" style={{ left: `${left}%`, animationDuration: `${duration}s`, animationDelay: `${delay}s`, fontSize: `${size}rem` }}>
              {emoji}
            </span>
          );
        })}
        <div className="text-center z-10">
          <div style={{ animation: "majo-text-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both" }}>
            <p className="text-6xl sm:text-8xl font-black bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent" style={{ WebkitBackgroundClip: "text" }}>
              TE AMO
            </p>
            <p className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-pink-400 via-red-400 to-orange-400 bg-clip-text text-transparent mt-2" style={{ WebkitBackgroundClip: "text" }}>
              MAJO
            </p>
          </div>
          <p className="text-lg text-slate-400 mt-6" style={{ animation: "majo-subtitle 0.6s ease-out 1.2s both" }}>
            💖 Mi persona favorita del mundo 💖
          </p>
        </div>
      </div>
    );
  }

  const pendingClaims = claims.filter(c => c.status === "PENDING" || c.status === "CODE_SENT").length;

  return (
    <div className="bg-slate-950 h-screen overflow-hidden">
      <div className="px-3 py-2 h-full flex flex-col">

        <div className="flex gap-2 mb-2 shrink-0">
          {[
            { key: "onboarding" as const, label: "📋 Tablero" },
            { key: "claims" as const, label: "📨 Reclamos", badge: pendingClaims },
            { key: "users" as const, label: "👥 Usuarios" },
            { key: "settings" as const, label: "⚙️ Config" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${tab === t.key ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>
              {t.label}
              {t.badge ? <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{t.badge}</span> : null}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <a href="/admin/playbook" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-500 hover:bg-white/5 transition-colors">Playbook</a>
            <button onClick={handleLogout} className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors">Salir</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm text-slate-400">Error cargando datos — probablemente la base de datos está lenta</p>
            <button onClick={loadTabData} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">Reintentar</button>
          </div>
        ) : tab === "onboarding" ? (
          <OnboardingBoard />
        ) : tab === "claims" ? (
          <div className="space-y-4 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {claims.length === 0 ? <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center"><div className="text-3xl mb-3">📋</div><h3 className="text-lg font-bold text-white">Sin reclamos</h3></div> : claims.map(c => (
              <div key={c.id} className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                <div className="flex justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{c.dealer.name}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${c.status === "PENDING" ? "bg-amber-500/15 text-amber-400" : c.status === "CODE_SENT" ? "bg-blue-500/15 text-blue-400" : c.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{c.status}</span>
                    </div>
                    <div className="text-xs text-slate-500">Por: <strong className="text-white">{c.user.name}</strong> ({c.user.email})</div>
                    <div className="text-[11px] text-slate-600">{new Date(c.requestedAt).toLocaleString("es-AR")}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">/{c.dealer.slug}<br/>{c.dealer.phone}</div>
                </div>
                {c.code && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 mb-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Código:</span>
                    <span className="font-mono text-lg font-bold text-primary tracking-widest">{c.code}</span>
                    <button onClick={() => navigator.clipboard.writeText(c.code!)} className="ml-auto text-[10px] text-primary hover:underline">Copiar</button>
                  </div>
                )}
                {(c.status === "PENDING" || c.status === "CODE_SENT") && (
                  <div className="flex gap-2">
                    {c.status === "PENDING" && <button onClick={() => generateCode(c.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors">Generar Código</button>}
                    <button onClick={() => rejectClaim(c.id)} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Rechazar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "settings" ? (
          <div className="space-y-6 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {/* Cuisine Types Manager */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
              <div className="border-b border-white/5 px-5 py-3">
                <h2 className="text-sm font-bold text-white">Tipos de Cocina</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Estos tipos se usan en el buscador, filtros, y perfil de cada restaurante</p>
              </div>

              {/* Add new */}
              <div className="border-b border-white/5 bg-primary/5 px-5 py-3 flex gap-2">
                <input value={newTypeEmoji} onChange={e => setNewTypeEmoji(e.target.value)} placeholder="🍔" className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-sm text-white focus:border-primary focus:outline-none" />
                <input value={newTypeLabel} onChange={e => setNewTypeLabel(e.target.value)} placeholder="Nuevo tipo de cocina..." className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" onKeyDown={e => { if (e.key === "Enter") document.getElementById("add-type-btn")?.click(); }} />
                <button id="add-type-btn" disabled={!newTypeLabel.trim()} onClick={async () => {
                  const res = await fetch("/api/admin/cuisine-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newTypeLabel.trim(), emoji: newTypeEmoji || "🍽️" }) });
                  if (res.ok) { setNewTypeLabel(""); setNewTypeEmoji(""); const data = await fetch("/api/admin/cuisine-types").then(r => r.json()); setCuisineTypes(data); }
                }} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0">
                  + Agregar
                </button>
              </div>

              {/* List */}
              <div className="divide-y divide-white/5">
                {cuisineTypes.map((ct, i) => (
                  <div key={ct.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                    {editingType === ct.id ? (
                      <>
                        <input value={editTypeEmoji} onChange={e => setEditTypeEmoji(e.target.value)} className="w-10 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-center text-sm text-white focus:border-primary focus:outline-none" />
                        <input value={editTypeLabel} onChange={e => setEditTypeLabel(e.target.value)} className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white focus:border-primary focus:outline-none" />
                        <button onClick={async () => {
                          await fetch("/api/admin/cuisine-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ct.id, label: editTypeLabel, emoji: editTypeEmoji }) });
                          setEditingType(null); const data = await fetch("/api/admin/cuisine-types").then(r => r.json()); setCuisineTypes(data);
                        }} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white">Guardar</button>
                        <button onClick={() => setEditingType(null)} className="text-xs text-slate-500">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <span className="text-xl w-8 text-center">{ct.emoji}</span>
                        <span className="text-sm font-medium text-white flex-1">{ct.label}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{ct.restaurantCount} resta{ct.restaurantCount !== 1 ? "s" : ""}</span>
                        {/* Move up/down */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          {i > 0 && (
                            <button onClick={async () => {
                              const prev = cuisineTypes[i - 1];
                              await fetch("/api/admin/cuisine-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: [{ id: ct.id, sortOrder: prev.sortOrder }, { id: prev.id, sortOrder: ct.sortOrder }] }) });
                              const data = await fetch("/api/admin/cuisine-types").then(r => r.json()); setCuisineTypes(data);
                            }} className="text-slate-600 hover:text-white transition-colors">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                            </button>
                          )}
                          {i < cuisineTypes.length - 1 && (
                            <button onClick={async () => {
                              const next = cuisineTypes[i + 1];
                              await fetch("/api/admin/cuisine-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: [{ id: ct.id, sortOrder: next.sortOrder }, { id: next.id, sortOrder: ct.sortOrder }] }) });
                              const data = await fetch("/api/admin/cuisine-types").then(r => r.json()); setCuisineTypes(data);
                            }} className="text-slate-600 hover:text-white transition-colors">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                            </button>
                          )}
                        </div>
                        <button onClick={() => { setEditingType(ct.id); setEditTypeLabel(ct.label); setEditTypeEmoji(ct.emoji); }} className="text-xs text-slate-400 hover:text-primary transition-colors">✏️</button>
                        {ct.label !== "General" && (
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar "${ct.label}"? ${ct.restaurantCount} restaurante(s) lo usan.`)) return;
                            await fetch(`/api/admin/cuisine-types?id=${ct.id}`, { method: "DELETE" });
                            const data = await fetch("/api/admin/cuisine-types").then(r => r.json()); setCuisineTypes(data);
                          }} className="text-xs text-slate-600 hover:text-red-400 transition-colors">✕</button>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {cuisineTypes.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-slate-500">Sin tipos de cocina configurados</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-auto flex-1" style={{ minHeight: 0 }}>
            <div className="border-b border-white/5 px-5 py-3"><h2 className="text-sm font-bold text-white">Usuarios ({users.length})</h2></div>
            <table className="w-full">
              <thead><tr className="border-b border-white/5 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Usuario</th>
                <th className="px-4 py-2.5 text-center">Rol</th>
                <th className="px-4 py-2.5 text-center">Verificado</th>
                <th className="px-4 py-2.5 text-center">Negocios</th>
                <th className="px-4 py-2.5 text-left">Registrado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr></thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3"><div className="text-sm font-semibold text-white">{u.name}</div><div className="text-[11px] text-slate-500">{u.email}</div></td>
                    <td className="px-4 py-3 text-center">
                      <select value={u.role} onChange={(e) => changeUserRole(u.id, e.target.value)}
                        className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white focus:border-primary focus:outline-none cursor-pointer">
                        <option value="USER" className="bg-slate-900">USER</option>
                        <option value="BUSINESS" className="bg-slate-900">BUSINESS</option>
                        <option value="ADMIN" className="bg-slate-900">ADMIN</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{u.emailVerified ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">{u._count.accounts}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{new Date(u.createdAt).toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== "ADMIN" && (
                        <button onClick={() => deleteUser(u.id, u.email)}
                          className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-red-500/15 hover:text-red-400 transition-colors">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
