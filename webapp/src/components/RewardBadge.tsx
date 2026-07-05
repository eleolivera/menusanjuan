"use client";

// Small badge that shows the customer's punch progress on the store page.
// Reads phone from the same localStorage key OrderModal uses, so customers
// who've ordered before automatically see their progress without any login.
// No-op when the feature flag is off or the dealer hasn't enabled rewards.

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";

type Progress = {
  enabled: boolean;
  punches?: number;
  punchesNeeded?: number;
  rewardName?: string;
  rewardItemName?: string;
  rewardDescription?: string;
  eligible?: boolean;
  hasActiveRedemption?: boolean;
  hasGoogleSignIn?: boolean;
  needsGoogleSignIn?: boolean;
  requiresItemNames?: string[];
};

const REWARDS_FLAG = process.env.NEXT_PUBLIC_REWARDS_ENABLED === "true";

export function RewardBadge({ slug }: { slug: string }) {
  const [data, setData] = useState<Progress | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!REWARDS_FLAG) return;
    // Phone lives in the same localStorage key the customer info step writes
    // — see OrderModal.tsx. We treat its absence as "first-time visitor" and
    // show the program copy with 0/N.
    const stored = readStoredPhone();
    setPhone(stored);
    const url = stored
      ? `/api/rewards/progress?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(stored)}`
      : null;
    if (!url) {
      // Still fetch program copy with a dummy-but-valid phone — actually, we
      // can't (the route validates the phone). Instead, fetch with no phone
      // and the route returns enabled:false. Skip.
      return;
    }
    fetch(url)
      .then((r) => r.ok ? r.json() : { enabled: false })
      .then(setData)
      .catch(() => setData({ enabled: false }));
  }, [slug]);

  // Build the sign-in URL. Passing phone through OAuth state is what makes
  // the callback merge Google into the pre-existing phone-Customer instead
  // of creating a fresh `google:sub` orphan (see customer-auth.ts).
  const signInHref = (() => {
    const params = new URLSearchParams({
      intent: "customer",
      redirect: `/${slug}`,
    });
    if (phone) params.set("phone", phone);
    return `/api/auth/google?${params.toString()}`;
  })();

  if (!REWARDS_FLAG) return null;
  if (!data?.enabled) return null;
  const punches = data.punches ?? 0;
  const need = data.punchesNeeded ?? 10;
  const pct = Math.min(100, (punches / need) * 100);
  const rewardItem = data.rewardItemName || data.rewardName || "tu premio";

  // Determine which of three states to render:
  //  A) eligible + needs sign-in → prompt for Google (one-time claim)
  //  B) eligible + signed in     → "your reward will apply automatically"
  //  C) not yet eligible         → progress bar
  if (data.eligible && data.needsGoogleSignIn) {
    return (
      <div className="mx-auto max-w-7xl px-4 mt-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <Gift className="h-5 w-5 text-emerald-400 shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text">🎁 ¡Ya tenés tu premio!</div>
            <div className="text-xs text-text-secondary mt-0.5">
              Iniciá sesión con Google (una sola vez) para reclamar tu {rewardItem}. Se aplica automáticamente en tu próximo pedido.
            </div>
          </div>
          <a
            href={signInHref}
            className="whitespace-nowrap rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-text"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  if (data.eligible) {
    // Signed in and eligible — reward will auto-apply.
    const requires = data.requiresItemNames && data.requiresItemNames.length > 0
      ? `Con tu próximo ${data.requiresItemNames.slice(0, 3).join(" / ")} te llevás ${rewardItem} gratis.`
      : `${rewardItem} se agrega gratis a tu próximo pedido.`;
    return (
      <div className="mx-auto max-w-7xl px-4 mt-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <Gift className="h-5 w-5 text-emerald-400 shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text">🎁 Tu premio está esperándote</div>
            <div className="text-xs text-text-secondary mt-0.5">{requires}</div>
          </div>
          <div className="text-xs font-bold text-emerald-400 whitespace-nowrap">¡Listo!</div>
        </div>
      </div>
    );
  }

  // State D: accruing + phone customer exists but hasn't linked Google yet.
  // Show a subtle sign-in nudge below the progress bar so returning customers
  // discover the program and don't lose progress if their localStorage clears.
  const showAccruingNudge = punches > 0 && data.hasGoogleSignIn === false;

  return (
    <div className="mx-auto max-w-7xl px-4 mt-3">
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
        <Gift className="h-5 w-5 text-primary shrink-0" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text truncate">{data.rewardName}</div>
          {data.rewardDescription ? (
            <div className="text-xs text-text-secondary mt-0.5">{data.rewardDescription}</div>
          ) : null}
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          {showAccruingNudge && (
            <div className="mt-2 text-[11px] text-text-secondary flex items-center gap-2">
              <span>Iniciá sesión con Google para no perder tus puntos</span>
              <a href={signInHref} className="rounded bg-primary/20 hover:bg-primary/30 px-2 py-0.5 font-semibold text-primary">Activar</a>
            </div>
          )}
        </div>
        <div className="text-xs font-bold text-primary whitespace-nowrap">
          {punches} / {need}
        </div>
      </div>
    </div>
  );
}

function readStoredPhone(): string | null {
  try {
    const phone = (localStorage.getItem("msj_phone") || "").trim();
    return phone || null;
  } catch {
    return null;
  }
}
