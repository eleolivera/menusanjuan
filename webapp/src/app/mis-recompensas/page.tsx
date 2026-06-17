"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift, ExternalLink } from "lucide-react";

type Reward = {
  dealer: { slug: string; name: string; logoUrl: string | null };
  programName: string;
  rewardItemName: string;
  punches: number;
  punchesNeeded: number;
  eligible: boolean;
  activeRedemption: { id: string; expiresAt: string } | null;
};
type Data = {
  customer: { displayName: string | null; googleEmail: string | null };
  rewards: Reward[];
};

export default function MisRecompensasPage() {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<"loading" | "no_session" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/mis-recompensas")
      .then(async (r) => {
        if (r.status === 401) { setStatus("no_session"); return null; }
        if (r.status === 404) { setStatus("error"); return null; }
        if (!r.ok) { setStatus("error"); return null; }
        return r.json();
      })
      .then((d) => { if (d) { setData(d); setStatus("ok"); } })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return <Shell><div className="text-slate-400">Cargando…</div></Shell>;
  }
  if (status === "no_session") {
    return (
      <Shell>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            Mis recompensas
          </h1>
        </div>
        <p className="text-slate-300 mb-6">Iniciá sesión con Google para ver tus puntos en todos los restaurantes de San Juan donde pediste.</p>
        <Link
          href="/api/auth/google?intent=customer&redirect=/mis-recompensas"
          className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-3 font-semibold shadow"
        >
          Continuar con Google
        </Link>
      </Shell>
    );
  }
  if (status === "error" || !data) {
    return <Shell><div className="text-red-400">No se pudo cargar. Refrescá la página.</div></Shell>;
  }
  if (data.rewards.length === 0) {
    return (
      <Shell>
        <Header customer={data.customer} />
        <p className="text-slate-300 mt-6">Todavía no tenés puntos. Hacé un pedido en cualquier restaurante de San Juan que tenga programa de premios y empiezan a sumarse.</p>
      </Shell>
    );
  }
  return (
    <Shell>
      <Header customer={data.customer} />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.rewards.map((r) => (
          <div key={r.dealer.slug} className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 flex items-center gap-3">
            {r.dealer.logoUrl ? (
              <Image src={r.dealer.logoUrl} alt="" width={48} height={48} className="rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-700" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate">{r.dealer.name}</div>
              <div className="text-xs text-slate-400 truncate">{r.programName} · {r.rewardItemName}</div>
              <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (r.punches / r.punchesNeeded) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {r.eligible ? <span className="text-emerald-400 font-bold">🎁 Listo para canjear</span> : `${r.punches} / ${r.punchesNeeded}`}
              </div>
            </div>
            {r.eligible && !r.activeRedemption ? (
              <ClaimButton slug={r.dealer.slug} />
            ) : (
              <Link
                href={`/${r.dealer.slug}`}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-semibold whitespace-nowrap"
              >
                Ver
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">{children}</div>
    </main>
  );
}

function ClaimButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  async function claim() {
    setBusy(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`No se pudo canjear: ${j.error || "error"}`);
        setBusy(false);
        return;
      }
      // Redirect to the store with claim=1 so the resta knows the next order
      // is the redemption pickup (and so the customer can pick what else to add).
      window.location.href = `/${slug}?claim=1`;
    } catch {
      alert("No se pudo canjear. Intentá de nuevo.");
      setBusy(false);
    }
  }
  return (
    <button
      onClick={claim}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg bg-primary text-white px-3 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
    >
      {busy ? "Canjeando…" : "Canjear 🎁"}
    </button>
  );
}

function Header({ customer }: { customer: { displayName: string | null; googleEmail: string | null } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold inline-flex items-center gap-2">
        <Gift className="h-6 w-6 text-primary" />
        Mis recompensas
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        {customer.displayName ? `Hola, ${customer.displayName}` : null}
        {customer.googleEmail ? ` · ${customer.googleEmail}` : null}
      </p>
    </div>
  );
}
