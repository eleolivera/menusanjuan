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
  const [pickingPreset, setPickingPreset] = useState(false); // Show preset quick-pick
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null); // Inline preset editor
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
        <h4 className="text-xs font-bold text-slate-400">Opciones / Personalización</h4>
        {!adding && !pickingPreset && (
          <button type="button" onClick={() => {
            if (presets.length > 0) {
              setPickingPreset(true);
            } else {
              setAdding(true);
            }
          }} className="text-[10px] text-primary hover:underline">
            + Agregar grupo
          </button>
        )}
      </div>

      {/* Preset quick-pick */}
      {pickingPreset && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 animate-fade-in">
          <p className="text-xs text-slate-300">¿Usar una lista existente o crear opciones nuevas?</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPickingPreset(false);
                  setAdding(true);
                  setNewTitle(p.name);
                  setNewPresetId(p.id);
                  setNewMin(1);
                  setNewMax(p.options.length);
                }}
                className="rounded-lg bg-cyan-400/10 border border-cyan-400/20 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20 transition-colors"
              >
                ⟲ {p.name} ({p.options.length})
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setPickingPreset(false); setAdding(true); }} className="text-[10px] text-primary hover:underline">
              Opciones personalizadas
            </button>
            <button type="button" onClick={() => setPickingPreset(false)} className="text-[10px] text-slate-500 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

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

                {/* Inline preset editor */}
                {linkedPreset && editingPresetId === linkedPreset.id && (
                  <InlinePresetEditor
                    preset={linkedPreset}
                    dealerSlug={dealerSlug}
                    useAdminApi={useAdminApi}
                    onDone={() => {
                      setEditingPresetId(null);
                      // Refresh presets
                      const url = useAdminApi && dealerSlug
                        ? `/api/restaurante/option-presets?slug=${dealerSlug}`
                        : "/api/restaurante/option-presets";
                      fetch(url).then((r) => r.ok ? r.json() : []).then(setPresets).catch(() => {});
                      onUpdate();
                    }}
                  />
                )}
                {linkedPreset && editingPresetId !== linkedPreset.id && (
                  <button type="button" onClick={() => setEditingPresetId(linkedPreset.id)} className="mt-2 text-[10px] text-cyan-400 hover:underline">
                    Editar lista "{linkedPreset.name}"
                  </button>
                )}
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
              <p className="text-[10px] text-cyan-400 mb-1">Lista compartida — los cambios se aplican a todos los items que la usan.</p>
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

// ─── Inline preset editor — edit a shared list right inside the option group ───

function InlinePresetEditor({ preset, dealerSlug, useAdminApi, onDone }: {
  preset: Preset;
  dealerSlug?: string;
  useAdminApi?: boolean;
  onDone: () => void;
}) {
  const [options, setOptions] = useState(preset.options.map((o) => ({ ...o })));
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(0);

  const qs = dealerSlug ? `&slug=${dealerSlug}` : "";

  async function toggleAvailability(choiceId: string, available: boolean) {
    // Optimistic update
    setOptions((prev) => prev.map((o) => o.id === choiceId ? { ...o, available } : o));
    await fetch(`/api/restaurante/option-presets/choice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: choiceId, available, ...(dealerSlug ? { slug: dealerSlug } : {}) }),
    });
  }

  async function addChoice() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/restaurante/option-presets/choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: preset.id, name: newName.trim(), priceDelta: newPrice, ...(dealerSlug ? { slug: dealerSlug } : {}) }),
    });
    if (res.ok) {
      const data = await res.json();
      setOptions((prev) => [...prev, { id: data.id, name: newName.trim(), priceDelta: newPrice, available: true }]);
      setNewName("");
      setNewPrice(0);
    }
    setSaving(false);
  }

  async function removeChoice(choiceId: string) {
    setOptions((prev) => prev.filter((o) => o.id !== choiceId));
    await fetch(`/api/restaurante/option-presets/choice?id=${choiceId}${qs}`, { method: "DELETE" });
  }

  return (
    <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan-300">Editando: {preset.name}</span>
        <button type="button" onClick={onDone} className="text-[10px] text-slate-500 hover:text-white">Cerrar</button>
      </div>
      <p className="text-[10px] text-slate-400">Los cambios se aplican a todos los items que usan esta lista.</p>

      <div className="space-y-1">
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAvailability(o.id!, !o.available)}
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                o.available ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400" : "border-white/10 bg-white/5 text-slate-600"
              }`}
            >
              {o.available && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
            </button>
            <span className={`flex-1 text-xs ${o.available ? "text-white" : "text-slate-600 line-through"}`}>{o.name}</span>
            {o.priceDelta > 0 && <span className="text-[10px] text-primary">+${o.priceDelta.toLocaleString("es-AR")}</span>}
            <button type="button" onClick={() => removeChoice(o.id!)} className="text-slate-700 hover:text-red-400 text-[10px] transition-colors">✕</button>
          </div>
        ))}
      </div>

      {/* Add new option to the preset */}
      <div className="flex gap-2 pt-1">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva opción" onKeyDown={(e) => e.key === "Enter" && addChoice()}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
        <input type="number" min={0} value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} placeholder="+$"
          className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-right focus:border-primary focus:outline-none" />
        <button type="button" onClick={addChoice} disabled={!newName.trim() || saving} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">
          {saving ? "..." : "+"}
        </button>
      </div>
    </div>
  );
}
