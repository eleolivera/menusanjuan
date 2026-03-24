"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState("");

  async function handleRequestCode() {
    if (!email.includes("@")) { setError("Ingresá un email válido"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", email }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.code) setDevCode(data.code); // Dev mode
    setStep("code");
  }

  async function handleReset() {
    if (!code.trim()) { setError("Ingresá el código"); return; }
    if (newPassword.length < 6) { setError("Mínimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset", email, code, newPassword }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error); return; }
    setStep("done");
  }

  return (
    <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-md shadow-primary/25">
            M
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">
            Restablecer Contraseña
          </h1>
        </div>

        <div className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm">
          {step === "email" && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary text-center">
                Ingresá tu email y te enviamos un código para restablecer tu contraseña.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@restaurante.com"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <button onClick={handleRequestCode} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all disabled:opacity-50">
                {loading ? "Enviando..." : "Enviar Código"}
              </button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary text-center">
                Ingresá el código que te enviamos a <strong>{email}</strong>
              </p>
              {devCode && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
                  <span className="text-[11px] text-amber-700">Dev mode — código: </span>
                  <span className="font-mono font-bold text-amber-800">{devCode}</span>
                </div>
              )}
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código de 6 dígitos"
                maxLength={6}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nueva contraseña"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <button onClick={handleReset} disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all disabled:opacity-50">
                {loading ? "Restableciendo..." : "Restablecer Contraseña"}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                ✅
              </div>
              <h2 className="text-lg font-bold text-text mb-2">Contraseña restablecida</h2>
              <p className="text-sm text-text-secondary mb-4">Ya podés iniciar sesión con tu nueva contraseña.</p>
              <button
                onClick={() => router.push("/restaurante/login")}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all">
                Ir a Iniciar Sesión
              </button>
            </div>
          )}

          {step !== "done" && (
            <p className="mt-4 text-center text-xs text-text-muted">
              <Link href="/restaurante/login" className="hover:text-primary transition-colors">
                Volver a iniciar sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
