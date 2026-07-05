"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Save } from "lucide-react";

type MenuItem = { id: string; name: string; price: number; category: string };
type Program = {
  id: string;
  name: string;
  description: string;
  punchesNeeded: number;
  rewardItemId: string;
  expiresInDays: number;
  enabled: boolean;
  qualifyingItemIds: string[] | null;
  redemptionRequiresItemIds: string[] | null;
};
type ProgressRow = { punches: number; name: string | null; maskedPhone: string };
type Data = {
  rewardsEnabled: boolean;
  program: Program | null;
  menuItems: MenuItem[];
  topProgress: ProgressRow[];
};

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local editable copy
  const [rewardsEnabled, setRewardsEnabled] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [punchesNeeded, setPunchesNeeded] = useState(10);
  const [rewardItemId, setRewardItemId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [programEnabled, setProgramEnabled] = useState(true);
  const [restrictItems, setRestrictItems] = useState(false);
  const [qualifyingItemIds, setQualifyingItemIds] = useState<string[]>([]);
  const [qItemFilter, setQItemFilter] = useState("");
  const [restrictRedemption, setRestrictRedemption] = useState(false);
  const [redemptionRequiresItemIds, setRedemptionRequiresItemIds] = useState<string[]>([]);
  const [rItemFilter, setRItemFilter] = useState("");

  useEffect(() => {
    fetch("/api/restaurante/rewards")
      .then(async (r) => {
        if (r.status === 401) { router.push("/restaurante/login"); return null; }
        if (r.status === 404) { setData({ rewardsEnabled: false, program: null, menuItems: [], topProgress: [] }); return null; }
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d: Data | null) => {
        if (!d) return;
        setData(d);
        setRewardsEnabled(d.rewardsEnabled);
        if (d.program) {
          setName(d.program.name);
          setDescription(d.program.description);
          setPunchesNeeded(d.program.punchesNeeded);
          setRewardItemId(d.program.rewardItemId);
          setExpiresInDays(d.program.expiresInDays);
          setProgramEnabled(d.program.enabled);
          const q = Array.isArray(d.program.qualifyingItemIds) ? d.program.qualifyingItemIds : [];
          setQualifyingItemIds(q);
          setRestrictItems(q.length > 0);
          const r = Array.isArray(d.program.redemptionRequiresItemIds) ? d.program.redemptionRequiresItemIds : [];
          setRedemptionRequiresItemIds(r);
          setRestrictRedemption(r.length > 0);
        } else if (d.menuItems[0]) {
          setName("Programa de premios");
          setDescription("Juntá pedidos y llevate un premio.");
          setRewardItemId(d.menuItems[0].id);
        }
      })
      .catch((e) => console.error(e));
  }, [router]);

  function markDirty() { setDirty(true); }

  async function save() {
    if (!rewardItemId) { alert("Elegí el item del premio."); return; }
    if (restrictItems && qualifyingItemIds.length === 0) {
      alert("Elegí al menos un item que cuente para los puntos, o desactivá la restricción.");
      return;
    }
    if (restrictRedemption && redemptionRequiresItemIds.length === 0) {
      alert("Elegí al menos un item que se necesite para canjear, o desactivá la restricción.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/restaurante/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardsEnabled,
          name,
          description,
          punchesNeeded,
          rewardItemId,
          expiresInDays,
          enabled: programEnabled,
          qualifyingItemIds: restrictItems ? qualifyingItemIds : null,
          redemptionRequiresItemIds: restrictRedemption ? redemptionRequiresItemIds : null,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      const fresh = await fetch("/api/restaurante/rewards").then((r) => r.json());
      setData(fresh);
      setDirty(false);
    } catch (e) {
      alert(`No se pudo guardar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <div className="p-8 text-slate-400">Cargando…</div>;
  }
  if (data.menuItems.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Rewards</h1>
        <p className="text-slate-400">Antes de configurar un programa de premios, agregá al menos un item en tu menú.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <Gift className="h-6 w-6 text-primary" strokeWidth={2} />
            Programa de premios
          </h1>
          <p className="text-sm text-slate-400 mt-1">Premiá a los clientes que más piden. Suman 1 punto por cada pedido entregado.</p>
        </div>

        {/* Master toggle */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="font-semibold text-white">Activar programa</div>
              <div className="text-xs text-slate-400">Los clientes verán su progreso en el menú. Desactivá si querés pausarlo sin perder los puntos.</div>
            </div>
            <input
              type="checkbox"
              checked={rewardsEnabled}
              onChange={(e) => { setRewardsEnabled(e.target.checked); markDirty(); }}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </section>

        {/* Config */}
        <section className={`rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4 ${rewardsEnabled ? "" : "opacity-60 pointer-events-none"}`}>
          <Field label="Nombre del programa">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              maxLength={80}
              className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
              placeholder="Hermanos Rewards"
            />
          </Field>
          <Field label="Mensaje al cliente">
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              maxLength={240}
              rows={2}
              className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
              placeholder="Juntá 10 pedidos y llevate una hamburguesa gratis."
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pedidos para el premio">
              <input
                type="number"
                min={2}
                max={100}
                value={punchesNeeded}
                onChange={(e) => { setPunchesNeeded(Number(e.target.value) || 0); markDirty(); }}
                className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
              />
            </Field>
            <Field label="Vence (días)">
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => { setExpiresInDays(Number(e.target.value) || 0); markDirty(); }}
                className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
              />
            </Field>
          </div>
          <Field label="Item de regalo">
            <select
              value={rewardItemId}
              onChange={(e) => { setRewardItemId(e.target.value); markDirty(); }}
              className="w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
            >
              {data.menuItems.map((m) => (
                <option key={m.id} value={m.id}>{m.category} · {m.name}</option>
              ))}
            </select>
          </Field>
        </section>

        {/* Qualifying items */}
        <section className={`rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4 ${rewardsEnabled ? "" : "opacity-60 pointer-events-none"}`}>
          <div>
            <h2 className="text-sm font-semibold text-white">¿Qué pedidos cuentan?</h2>
            <p className="text-xs text-slate-400 mt-1">Elegí si cualquier pedido suma un punto o solo los que incluyan ítems específicos (por ejemplo, solo hamburguesas — no gaseosas sueltas).</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!restrictItems}
                onChange={() => { setRestrictItems(false); markDirty(); }}
                className="mt-1 accent-primary"
              />
              <div>
                <div className="text-white text-sm font-medium">Todos los pedidos entregados</div>
                <div className="text-xs text-slate-400">Cualquier pedido entregado suma 1 punto.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={restrictItems}
                onChange={() => { setRestrictItems(true); markDirty(); }}
                className="mt-1 accent-primary"
              />
              <div>
                <div className="text-white text-sm font-medium">Solo pedidos que incluyan alguno de estos ítems</div>
                <div className="text-xs text-slate-400">El pedido tiene que tener al menos uno de los ítems seleccionados. Un pedido con varios cuenta 1 punto igual.</div>
              </div>
            </label>
          </div>

          {restrictItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={qItemFilter}
                  onChange={(e) => setQItemFilter(e.target.value)}
                  placeholder="Buscar ítem…"
                  className="flex-1 rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <div className="text-xs text-slate-400 whitespace-nowrap">
                  {qualifyingItemIds.length} de {data.menuItems.length} seleccionados
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40 divide-y divide-white/5">
                {data.menuItems
                  .filter((m) => {
                    if (!qItemFilter) return true;
                    const q = qItemFilter.toLowerCase();
                    return m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
                  })
                  .map((m) => {
                    const checked = qualifyingItemIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setQualifyingItemIds((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, m.id])) : prev.filter((id) => id !== m.id)
                            );
                            markDirty();
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.category}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setQualifyingItemIds(data.menuItems.map((m) => m.id)); markDirty(); }}
                  className="text-primary hover:underline"
                >Seleccionar todos</button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => { setQualifyingItemIds([]); markDirty(); }}
                  className="text-slate-400 hover:underline"
                >Ninguno</button>
              </div>
            </div>
          )}
        </section>

        {/* Redemption requires items — "free X with your next purchase of Y" */}
        <section className={`rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4 ${rewardsEnabled ? "" : "opacity-60 pointer-events-none"}`}>
          <div>
            <h2 className="text-sm font-semibold text-white">¿Cómo se canjea el premio?</h2>
            <p className="text-xs text-slate-400 mt-1">
              Cuando un cliente junta los puntos, el premio se agrega automáticamente a su próximo pedido (gratis). Elegí si tiene que comprar algo específico para poder canjear.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!restrictRedemption}
                onChange={() => { setRestrictRedemption(false); markDirty(); }}
                className="mt-1 accent-primary"
              />
              <div>
                <div className="text-white text-sm font-medium">Se canjea en cualquier pedido</div>
                <div className="text-xs text-slate-400">El premio aparece gratis en el próximo pedido, cualquiera que sea.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={restrictRedemption}
                onChange={() => { setRestrictRedemption(true); markDirty(); }}
                className="mt-1 accent-primary"
              />
              <div>
                <div className="text-white text-sm font-medium">Solo cuando el pedido incluya alguno de estos ítems</div>
                <div className="text-xs text-slate-400">Por ejemplo: papas gratis <b>con la próxima hamburguesa</b>. Sirve para que el canje también te traiga plata.</div>
              </div>
            </label>
          </div>

          {restrictRedemption && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={rItemFilter}
                  onChange={(e) => setRItemFilter(e.target.value)}
                  placeholder="Buscar ítem…"
                  className="flex-1 rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <div className="text-xs text-slate-400 whitespace-nowrap">
                  {redemptionRequiresItemIds.length} de {data.menuItems.length} seleccionados
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40 divide-y divide-white/5">
                {data.menuItems
                  .filter((m) => {
                    if (!rItemFilter) return true;
                    const q = rItemFilter.toLowerCase();
                    return m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
                  })
                  .map((m) => {
                    const checked = redemptionRequiresItemIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setRedemptionRequiresItemIds((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, m.id])) : prev.filter((id) => id !== m.id)
                            );
                            markDirty();
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.category}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setRedemptionRequiresItemIds(data.menuItems.map((m) => m.id)); markDirty(); }}
                  className="text-primary hover:underline"
                >Seleccionar todos</button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => { setRedemptionRequiresItemIds([]); markDirty(); }}
                  className="text-slate-400 hover:underline"
                >Ninguno</button>
              </div>
            </div>
          )}
        </section>

        {/* Top customers near the prize */}
        {data.topProgress.length > 0 && (
          <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Clientes cerca del premio</h2>
            <ul className="divide-y divide-white/5">
              {data.topProgress.map((row, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <div className="text-slate-300">{row.name || row.maskedPhone}</div>
                  <div className="text-primary font-bold">{row.punches}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Save bar */}
        <div className="sticky bottom-4 flex justify-end">
          <button
            disabled={!dirty || saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : dirty ? "Guardar" : "Sin cambios"}
          </button>
        </div>
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  );
}
