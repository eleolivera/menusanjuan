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
