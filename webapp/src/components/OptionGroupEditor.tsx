"use client";

import { useState, useEffect } from "react";
import type { OptionGroupData } from "@/data/menus";

type Preset = {
  id: string;
  name: string;
  options: { id: string; name: string; priceDelta: number; available: boolean }[];
};

type Props = {
  menuItemId: string;
  groups: OptionGroupData[];
  onUpdate: () => void;
  apiBase?: string;
  useAdminApi?: boolean;
  /** When admin views the owner restaurant, pass the slug so preset API can find the dealer */
  dealerSlug?: string;
};

export function OptionGroupEditor({ menuItemId, groups, onUpdate, apiBase = "/api/restaurante/menu/items/option-groups", useAdminApi, dealerSlug }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);

  // New group form
  const [newTitle, setNewTitle] = useState("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(1);
  const [newPresetId, setNewPresetId] = useState<string>("");
  const [newOptions, setNewOptions] = useState<{ name: string; priceDelta: number }[]>([{ name: "", priceDelta: 0 }]);

  // Edit group form
  const [editTitle, setEditTitle] = useState("");
  const [editMin, setEditMin] = useState(0);
  const [editMax, setEditMax] = useState(1);
  const [editPresetId, setEditPresetId] = useState<string>("");
  const [editOptions, setEditOptions] = useState<{ name: string; priceDelta: number; available?: boolean }[]>([]);

  // Fetch presets for this dealer
  useEffect(() => {
    const url = useAdminApi && dealerSlug
      ? `/api/restaurante/option-presets?slug=${dealerSlug}`
      : "/api/restaurante/option-presets";
    fetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then(setPresets)
      .catch(() => {});
  }, [useAdminApi, dealerSlug]);

  function resetNew() {
    setNewTitle(""); setNewMin(0); setNewMax(1);
    setNewPresetId("");
    setNewOptions([{ name: "", priceDelta: 0 }]);
    setAdding(false);
  }

  function startEdit(g: OptionGroupData) {
    setEditingId(g.id);
    setEditTitle(g.title);
    setEditMin(g.minSelections);
    setEditMax(g.maxSelections);
    setEditPresetId(g.presetId || "");
    setEditOptions(g.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta, available: o.available })));
  }

  async function handleCreate() {
    // Must have either a preset or inline options
    const opts = newOptions.filter((o) => o.name.trim());
    if (!newTitle.trim()) return;
    if (!newPresetId && opts.length === 0) return;

    setSaving(true);
    const payload = {
      menuItemId,
      title: newTitle.trim(),
      minSelections: newMin,
      maxSelections: newMax,
      presetId: newPresetId || null,
      // Send options only when NOT using a preset
      options: newPresetId ? [] : opts,
    };
    if (useAdminApi) {
      await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "option-group", ...payload }) });
    } else {
      await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    resetNew();
    onUpdate();
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const opts = editOptions.filter((o) => o.name.trim());
    setSaving(true);
    const payload = {
      id: editingId,
      title: editTitle.trim(),
      minSelections: editMin,
      maxSelections: editMax,
      presetId: editPresetId || null,
      options: editPresetId ? [] : opts,
    };
    if (useAdminApi) {
      await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "option-group", ...payload }) });
    } else {
      await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    setEditingId(null);
    onUpdate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este grupo de opciones?")) return;
    if (useAdminApi) {
      await fetch(`${apiBase}?type=option-group&targetId=${id}`, { method: "DELETE" });
    } else {
      await fetch(`${apiBase}?id=${id}`, { method: "DELETE" });
    }
    onUpdate();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-400">Opciones / Personalizacion</h4>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-[10px] text-primary hover:underline">
            + Agregar grupo
          </button>
        )}
      </div>

      {/* Existing groups */}
      {groups.map((g) => {
        const linkedPreset = g.presetId ? presets.find((p) => p.id === g.presetId) : null;
        return (
          <div key={g.id} className="rounded-xl border border-white/5 bg-slate-900/30 p-3">
            {editingId === g.id ? (
              <GroupForm
                title={editTitle} setTitle={setEditTitle}
                min={editMin} setMin={setEditMin}
                max={editMax} setMax={setEditMax}
                presetId={editPresetId} setPresetId={setEditPresetId}
                presets={presets}
                options={editOptions} setOptions={setEditOptions}
                onSave={handleSaveEdit} onCancel={() => setEditingId(null)}
                saving={saving} saveLabel="Guardar"
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{g.title}</span>
                    {g.minSelections > 0 && (
                      <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded font-medium">Obligatorio</span>
                    )}
                    <span className="text-[10px] text-slate-600">
                      {g.minSelections === g.maxSelections ? `Elegir ${g.maxSelections}` : g.minSelections === 0 ? `Hasta ${g.maxSelections}` : `${g.minSelections}-${g.maxSelections}`}
                    </span>
                    {linkedPreset && (
                      <span className="text-[9px] bg-cyan-400/10 text-cyan-400 px-1.5 py-0.5 rounded font-medium">
                        ⟲ {linkedPreset.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => startEdit(g)} className="text-[10px] text-slate-500 hover:text-primary transition-colors">Editar</button>
                    <button type="button" onClick={() => handleDelete(g.id)} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Eliminar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <span key={o.id} className={`rounded-lg border px-2 py-1 text-[11px] ${o.available ? "border-white/10 text-slate-300" : "border-white/5 text-slate-600 line-through"}`}>
                      {o.name}
                      {o.priceDelta > 0 && <span className="text-primary ml-1">+${o.priceDelta.toLocaleString("es-AR")}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && !adding && (
        <p className="text-[10px] text-slate-600 text-center py-2">Sin opciones configuradas</p>
      )}

      {/* Add new group form */}
      {adding && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <GroupForm
            title={newTitle} setTitle={setNewTitle}
            min={newMin} setMin={setNewMin}
            max={newMax} setMax={setNewMax}
            presetId={newPresetId} setPresetId={setNewPresetId}
            presets={presets}
            options={newOptions} setOptions={setNewOptions}
            onSave={handleCreate} onCancel={resetNew}
            saving={saving} saveLabel="Crear grupo"
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared form for creating/editing a group ───

function GroupForm({
  title, setTitle, min, setMin, max, setMax,
  presetId, setPresetId, presets,
  options, setOptions, onSave, onCancel, saving, saveLabel,
}: {
  title: string; setTitle: (v: string) => void;
  min: number; setMin: (v: number) => void;
  max: number; setMax: (v: number) => void;
  presetId: string; setPresetId: (v: string) => void;
  presets: Preset[];
  options: { name: string; priceDelta: number; available?: boolean }[];
  setOptions: (v: { name: string; priceDelta: number; available?: boolean }[]) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; saveLabel: string;
}) {
  function updateOption(i: number, field: string, value: any) {
    const copy = [...options];
    (copy[i] as any)[field] = value;
    setOptions(copy);
  }

  function addOption() {
    setOptions([...options, { name: "", priceDelta: 0 }]);
  }

  function removeOption(i: number) {
    setOptions(options.filter((_, j) => j !== i));
  }

  const linkedPreset = presetId ? presets.find((p) => p.id === presetId) : null;
  const canSave = title.trim() && (presetId || options.filter((o) => o.name.trim()).length > 0);

  return (
    <div className="space-y-3">
      {/* Group title */}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo del grupo (ej: Gustos, Extras, Tamano)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />

      {/* Min/Max rules */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-400">Min</label>
          <input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))}
            className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-center focus:border-primary focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-400">Max</label>
          <input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))}
            className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-center focus:border-primary focus:outline-none" />
        </div>
        <span className="text-[10px] text-slate-600 self-center">
          {min > 0 ? "Obligatorio" : "Opcional"} · {max === 1 ? "Una opcion" : `Hasta ${max}`}
        </span>
      </div>

      {/* Preset picker */}
      {presets.length > 0 && (
        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Lista de opciones</label>
          <select
            value={presetId}
            onChange={(e) => {
              const next = e.target.value;
              // Warn once if switching from custom → preset with unsaved inline options
              const hasInline = !presetId && options.some((o) => o.name.trim());
              if (next && hasInline) {
                if (!confirm("Se reemplazaran las opciones personalizadas por la lista reusable. Seguir?")) return;
              }
              setPresetId(next);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
          >
            <option value="" className="bg-slate-900">— Opciones personalizadas —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900">
                ⟲ {p.name} ({p.options.length} opciones)
              </option>
            ))}
          </select>
          {linkedPreset && (
            <div className="mt-2 rounded-lg bg-cyan-400/5 border border-cyan-400/20 p-2">
              <p className="text-[10px] text-cyan-400 mb-1">Usando lista reusable. Editala en Ajustes → Listas reusables para que cambie en todos los items.</p>
              <div className="flex flex-wrap gap-1">
                {linkedPreset.options.slice(0, 8).map((o) => (
                  <span key={o.id} className="text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded">
                    {o.name}
                  </span>
                ))}
                {linkedPreset.options.length > 8 && (
                  <span className="text-[9px] text-slate-500">+{linkedPreset.options.length - 8} mas</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline options (only when no preset selected) */}
      {!presetId && (
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 block">Opciones</label>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={o.name} onChange={(e) => updateOption(i, "name", e.target.value)} placeholder="Nombre"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">+$</span>
                <input type="number" min={0} value={o.priceDelta} onChange={(e) => updateOption(i, "priceDelta", Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-right focus:border-primary focus:outline-none" />
              </div>
              {options.length > 1 && (
                <button type="button" onClick={() => removeOption(i)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">x</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOption} className="text-[10px] text-primary hover:underline">+ Agregar opcion</button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={onSave} disabled={saving || !canSave}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
          {saving ? "Guardando..." : saveLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
      </div>
    </div>
  );
}
