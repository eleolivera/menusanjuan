"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function ClaimBanner({
  dealerId,
  restaurantName,
  slug,
}: {
  dealerId: string;
  restaurantName: string;
  slug: string;
}) {
  const [session, setSession] = useState<any>(null);
  const [claimState, setClaimState] = useState<"none" | "pending" | "code_sent" | "approved" | "submitting">("none");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) {
          setSession(data);
          // Check existing claims for this dealer by this user
          fetch(`/api/claim?dealerId=${dealerId}`)
            .then((r) => r.json())
            .then((claims) => {
              if (Array.isArray(claims) && claims.length > 0) {
                const c = claims[0];
                if (c.status === "PENDING") { setClaimState("pending"); setClaimId(c.id); }
                else if (c.status === "CODE_SENT") { setClaimState("code_sent"); setClaimId(c.id); }
                else if (c.status === "APPROVED") { setClaimState("approved"); }
              }
            });
        }
      });
  }, [dealerId]);

  async function handleSubmitClaim() {
    setClaimState("submitting");
    setError("");

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", dealerId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      if (data.claimId) { setClaimId(data.claimId); setClaimState(data.status?.toLowerCase() || "pending"); }
      else setClaimState("none");
      return;
    }

    setClaimId(data.claimId);
    setClaimState("pending");
  }

  async function handleVerifyCode() {
    if (!claimId || !code.trim()) return;
    setError("");

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", claimId, code: code.trim() }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error); return; }
    setClaimState("approved");
    // Reload to update header + page
    setTimeout(() => window.location.reload(), 1000);
  }

  // Don't show if logged-in user owns this restaurant (any of their restaurants)
  if (session?.activeRestaurant?.slug === slug) return null;
  if (session?.restaurants?.some((r: any) => r.slug === slug)) return null;
  // Don't show if already approved
  if (claimState === "approved") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <span className="text-emerald-600">✅</span>
          <span className="text-sm font-medium text-emerald-800">Restaurante verificado — ¡Ahora es tuyo!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        {/* Not logged in */}
        {!session && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">🏪</span>
              <span className="text-sm text-text-secondary truncate">
                ¿<strong>{restaurantName}</strong> es tu restaurante?
              </span>
            </div>
            <Link
              href={`/restaurante/register?claim=${dealerId}`}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              Reclamalo
            </Link>
          </div>
        )}

        {/* Logged in, no claim yet */}
        {session && claimState === "none" && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">🏪</span>
              <span className="text-sm text-text-secondary truncate">
                ¿<strong>{restaurantName}</strong> es tu restaurante?
              </span>
            </div>
            <button onClick={handleSubmitClaim}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors">
              Reclamar
            </button>
          </div>
        )}

        {claimState === "submitting" && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-text-secondary">Enviando reclamo...</span>
          </div>
        )}

        {/* Pending */}
        {claimState === "pending" && (
          <div className="flex items-center gap-2">
            <span className="text-lg">⏳</span>
            <span className="text-sm text-text-secondary">
              Tu reclamo está <strong>pendiente</strong>. Te vamos a contactar con un código.
            </span>
          </div>
        )}

        {/* Code sent — enter code */}
        {claimState === "code_sent" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔑</span>
              <span className="text-sm text-text-secondary">
                Ingresá el código de verificación:
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-28 rounded-lg border border-border bg-white px-3 py-2 text-center text-sm font-mono font-bold tracking-widest text-text uppercase focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleVerifyCode} disabled={code.length < 6}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                Verificar
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
