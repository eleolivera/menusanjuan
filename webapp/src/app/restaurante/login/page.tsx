"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RestauranteLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminCleared, setAdminCleared] = useState(false);

  // Redirect if already logged in + auto-clear admin session if present
  useEffect(() => {
    (async () => {
      // If admin is logged in, destroy the admin cookie first. Admins must not
      // be able to log in as business owners — they don't own restaurants.
      const adminRes = await fetch("/api/admin/session").catch(() => null);
      if (adminRes?.ok) {
        const adminData = await adminRes.json().catch(() => null);
        if (adminData?.authenticated) {
          await fetch("/api/admin/session", { method: "DELETE" });
          setAdminCleared(true);
        }
      }

      const res = await fetch("/api/restaurante/session").catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (data?.authenticated) {
        if (data.slug) {
          router.replace("/restaurante/profile");
          return;
        }
        router.replace("/restaurante/register");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <div className="mesh-gradient flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/restaurante/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      const data = await res.json();
      if (data.mustChangePassword) {
        window.location.href = "/restaurante/setup";
      } else {
        window.location.href = "/restaurante";
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-md shadow-primary/25">
            M
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">
            Panel de Restaurante
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Ingresá con tu email y contraseña
          </p>
        </div>

        {adminCleared && (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Cerramos tu sesión de admin. Para operar como dueño, iniciá sesión con un usuario de restaurante.
          </div>
        )}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm"
        >
          <div className="space-y-4 mb-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@restaurante.com"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-danger/20 bg-red-50 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!email || !password || loading}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>

          <p className="mt-3 text-center">
            <Link href="/restaurante/reset-password" className="text-xs text-text-muted hover:text-primary transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-text-muted">
            ¿Querés sumar tu restaurante?{" "}
            <Link href="/restaurante/register" className="font-medium text-primary hover:underline">
              Registrate gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
