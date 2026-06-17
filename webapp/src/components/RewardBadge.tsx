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
  rewardDescription?: string;
  eligible?: boolean;
  hasActiveRedemption?: boolean;
};

const REWARDS_FLAG = process.env.NEXT_PUBLIC_REWARDS_ENABLED === "true";

export function RewardBadge({ slug }: { slug: string }) {
  const [data, setData] = useState<Progress | null>(null);

  useEffect(() => {
    if (!REWARDS_FLAG) return;
    // Phone lives in the same localStorage key the customer info step writes
    // — see OrderModal.tsx. We treat its absence as "first-time visitor" and
    // show the program copy with 0/N.
    const phone = readStoredPhone();
    const url = phone
      ? `/api/rewards/progress?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phone)}`
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

  if (!REWARDS_FLAG) return null;
  if (!data?.enabled) return null;
  const punches = data.punches ?? 0;
  const need = data.punchesNeeded ?? 10;
  const pct = Math.min(100, (punches / need) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 mt-3">
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
        <Gift className="h-5 w-5 text-primary shrink-0" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {data.eligible ? `🎁 ¡Premio listo! ${data.rewardName}` : data.rewardName}
          </div>
          {!data.eligible && data.rewardDescription ? (
            <div className="text-xs text-slate-300 mt-0.5">{data.rewardDescription}</div>
          ) : null}
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-xs font-bold text-primary whitespace-nowrap">
          {data.eligible ? "¡Canjealo!" : `${punches} / ${need}`}
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
