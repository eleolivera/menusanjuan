"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [path, setPath] = useState<"a" | "b" | null>(null);

  // Path A
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Path B
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.authenticated) {
          router.replace("/restaurante/login");
          return;
        }
        if (!data.mustChangePassword) {
          router.replace("/restaurante");
          return;
        }
        setRestaurantName(data.name || data.slug || "");
        setSlug(data.slug || "");
        setChecking(false);
      })
      .catch(() => router.replace("/restaurante/login"));
  }, [router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Minimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    const res = await fetch("/api/restaurante/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change-password", newPassword }),
    });
    if (res.ok) {
      window.location.href = "/restaurante";
    } else {
      const d = await res.json();
      setError(d.error || "Error");
    }
    setLoading(false);
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Ingresa tu nombre"); return; }
    if (!email.trim()) { setError("Ingresa tu email"); return; }
    if (password.length < 6) { setError("Minimo 6 caracteres"); return; }
    if (password !== confirmPw) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    const res = await fetch("/api/restaurante/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-account", name: name.trim(), email: email.trim().toLowerCase(), password }),
    });
    if (res.ok) {
      window.location.href = "/restaurante";
    } else {
      const d = await res.json();
      setError(d.error || "Error");
    }
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl text-white font-bold shadow-lg shadow-primary/25">
            {restaurantName.charAt(0) || "M"}
          </div>
          <h1 className="text-xl font-bold text-white">Bienvenido a MenuSanJuan</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configura tu acceso para <span className="text-primary font-medium">{restaurantName}</span>
          </p>
        </div>

        {/* Path selection */}
        {!path && (
          <div className="space-y-3">
            <button
              onClick={() => setPath("a")}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-left hover:border-primary/30 transition-colors group"
            >
              <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Elegir mi contraseña</p>
              <p className="text-xs text-slate-400 mt-1">Mantienes el email actual y elegis tu propia contraseña</p>
            </button>
            <button
              onClick={() => setPath("b")}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-left hover:border-primary/30 transition-colors group"
            >
              <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Crear mi propia cuenta</p>
              <p className="text-xs text-slate-400 mt-1">Usa tu email personal y elegis tu propia contraseña</p>
            </button>

            {slug && (
              <p className="text-center text-[10px] text-slate-600 mt-4">
                Tu pagina: menusanjuan.com/{slug}
              </p>
            )}
          </div>
        )}

        {/* Path A: Change password */}
        {path === "a" && (
          <form onSubmit={handleChangePassword} className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 space-y-4">
            <button type="button" onClick={() => { setPath(null); setError(""); }} className="text-xs text-slate-500 hover:text-white transition-colors">← Volver</button>
            <h2 className="text-sm font-bold text-white">Elegir contraseña</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir contraseña"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all disabled:opacity-50">
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}

        {/* Path B: Create own account */}
        {path === "b" && (
          <form onSubmit={handleCreateAccount} className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 space-y-4">
            <button type="button" onClick={() => { setPath(null); setError(""); }} className="text-xs text-slate-500 hover:text-white transition-colors">← Volver</button>
            <h2 className="text-sm font-bold text-white">Crear mi cuenta</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre completo</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Perez"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tu email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirmar contraseña</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repetir contraseña"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all disabled:opacity-50">
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
