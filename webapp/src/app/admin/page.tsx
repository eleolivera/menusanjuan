"use client";

import { useState, useEffect } from "react";

type Claim = {
  id: string;
  status: string;
  code: string | null;
  notes: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  user: { id: string; email: string; name: string; phone: string | null };
  dealer: { id: string; name: string; slug: string; phone: string };
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  cuisineType: string;
  phone: string;
  address: string | null;
  isActive: boolean;
  isVerified: boolean;
  claimedAt: string | null;
  ownerEmail: string;
  isPlaceholder: boolean;
  categoryCount: number;
  orderCount: number;
  claimRequestCount: number;
  createdAt: string;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<"claims" | "restaurants" | "users">("restaurants");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if already logged in + check for ?login param
  useEffect(() => {
    fetch("/api/admin/session").then((r) => {
      if (r.ok) {
        r.json().then((data) => {
          setAuthed(true);
          setAdminEmail(data.email || "");
        });
      }
    });
    if (typeof window !== "undefined") {
      setShowLogin(window.location.search.includes("login"));
    }
  }, []);

  async function handleLogin() {
    setLoginLoading(true);
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      setAuthed(true);
      setAdminEmail(email);
    } else {
      const data = await res.json();
      setLoginError(data.error || "Error");
    }
    setLoginLoading(false);
  }

  useEffect(() => {
    if (!authed) return;
    fetchData();
  }, [authed, tab]);

  async function fetchData() {
    setLoading(true);
    if (tab === "claims") {
      const res = await fetch("/api/admin/claims");
      if (res.ok) setClaims(await res.json());
    } else if (tab === "users") {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } else {
      const res = await fetch("/api/admin/restaurants");
      if (res.ok) setRestaurants(await res.json());
    }
    setLoading(false);
  }

  async function handleGenerateCode(claimId: string) {
    await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, action: "generate_code" }),
    });
    fetchData();
  }

  async function handleReject(claimId: string) {
    const notes = prompt("Motivo del rechazo (opcional):");
    await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, action: "reject", notes }),
    });
    fetchData();
  }

  if (!authed) {
    if (!showLogin) {
      // Show a blank 404-looking page — admin URL is not discoverable
      return (
        <div className="min-h-screen mesh-gradient flex flex-1 items-center justify-center px-4 py-20">
          <div className="text-center animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/5 to-orange-50 text-5xl">
              🍽️
            </div>
            <h1 className="text-4xl font-extrabold text-text tracking-tight mb-3">404</h1>
            <p className="text-lg text-text-secondary mb-8">Esta página no existe o fue movida.</p>
            <a href="/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
              Volver al Inicio
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Contraseña"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
            />
            {loginError && (
              <p className="text-xs text-red-400">{loginError}</p>
            )}
            <button onClick={handleLogin} disabled={loginLoading}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/20 transition-all disabled:opacity-50">
              {loginLoading ? "..." : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingClaims = claims.filter((c) => c.status === "PENDING" || c.status === "CODE_SENT").length;
  const unclaimedCount = restaurants.filter((r) => r.isPlaceholder).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin — MenuSanJuan</h1>
            <p className="text-sm text-slate-500">Gestión de restaurantes y reclamos</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{adminEmail}</span>
            <button onClick={fetchData} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">
              Actualizar
            </button>
            <a href="/admin/guia" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">
              Guía
            </a>
            <button
              onClick={async () => {
                await fetch("/api/admin/session", { method: "DELETE" });
                setAuthed(false);
                setAdminEmail("");
              }}
              className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("restaurants")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === "restaurants" ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"
            }`}>
            🍽️ Restaurantes ({restaurants.length})
          </button>
          <button onClick={() => setTab("claims")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === "claims" ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"
            }`}>
            📋 Reclamos {pendingClaims > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{pendingClaims}</span>}
          </button>
          <button onClick={() => setTab("users")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === "users" ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"
            }`}>
            👥 Usuarios
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : tab === "restaurants" ? (
          /* Restaurants Table */
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Todos los Restaurantes</h2>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>{unclaimedCount} sin dueño</span>
                <span>{restaurants.length - unclaimedCount} con dueño</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-slate-500">
                    <th className="px-4 py-2.5 text-left font-semibold">Restaurante</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Dueño</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Estado</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Menú</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-white">{r.name}</div>
                        <div className="text-[11px] text-slate-500">/{r.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">{r.cuisineType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-white">{r.ownerEmail}</div>
                        {r.isPlaceholder && <span className="text-[10px] text-amber-400">Sin reclamar</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.isVerified ? (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Verificado</span>
                        ) : r.isPlaceholder ? (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Disponible</span>
                        ) : (
                          <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Registrado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{r.categoryCount} cat</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{r.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === "claims" ? (
          /* Claims */
          <div className="space-y-4">
            {claims.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
                <div className="text-3xl mb-3">📋</div>
                <h3 className="text-lg font-bold text-white mb-1">Sin reclamos</h3>
                <p className="text-sm text-slate-500">Los reclamos aparecerán cuando alguien quiera reclamar un restaurante.</p>
              </div>
            ) : (
              claims.map((claim) => (
                <div key={claim.id} className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{claim.dealer.name}</span>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          claim.status === "PENDING" ? "bg-amber-500/15 text-amber-400" :
                          claim.status === "CODE_SENT" ? "bg-blue-500/15 text-blue-400" :
                          claim.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" :
                          "bg-red-500/15 text-red-400"
                        }`}>
                          {claim.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Reclamado por: <strong className="text-white">{claim.user.name}</strong> ({claim.user.email})
                        {claim.user.phone && <> · {claim.user.phone}</>}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {new Date(claim.requestedAt).toLocaleString("es-AR")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">/{claim.dealer.slug}</div>
                      <div className="text-xs text-slate-500">{claim.dealer.phone}</div>
                    </div>
                  </div>

                  {claim.code && (
                    <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 mb-3 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Código:</span>
                      <span className="font-mono text-lg font-bold text-primary tracking-widest">{claim.code}</span>
                      <button onClick={() => navigator.clipboard.writeText(claim.code!)}
                        className="ml-auto text-[10px] text-primary hover:underline">Copiar</button>
                    </div>
                  )}

                  {(claim.status === "PENDING" || claim.status === "CODE_SENT") && (
                    <div className="flex gap-2">
                      {claim.status === "PENDING" && (
                        <button onClick={() => handleGenerateCode(claim.id)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors">
                          Generar Código
                        </button>
                      )}
                      <button onClick={() => handleReject(claim.id)}
                        className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                        Rechazar
                      </button>
                    </div>
                  )}

                  {claim.notes && (
                    <div className="mt-2 text-[11px] text-slate-600">Notas: {claim.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Users */
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3">
              <h2 className="text-sm font-bold text-white">Todos los Usuarios ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-slate-500">
                    <th className="px-4 py-2.5 text-left font-semibold">Usuario</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Rol</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Email Verificado</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Negocios</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Reclamos</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                        {u.phone && <div className="text-[11px] text-slate-600">{u.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          u.role === "ADMIN" ? "bg-purple-500/15 text-purple-400" :
                          u.role === "BUSINESS" ? "bg-blue-500/15 text-blue-400" :
                          "bg-slate-500/15 text-slate-400"
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.emailVerified ? (
                          <span className="text-emerald-400 text-xs">✓</span>
                        ) : (
                          <span className="text-slate-600 text-xs">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{u._count.accounts}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{u._count.claimRequests}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
