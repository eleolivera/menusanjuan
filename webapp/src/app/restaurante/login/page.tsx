"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function RestauranteLoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Cancelaste el inicio de sesión con Google",
  google_admin: "Los admins no pueden iniciar sesión como dueños",
  google_expired: "La sesión expiró, intentá de nuevo",
  google_server: "Error al conectar con Google, intentá de nuevo",
  google_no_email: "No pudimos obtener tu email de Google",
};

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminCleared, setAdminCleared] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Show Google OAuth errors from redirect
  useEffect(() => {
    const googleError = searchParams.get("error");
    if (googleError && GOOGLE_ERRORS[googleError]) {
      setError(GOOGLE_ERRORS[googleError]);
    }
  }, [searchParams]);

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

  if (checking || googleLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="text-center animate-fade-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-md shadow-primary/25">
            M
          </div>
          {googleLoading && <p className="text-sm text-text-secondary mt-3">Conectando con Google...</p>}
        </div>
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
        <div className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => {
              setGoogleLoading(true);
              window.location.href = "/api/auth/google?redirect=/restaurante";
            }}
            disabled={googleLoading}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-text border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continuar con Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-surface px-3 text-text-muted">o ingresá con email</span></div>
          </div>

        <form
          onSubmit={handleLogin}
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
    </div>
  );
}
