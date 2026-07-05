"use client";

// Owner-driven WhatsApp composer.
//
// Opens over the /restaurante/clientes table. Owner picks a template (or
// writes free-form), tweaks the text, and clicks "Enviar por WhatsApp" → a
// wa.me link opens in a new tab. WhatsApp Desktop takes over from there.
// Zero server-side sending — every message is a human click.

import { useEffect, useMemo, useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { TEMPLATES, waHref, type Template, type TemplateVars } from "@/lib/wa-templates";

export type ComposerCustomer = {
  phone: string;
  displayName: string | null;
  lastCustomerName: string | null;
  punches: number;
  daysSinceLastOrder: number | null;
  /** Customer has ≥1 READY redemption for this dealer — reward-ready template. */
  redemptionsReady?: number;
};

export type ComposerProgram = {
  punchesNeeded: number;
  rewardItemName: string;
} | null;

export function WhatsAppComposerModal({
  customer,
  restaurantName,
  program,
  onClose,
}: {
  customer: ComposerCustomer;
  restaurantName: string;
  program: ComposerProgram;
  onClose: () => void;
}) {
  const displayName = customer.displayName || customer.lastCustomerName || null;

  const vars: TemplateVars = useMemo(
    () => ({
      name: displayName,
      restaurantName,
      punches: customer.punches,
      needed: program?.punchesNeeded,
      reward: program?.rewardItemName,
      daysSinceLastOrder: customer.daysSinceLastOrder,
    }),
    [customer, program, restaurantName, displayName]
  );

  const initialTemplate: Template = useMemo(() => {
    // Priority: (1) has a redemption waiting → reward-ready
    //           (2) accruing punches → near-reward
    //           (3) dormant → come-back
    //           (4) default first template
    if ((customer.redemptionsReady ?? 0) > 0) return TEMPLATES.find((t) => t.id === "reward-ready") || TEMPLATES[0];
    if (program && customer.punches > 0) return TEMPLATES.find((t) => t.id === "near-reward") || TEMPLATES[0];
    if ((customer.daysSinceLastOrder ?? 0) > 21) return TEMPLATES.find((t) => t.id === "come-back") || TEMPLATES[0];
    return TEMPLATES[0];
  }, [program, customer]);

  const [selectedId, setSelectedId] = useState(initialTemplate.id);
  const [text, setText] = useState(() => initialTemplate.render(vars));
  const [customized, setCustomized] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pickTemplate(id: string) {
    setSelectedId(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) {
      setText(t.render(vars));
      setCustomized(false);
    }
  }

  const previewName = displayName || customer.phone;
  const href = waHref(customer.phone, text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2">
              <MessageCircle className="h-5 w-5 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <div className="text-white font-semibold">Enviar WhatsApp a {previewName}</div>
              <div className="text-xs text-slate-400">Se abre en tu WhatsApp Desktop. Revisá antes de enviar.</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Plantilla</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedId === t.id
                      ? "bg-primary text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              {TEMPLATES.find((t) => t.id === selectedId)?.hint}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Mensaje {customized && <span className="text-primary">(editado)</span>}
            </label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setCustomized(true); }}
              rows={6}
              maxLength={1900}
              className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white text-sm leading-relaxed"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>{text.length} / 1900 caracteres</span>
              <button
                type="button"
                onClick={() => pickTemplate(selectedId)}
                className="hover:underline"
              >
                Restaurar plantilla
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Vista previa</div>
            <div className="text-sm text-slate-200 whitespace-pre-wrap">{text}</div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/10 p-5">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cancelar
          </button>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-400"
          >
            <Send className="h-4 w-4" />
            Enviar por WhatsApp
          </a>
        </footer>
      </div>
    </div>
  );
}
