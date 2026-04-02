"use client";

import { useState } from "react";
import type { OptionGroupData } from "@/data/menus";

type Props = {
  menuItemId: string;
  groups: OptionGroupData[];
  onUpdate: () => void;
  apiBase?: string; // "/api/restaurante/menu/items/option-groups" or admin equivalent
};

export function OptionGroupEditor({ menuItemId, groups, onUpdate, apiBase = "/api/restaurante/menu/items/option-groups" }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New group form
  const [newTitle, setNewTitle] = useState("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(1);
  const [newOptions, setNewOptions] = useState<{ name: string; priceDelta: number }[]>([{ name: "", priceDelta: 0 }]);

  // Edit group form
  const [editTitle, setEditTitle] = useState("");
  const [editMin, setEditMin] = useState(0);
  const [editMax, setEditMax] = useState(1);
  const [editOptions, setEditOptions] = useState<{ name: string; priceDelta: number; available?: boolean }[]>([]);

  function resetNew() {
    setNewTitle(""); setNewMin(0); setNewMax(1);
    setNewOptions([{ name: "", priceDelta: 0 }]);
    setAdding(false);
  }

  function startEdit(g: OptionGroupData) {
    setEditingId(g.id);
    setEditTitle(g.title);
    setEditMin(g.minSelections);
    setEditMax(g.maxSelections);
    setEditOptions(g.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta, available: o.available })));
  }

  async function handleCreate() {
    const opts = newOptions.filter((o) => o.name.trim());
    if (!newTitle.trim() || opts.length === 0) return;
    setSaving(true);
    await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, title: newTitle.trim(), minSelections: newMin, maxSelections: newMax, options: opts }),
    });
    setSaving(false);
    resetNew();
    onUpdate();
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const opts = editOptions.filter((o) => o.name.trim());
    setSaving(true);
    await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, title: editTitle.trim(), minSelections: editMin, maxSelections: editMax, options: opts }),
    });
    setSaving(false);
    setEditingId(null);
    onUpdate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este grupo de opciones?")) return;
    await fetch(`${apiBase}?id=${id}`, { method: "DELETE" });
    onUpdate();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-400">Opciones / Personalizacion</h4>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-[10px] text-primary hover:underline">
            + Agregar grupo
          </button>
        )}
      </div>

      {/* Existing groups */}
      {groups.map((g) => (
        <div key={g.id} className="rounded-xl border border-white/5 bg-slate-900/30 p-3">
          {editingId === g.id ? (
            <GroupForm
              title={editTitle} setTitle={setEditTitle}
              min={editMin} setMin={setEditMin}
              max={editMax} setMax={setEditMax}
              options={editOptions} setOptions={setEditOptions}
              onSave={handleSaveEdit} onCancel={() => setEditingId(null)}
              saving={saving} saveLabel="Guardar"
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{g.title}</span>
                  {g.minSelections > 0 && (
                    <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                      Obligatorio
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600">
                    {g.minSelections === g.maxSelections ? `Elegir ${g.maxSelections}` : g.minSelections === 0 ? `Hasta ${g.maxSelections}` : `${g.minSelections}-${g.maxSelections}`}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => startEdit(g)} className="text-[10px] text-slate-500 hover:text-primary transition-colors">Editar</button>
                  <button onClick={() => handleDelete(g.id)} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Eliminar</button>
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
      ))}

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
  options, setOptions, onSave, onCancel, saving, saveLabel,
}: {
  title: string; setTitle: (v: string) => void;
  min: number; setMin: (v: number) => void;
  max: number; setMax: (v: number) => void;
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

  return (
    <div className="space-y-3">
      {/* Group settings */}
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del grupo (ej: Gustos, Extras, Tamano)"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
      </div>
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

      {/* Options list */}
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={o.name} onChange={(e) => updateOption(i, "name", e.target.value)} placeholder="Nombre de la opcion"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">+$</span>
              <input type="number" min={0} value={o.priceDelta} onChange={(e) => updateOption(i, "priceDelta", Number(e.target.value))}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-right focus:border-primary focus:outline-none" />
            </div>
            {options.length > 1 && (
              <button onClick={() => removeOption(i)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">x</button>
            )}
          </div>
        ))}
        <button onClick={addOption} className="text-[10px] text-primary hover:underline">+ Agregar opcion</button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !title.trim() || options.filter((o) => o.name.trim()).length === 0}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
          {saving ? "Guardando..." : saveLabel}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
      </div>
    </div>
  );
}
