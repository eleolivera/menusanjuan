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
  const [session, setSession] = useState<{ slug: string; userId?: string } | null>(null);
  const [claimStatus, setClaimStatus] = useState<"none" | "pending" | "code_sent" | "approved" | "submitting">("none");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) {
          setSession(data);
          // Check if they already have a claim
          checkExistingClaim(data.slug);
        }
      })
      .catch(() => {});
  }, []);

  async function checkExistingClaim(userSlug: string) {
    // Get user ID from session — we need to add this
    const res = await fetch(`/api/claim?dealerId=${dealerId}`);
    const claims = await res.json();
    if (Array.isArray(claims) && claims.length > 0) {
      const latest = claims[0];
      if (latest.status === "PENDING") { setClaimStatus("pending"); setClaimId(latest.id); }
      else if (latest.status === "CODE_SENT") { setClaimStatus("code_sent"); setClaimId(latest.id); }
      else if (latest.status === "APPROVED") { setClaimStatus("approved"); }
    }
  }

  async function handleSubmitClaim() {
    if (!session) return;
    setClaimStatus("submitting");
    setError("");

    // We need the user ID — get it from a dedicated endpoint
    const sessionRes = await fetch("/api/restaurante/session");
    const sessionData = await sessionRes.json();

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        dealerId,
        userId: sessionData.userId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setClaimStatus("none");
      if (data.existing) setClaimStatus("pending");
      return;
    }

    setClaimId(data.claimId);
    setClaimStatus("pending");
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

    setSuccess(true);
    setClaimStatus("approved");
  }

  // Don't show if the logged-in user already owns this restaurant
  if (session?.slug === slug) return null;

  // Already approved
  if (claimStatus === "approved" || success) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-800">Restaurante verificado</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        {/* Not logged in */}
        {!session && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏪</span>
              <span className="text-sm text-text-secondary">
                ¿<strong>{restaurantName}</strong> es tu restaurante?
              </span>
            </div>
            <Link
              href={`/restaurante/register?claim=${dealerId}`}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              Reclamalo
            </Link>
          </div>
        )}

        {/* Logged in, no claim yet */}
        {session && claimStatus === "none" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏪</span>
              <span className="text-sm text-text-secondary">
                ¿<strong>{restaurantName}</strong> es tu restaurante?
              </span>
            </div>
            <button
              onClick={handleSubmitClaim}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              Reclamar este restaurante
            </button>
          </div>
        )}

        {claimStatus === "submitting" && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-text-secondary">Enviando reclamo...</span>
          </div>
        )}

        {/* Claim pending */}
        {claimStatus === "pending" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <span className="text-sm text-text-secondary">
                Tu reclamo está <strong>pendiente de revisión</strong>. Te vamos a contactar con un código de verificación.
              </span>
            </div>
          </div>
        )}

        {/* Code sent — enter code */}
        {claimStatus === "code_sent" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔑</span>
              <span className="text-sm text-text-secondary">
                Ingresá el código de verificación que te enviamos:
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
              <button
                onClick={handleVerifyCode}
                disabled={code.length < 6}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Verificar
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-danger">{error}</p>
        )}
      </div>
    </div>
  );
}
