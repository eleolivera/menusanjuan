"use client";

import type { ReactNode } from "react";

/**
 * Standard wrapper for any section on the owner profile / admin restaurant
 * edit page. Locks the visual shape so every section feels the same:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ Title                          [status pill] │
 *   │ Optional subtitle/description                │
 *   ├─────────────────────────────────────────────┤
 *   │                                              │
 *   │  {children — actual form fields}             │
 *   │                                              │
 *   ├─────────────────────────────────────────────┤  ← only when footer set
 *   │ {footer — Save/Cancel buttons for Tier 3}    │
 *   └─────────────────────────────────────────────┘
 *
 * Save patterns supported:
 *   - Tier 1 (instant)   → status indicator alone, no footer
 *   - Tier 2 (autosave)  → status indicator alone, no footer
 *   - Tier 3 (explicit)  → footer with Save/Cancel buttons, header status
 *                          shows "Sin guardar" when there are pending changes
 */
export function ProfileSection({
  title,
  subtitle,
  status,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {status && <div className="shrink-0">{status}</div>}
        </div>
      </header>

      <div className="px-6 pb-6">{children}</div>

      {footer && (
        <footer className="border-t border-white/5 bg-white/[0.015] px-6 py-3.5">
          {footer}
        </footer>
      )}
    </section>
  );
}

/**
 * Standard Save/Cancel button pair for the footer of a Tier 3 section.
 * Handles the dirty-state + busy-state visuals automatically.
 */
export function ProfileSectionFooter({
  dirty,
  saving,
  onCancel,
  onSave,
  saveLabel = "Guardar cambios",
  cancelLabel = "Cancelar",
}: {
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] text-slate-500">
        {dirty
          ? "⚠️ Tenés cambios sin guardar"
          : "Todo guardado"}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={!dirty || saving}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
        >
          {saving && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {saving ? "Guardando..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Section-level status pill — shows "Sin guardar" / "Guardado" / "Guardando".
 * For Tier 1/2 sections, pass the per-field SaveIndicator instead.
 */
export function SectionStatus({
  dirty,
  saving,
}: {
  dirty: boolean;
  saving: boolean;
}) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
        <span className="h-2 w-2 animate-spin rounded-full border border-blue-300 border-t-transparent" />
        Guardando
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        ● Sin guardar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
      ✓ Guardado
    </span>
  );
}
