"use client";

// Owner-driven gift-reward modal. Owner picks a customer in CRM → clicks 🎁
// Regalar → this modal → picks type (free item / discount) → server creates a
// Redemption with a code → modal returns the code so the caller can hand it
// off to the WhatsApp composer for delivery to the customer.
//
// No customer identity is captured here — the caller passes the customerId.

import { useEffect, useState } from "react";
import { X, Gift, Percent, DollarSign, ShoppingBag } from "lucide-react";

type MenuItemOption = { id: string; name: string; category: string };

export type GiftResult = {
  code: string;
  expiresAt: string;
  description: string; // human copy for the WhatsApp message (e.g. "10% off")
};

type Kind = "GIFT_ITEM" | "GIFT_DISCOUNT_PCT" | "GIFT_DISCOUNT_AMOUNT";

export function GiftRewardModal({
  customerId,
  customerLabel,
  menuItems,
  onClose,
  onGifted,
}: {
  customerId: string;
  customerLabel: string;
  menuItems: MenuItemOption[];
  onClose: () => void;
  onGifted: (result: GiftResult) => void;
}) {
  const [kind, setKind] = useState<Kind>("GIFT_DISCOUNT_PCT");
  const [pct, setPct] = useState<number>(10);
  const [amount, setAmount] = useState<number>(500);
  const [itemId, setItemId] = useState<string>(menuItems[0]?.id || "");
  const [ttlDays, setTtlDays] = useState<30 | 60 | 90>(60);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { kind, ttlDays };
      if (kind === "GIFT_ITEM") {
        if (!itemId) { setError("Elegí un ítem"); setSaving(false); return; }
        body.giftMenuItemId = itemId;
      } else if (kind === "GIFT_DISCOUNT_PCT") {
        if (pct < 1 || pct > 100) { setError("Porcentaje entre 1 y 100"); setSaving(false); return; }
        body.giftDiscountPct = pct;
      } else if (kind === "GIFT_DISCOUNT_AMOUNT") {
        if (amount < 1) { setError("Monto mayor a $0"); setSaving(false); return; }
        body.giftDiscountAmount = amount;
      }
      if (note.trim()) body.giftNote = note.trim();

      const res = await fetch(`/api/restaurante/customers/${customerId}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "No se pudo crear el regalo");
        setSaving(false);
        return;
      }
      const gift = await res.json() as { code: string; expiresAt: string };

      // Build a customer-facing description so the caller can drop it into WhatsApp.
      let description = "";
      if (kind === "GIFT_ITEM") {
        const item = menuItems.find((m) => m.id === itemId);
        description = item ? `${item.name} gratis` : "un ítem gratis";
      } else if (kind === "GIFT_DISCOUNT_PCT") {
        description = `${pct}% de descuento`;
      } else {
        description = `$${amount.toLocaleString("es-AR")} de descuento`;
      }
      onGifted({ code: gift.code, expiresAt: gift.expiresAt, description });
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[95vh] rounded-t-3xl sm:rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Gift className="h-5 w-5 text-primary" strokeWidth={2} />
            </div>
            <div>
              <div className="text-white font-semibold">Regalar recompensa a {customerLabel}</div>
              <div className="text-xs text-slate-400">Se genera un código único que el cliente usa en su próximo pedido.</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Type picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Tipo de regalo</label>
            <div className="grid grid-cols-3 gap-2">
              <TypeButton active={kind === "GIFT_DISCOUNT_PCT"} onClick={() => setKind("GIFT_DISCOUNT_PCT")} Icon={Percent} label="% descuento" />
              <TypeButton active={kind === "GIFT_DISCOUNT_AMOUNT"} onClick={() => setKind("GIFT_DISCOUNT_AMOUNT")} Icon={DollarSign} label="$ descuento" />
              <TypeButton active={kind === "GIFT_ITEM"} onClick={() => setKind("GIFT_ITEM")} Icon={ShoppingBag} label="Ítem gratis" />
            </div>
          </div>

          {/* Type-specific input */}
          {kind === "GIFT_DISCOUNT_PCT" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Porcentaje</label>
              <div className="flex flex-wrap gap-2 items-center">
                {[5, 10, 15, 20].map((p) => (
                  <button key={p} type="button" onClick={() => setPct(p)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      pct === p ? "bg-primary text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}>
                    {p}%
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1} max={100}
                    value={pct}
                    onChange={(e) => setPct(Number(e.target.value) || 0)}
                    className="w-20 rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
              </div>
            </div>
          )}

          {kind === "GIFT_DISCOUNT_AMOUNT" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Monto en pesos</label>
              <div className="flex flex-wrap gap-2 items-center">
                {[500, 1000, 2000, 5000].map((a) => (
                  <button key={a} type="button" onClick={() => setAmount(a)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      amount === a ? "bg-primary text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}>
                    ${a.toLocaleString("es-AR")}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-28 rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {kind === "GIFT_ITEM" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Ítem</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
              >
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.category} · {m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Vence en</label>
            <div className="flex gap-2">
              {([30, 60, 90] as const).map((d) => (
                <button key={d} type="button" onClick={() => setTtlDays(d)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    ttlDays === d ? "bg-primary text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}>
                  {d} días
                </button>
              ))}
            </div>
          </div>

          {/* Internal note */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Nota interna <span className="text-slate-500">(opcional)</span></label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Por ejemplo: cliente top, disculpa por demora, etc."
              maxLength={120}
              className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white"
            />
            <div className="text-[11px] text-slate-500 mt-1">Solo la ves vos — no se muestra al cliente.</div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-white/10 p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Gift className="h-4 w-4" />
            {saving ? "Creando…" : "Regalar y enviar WhatsApp"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TypeButton({ active, onClick, Icon, label }: {
  active: boolean; onClick: () => void; Icon: typeof Percent; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs font-medium transition ${
        active
          ? "border-primary/50 bg-primary/10 text-white"
          : "border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-slate-400"}`} strokeWidth={2} />
      {label}
    </button>
  );
}
