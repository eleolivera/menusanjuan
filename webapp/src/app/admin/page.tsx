"use client";

import { useState, useEffect } from "react";

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
  const [tab, setTab] = useState<"restaurants" | "claims" | "users">("restaurants");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Check existing session
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) { setAuthed(true); setAdminEmail(data.email); }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function handleLogin() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { setAuthed(true); setAdminEmail(email); }
    else { const d = await res.json(); setLoginError(d.error || "Error"); }
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setAdminEmail("");
  }

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    if (tab === "claims") fetch("/api/admin/claims").then(r => r.ok ? r.json() : []).then(d => { setClaims(d); setLoading(false); });
    else if (tab === "users") fetch("/api/admin/users").then(r => r.ok ? r.json() : []).then(d => { setUsers(d); setLoading(false); });
    else fetch("/api/admin/restaurants").then(r => r.ok ? r.json() : []).then(d => { setRestaurants(d); setLoading(false); });
  }, [authed, tab]);

  async function generateCode(claimId: string) {
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, action: "generate_code" }) });
    fetch("/api/admin/claims").then(r => r.json()).then(setClaims);
  }

  async function rejectClaim(claimId: string) {
    const notes = prompt("Motivo (opcional):");
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, action: "reject", notes }) });
    fetch("/api/admin/claims").then(r => r.json()).then(setClaims);
  }

  // Still checking session
  if (checking) return <div className="min-h-screen bg-slate-950" />;

  // Not authed — show nothing unless ?login is in URL
  if (!authed) {
    if (typeof window !== "undefined" && !window.location.search.includes("login")) {
      return (
        <div className="min-h-screen mesh-gradient flex flex-1 items-center justify-center px-4 py-20">
          <div className="text-center animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/5 to-orange-50 text-5xl">🍽️</div>
            <h1 className="text-4xl font-extrabold text-text tracking-tight mb-3">404</h1>
            <p className="text-lg text-text-secondary mb-8">Esta página no existe o fue movida.</p>
            <a href="/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all">Volver al Inicio</a>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Contraseña"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
          {loginError && <p className="text-xs text-red-400">{loginError}</p>}
          <button onClick={handleLogin} className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/20 transition-all">Entrar</button>
        </div>
      </div>
    );
  }

  const pendingClaims = claims.filter(c => c.status === "PENDING" || c.status === "CODE_SENT").length;
  const unclaimed = restaurants.filter(r => r.isPlaceholder).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin</h1>
            <p className="text-xs text-slate-500">{adminEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setLoading(true); if (tab === "restaurants") fetch("/api/admin/restaurants").then(r => r.json()).then(d => { setRestaurants(d); setLoading(false); }); else if (tab === "claims") fetch("/api/admin/claims").then(r => r.json()).then(d => { setClaims(d); setLoading(false); }); else fetch("/api/admin/users").then(r => r.json()).then(d => { setUsers(d); setLoading(false); }); }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">Actualizar</button>
            <button onClick={handleLogout} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Restaurantes", value: restaurants.length, color: "text-white" },
            { label: "Sin reclamar", value: unclaimed, color: "text-amber-400" },
            { label: "Con dueño", value: restaurants.length - unclaimed, color: "text-emerald-400" },
            { label: "Reclamos pendientes", value: pendingClaims, color: "text-blue-400" },
            { label: "Usuarios", value: users.length || "—", color: "text-slate-400" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3">
              <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: "restaurants" as const, label: `🍽️ Restaurantes (${restaurants.length})` },
            { key: "claims" as const, label: `📋 Reclamos`, badge: pendingClaims },
            { key: "users" as const, label: `👥 Usuarios` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${tab === t.key ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>
              {t.label}
              {t.badge ? <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : tab === "restaurants" ? (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3 flex justify-between">
              <h2 className="text-sm font-bold text-white">Restaurantes</h2>
              <span className="text-xs text-slate-500">{unclaimed} sin dueño · {restaurants.length - unclaimed} con dueño</span>
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-white/5 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Restaurante</th>
                <th className="px-4 py-2.5 text-left">Dueño</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-center">Menú</th>
                <th className="px-4 py-2.5 text-center">Pedidos</th>
              </tr></thead>
              <tbody>
                {restaurants.map(r => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer" onClick={() => window.location.href = `/admin/restaurants/${r.id}`}>
                    <td className="px-4 py-3"><div className="text-sm font-semibold text-white hover:text-primary">{r.name}</div><div className="text-[11px] text-slate-500">/{r.slug}</div></td>
                    <td className="px-4 py-3"><div className="text-xs text-white">{r.ownerEmail}</div>{r.isPlaceholder && <span className="text-[10px] text-amber-400">Sin reclamar</span>}</td>
                    <td className="px-4 py-3 text-center">{r.isVerified ? <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Verificado</span> : r.isPlaceholder ? <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Disponible</span> : <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Registrado</span>}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">{r.categoryCount}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">{r.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "claims" ? (
          <div className="space-y-4">
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
        ) : (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3"><h2 className="text-sm font-bold text-white">Usuarios ({users.length})</h2></div>
            <table className="w-full">
              <thead><tr className="border-b border-white/5 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Usuario</th>
                <th className="px-4 py-2.5 text-center">Rol</th>
                <th className="px-4 py-2.5 text-center">Verificado</th>
                <th className="px-4 py-2.5 text-center">Negocios</th>
                <th className="px-4 py-2.5 text-left">Registrado</th>
              </tr></thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3"><div className="text-sm font-semibold text-white">{u.name}</div><div className="text-[11px] text-slate-500">{u.email}</div></td>
                    <td className="px-4 py-3 text-center"><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${u.role === "ADMIN" ? "bg-purple-500/15 text-purple-400" : u.role === "BUSINESS" ? "bg-blue-500/15 text-blue-400" : "bg-slate-500/15 text-slate-400"}`}>{u.role}</span></td>
                    <td className="px-4 py-3 text-center text-xs">{u.emailVerified ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">{u._count.accounts}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{new Date(u.createdAt).toLocaleDateString("es-AR")}</td>
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
