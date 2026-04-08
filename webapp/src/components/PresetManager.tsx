"use client";

import { useEffect, useState } from "react";

type PresetChoice = {
  id?: string;
  name: string;
  priceDelta: number;
  available: boolean;
};

type Preset = {
  id: string;
  name: string;
  options: PresetChoice[];
};

type Props = {
  /** Optional dealer slug for admin context. When omitted, uses owner session. */
  dealerSlug?: string;
};

export function PresetManager({ dealerSlug }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const qs = dealerSlug ? `?slug=${dealerSlug}` : "";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurante/option-presets${qs}`);
      if (res.ok) setPresets(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerSlug]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar la lista "${name}"? Los items que la usan quedaran sin opciones.`)) return;
    await fetch(`/api/restaurante/option-presets?id=${id}${dealerSlug ? `&slug=${dealerSlug}` : ""}`, {
      method: "DELETE",
    });
    load();
  }

  async function toggleChoice(choiceId: string, available: boolean) {
    // Optimistic update
    setPresets((prev) =>
      prev.map((p) => ({
        ...p,
        options: p.options.map((o) => (o.id === choiceId ? { ...o, available } : o)),
      }))
    );
    const res = await fetch(`/api/restaurante/option-presets/choice${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: choiceId, available }),
    });
    if (!res.ok) load(); // revert via reload
  }

  if (loading) {
    return <p className="text-xs text-slate-500">Cargando listas...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-slate-400">
            Crea listas de opciones reusables (gustos, agregados, tamanos) y reutilizalas en varios items.
            Cambias una vez, se actualiza en todos lados.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            + Nueva lista
          </button>
        )}
      </div>

      {adding && (
        <PresetForm
          dealerSlug={dealerSlug}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {presets.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-xs text-slate-500">Sin listas creadas</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Ejemplos: "Gustos de helado", "Agregados", "Tamanos"
          </p>
        </div>
      )}

      {presets.map((p) => (
        <div key={p.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
          {editingId === p.id ? (
            <PresetForm
              dealerSlug={dealerSlug}
              existing={p}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                load();
              }}
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400">⟲</span>
                  <h4 className="text-sm font-bold text-white">{p.name}</h4>
                  <span className="text-[10px] text-slate-500">
                    {p.options.length} {p.options.length === 1 ? "opcion" : "opciones"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(p.id)}
                    className="text-[11px] text-slate-400 hover:text-primary transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {p.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => o.id && toggleChoice(o.id, !o.available)}
                    title={o.available ? "Click para marcar sin stock" : "Click para marcar disponible"}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] transition-all ${
                      o.available
                        ? "border-white/10 bg-white/[0.02] text-slate-200 hover:border-white/20"
                        : "border-white/5 bg-white/[0.01] text-slate-600 line-through"
                    }`}
                  >
                    <span className="truncate">{o.name}</span>
                    {o.priceDelta > 0 && (
                      <span className="text-primary shrink-0">
                        +${o.priceDelta.toLocaleString("es-AR")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-slate-600">
                Click en una opcion para marcarla sin stock — cambia en todos los items que usan esta lista.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Create/Edit form ───

function PresetForm({
  dealerSlug,
  existing,
  onCancel,
  onSaved,
}: {
  dealerSlug?: string;
  existing?: Preset;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [options, setOptions] = useState<PresetChoice[]>(
    existing?.options.length
      ? existing.options.map((o) => ({ ...o }))
      : [{ name: "", priceDelta: 0, available: true }]
  );
  const [saving, setSaving] = useState(false);

  function updateOption(i: number, field: keyof PresetChoice, value: any) {
    const copy = [...options];
    (copy[i] as any)[field] = value;
    setOptions(copy);
  }

  function addOption() {
    setOptions([...options, { name: "", priceDelta: 0, available: true }]);
  }

  function removeOption(i: number) {
    setOptions(options.filter((_, j) => j !== i));
  }

  async function handleSave() {
    const clean = options.filter((o) => o.name.trim());
    if (!name.trim() || clean.length === 0) return;

    setSaving(true);
    const qs = dealerSlug ? `?slug=${dealerSlug}` : "";
    const payload = {
      ...(existing && { id: existing.id }),
      name: name.trim(),
      options: clean,
    };
    await fetch(`/api/restaurante/option-presets${qs}`, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    onSaved();
  }

  const canSave = name.trim() && options.filter((o) => o.name.trim()).length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la lista (ej: Gustos, Agregados, Tamanos)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
      />

      <div className="space-y-1.5">
        <label className="text-[10px] text-slate-400 block">Opciones</label>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={o.name}
              onChange={(e) => updateOption(i, "name", e.target.value)}
              placeholder="Nombre"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">+$</span>
              <input
                type="number"
                min={0}
                value={o.priceDelta}
                onChange={(e) => updateOption(i, "priceDelta", Number(e.target.value))}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white text-right focus:border-primary focus:outline-none"
              />
            </div>
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-slate-600 hover:text-red-400 text-xs transition-colors"
              >
                x
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="text-[10px] text-primary hover:underline"
        >
          + Agregar opcion
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : existing ? "Guardar" : "Crear lista"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
