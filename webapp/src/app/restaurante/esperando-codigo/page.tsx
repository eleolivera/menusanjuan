"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type PendingClaim = {
  id: string;
  status: string;
  dealer: { id: string; name: string; slug: string };
};

export default function EsperandoCodigoPageWrapper() {
  return (
    <Suspense>
      <EsperandoCodigoPage />
    </Suspense>
  );
}

function EsperandoCodigoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitClaimId = searchParams.get("claimId");

  const [loading, setLoading] = useState(true);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [active, setActive] = useState<PendingClaim | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/restaurante/session");
      if (!res.ok) {
        router.replace("/restaurante/login");
        return;
      }
      const data = await res.json();
      const claims: PendingClaim[] = data.pendingClaims || [];
      setPendingClaims(claims);

      // Pick active claim: explicit ?claimId wins, else first pending
      const chosen = explicitClaimId
        ? claims.find((c) => c.id === explicitClaimId)
        : claims[0];

      if (!chosen) {
        // No pending claims — bounce to dashboard
        router.replace("/restaurante");
        return;
      }
      setActive(chosen);
      setLoading(false);
    })();
  }, [router, explicitClaimId]);

  async function handleVerify() {
    if (!active || !code.trim()) return;
    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", claimId: active.id, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Código incorrecto");
        setVerifying(false);
        return;
      }
      // Success — ownership transferred, session updated. Go to the dashboard.
      window.location.href = "/restaurante";
    } catch {
      setError("Error de conexión");
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="mesh-gradient flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!active) return null;

  const statusLabel =
    active.status === "CODE_SENT"
      ? "Ya te enviamos el código"
      : "Esperando que te enviemos el código";

  return (
    <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl shadow-md shadow-primary/25">
            ⏳
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">
            {statusLabel}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Pediste reclamar <strong>{active.dealer.name}</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm space-y-5">
          {active.status === "PENDING" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-900 font-medium mb-1">
                Estamos verificando tu pedido
              </p>
              <p className="text-xs text-amber-700">
                En breve te vamos a contactar por WhatsApp con un código de 6 letras
                para confirmar que sos el dueño.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Ingresá el código cuando lo tengas
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-text uppercase focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 text-center">{error}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={verifying || code.trim().length < 6}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {verifying ? "Verificando..." : "Confirmar código"}
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Link
              href={`/${active.dealer.slug}`}
              className="text-xs text-text-secondary hover:text-primary transition-colors"
            >
              Ver el restaurante
            </Link>
            <button
              onClick={async () => {
                await fetch("/api/restaurante/session", { method: "DELETE" });
                router.push("/restaurante/login");
              }}
              className="text-xs text-text-secondary hover:text-text transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {pendingClaims.length > 1 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-text-secondary mb-2">
              Tenés {pendingClaims.length} reclamos pendientes
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {pendingClaims.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActive(c);
                    setCode("");
                    setError("");
                    router.replace(`/restaurante/esperando-codigo?claimId=${c.id}`);
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                    c.id === active.id
                      ? "bg-primary text-white"
                      : "bg-surface border border-border text-text-secondary hover:border-primary"
                  }`}
                >
                  {c.dealer.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
