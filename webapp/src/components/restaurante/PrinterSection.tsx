"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Print agent management section in /restaurante/profile. Handles:
 *  - listing paired agents with live status (heartbeat-derived)
 *  - pairing a new agent (download + show 6-char code + poll for connection)
 *  - test-print button per agent
 *  - rename / revoke
 *
 * Lives at #impresora anchor.
 */

type Agent = {
  id: string;
  name: string;
  status: "ONLINE" | "OFFLINE";
  lastSeenAt: string | null;
  apiKeyHint: string | null;
  pairedAt: string | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  version: string | null;
  hostInfo: string | null;
  createdAt: string;
};

type PairingResult = {
  id: string;
  name: string;
  pairingCode: string;
  pairingCodeExpiresAt: string;
  downloadUrl: string;
};

function timeSince(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} hs`;
  return `${Math.round(ms / 86_400_000)} d`;
}

function timeUntil(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function PrinterSection() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/restaurante/print-agents", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setAgents(d.agents as Agent[]);
      }
    } catch { /* network blip — try again next tick */ }
  }

  // Steady-state poll every 10s — keeps status badges fresh
  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // While the pairing modal is open, poll more aggressively (every 3s) so we
  // catch the "agent just connected" moment quickly. Stops when modal closes
  // or the new agent flips to paired.
  useEffect(() => {
    if (!pairing) return;
    const fast = setInterval(async () => {
      await refresh();
    }, 3_000);
    return () => clearInterval(fast);
  }, [pairing]);

  // When the agent we're pairing flips to paired+online, close the modal
  useEffect(() => {
    if (!pairing || !agents) return;
    const matched = agents.find((a) => a.id === pairing.id && a.pairedAt && a.status === "ONLINE");
    if (matched) {
      // small delay so user sees the success state
      setTimeout(() => setPairing(null), 1500);
    }
  }, [agents, pairing]);

  async function startPairing() {
    setCreating(true);
    try {
      const r = await fetch("/api/restaurante/print-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Impresora" }),
      });
      if (r.ok) {
        const d = (await r.json()) as PairingResult;
        setPairing(d);
        refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  async function testPrint(agentId: string) {
    setTestingId(agentId);
    setTestResult(null);
    try {
      const r = await fetch(`/api/restaurante/print-agents/${agentId}/test`, { method: "POST" });
      if (r.ok) {
        setTestResult({ id: agentId, ok: true, msg: "Ticket de prueba enviado. Debería salir en unos segundos." });
      } else {
        const d = await r.json().catch(() => ({}));
        setTestResult({ id: agentId, ok: false, msg: d.error || "No se pudo enviar el test." });
      }
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(null), 8_000);
    }
  }

  async function revoke(agentId: string, name: string) {
    if (!confirm(`¿Desconectar la impresora "${name}"? Vas a tener que volver a emparejarla.`)) return;
    await fetch(`/api/restaurante/print-agents/${agentId}`, { method: "DELETE" });
    refresh();
  }

  const pairedAgents = (agents || []).filter((a) => a.pairedAt);
  const pendingAgents = (agents || []).filter((a) => !a.pairedAt && a.pairingCodeExpiresAt && new Date(a.pairingCodeExpiresAt) > new Date());

  return (
    <section id="impresora" className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 scroll-mt-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold text-lg">🖨️</div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-white">Impresora local</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Conectá la impresora térmica de tu local y los tickets salen automáticamente, sin abrir el cuadro de impresión de Windows. El QR siempre se imprime.
          </p>
        </div>
      </div>

      {agents === null ? (
        <div className="text-xs text-slate-500 py-4 text-center">Cargando...</div>
      ) : pairedAgents.length === 0 ? (
        <div className="rounded-xl bg-slate-950/50 border border-white/5 p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>QR de driver siempre se imprime (sin depender del driver de Windows)</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>El ticket sale directo a la impresora, sin abrir el cuadro de impresión</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>Funciona con cualquier impresora térmica 58mm/80mm USB en Windows 7+</span>
            </div>
          </div>
          <button
            onClick={startPairing}
            disabled={creating}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {creating ? "Generando código..." : "Conectar impresora"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {pairedAgents.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{a.name}</span>
                    {a.status === "ONLINE" ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        Offline
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Visto hace {timeSince(a.lastSeenAt)}
                    {a.hostInfo && <> · {a.hostInfo}</>}
                    {a.version && <> · v{a.version}</>}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => testPrint(a.id)}
                    disabled={testingId === a.id || a.status !== "ONLINE"}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={a.status !== "ONLINE" ? "La impresora está offline" : "Imprimir un ticket de prueba"}
                  >
                    {testingId === a.id ? "..." : "Probar"}
                  </button>
                  <button
                    onClick={() => revoke(a.id, a.name)}
                    className="rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              </div>
              {testResult?.id === a.id && (
                <div className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${
                  testResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/30 bg-red-500/10 text-red-200"
                }`}>
                  {testResult.ok ? "✓ " : "⚠️ "}{testResult.msg}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={startPairing}
            disabled={creating}
            className="w-full rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
          >
            {creating ? "Generando..." : "+ Conectar otra impresora"}
          </button>
        </div>
      )}

      {pendingAgents.length > 0 && !pairing && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-[11px] font-semibold text-amber-300">
            {pendingAgents.length} código{pendingAgents.length > 1 ? "s" : ""} de emparejamiento pendiente{pendingAgents.length > 1 ? "s" : ""}
          </div>
          {pendingAgents.map((a) => (
            <div key={a.id} className="flex items-center justify-between mt-1 text-[10px] text-amber-200">
              <span>
                Código: <span className="font-mono font-bold tracking-wider">{a.pairingCode}</span> (válido {timeUntil(a.pairingCodeExpiresAt)})
              </span>
              <button
                onClick={() => revoke(a.id, a.name)}
                className="text-amber-400/60 hover:text-red-400 underline"
              >
                cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      {pairing && (
        <PairingModal
          info={pairing}
          isPaired={!!agents?.find((a) => a.id === pairing.id && a.pairedAt && a.status === "ONLINE")}
          onClose={() => setPairing(null)}
        />
      )}
    </section>
  );
}

function PairingModal({
  info,
  isPaired,
  onClose,
}: {
  info: PairingResult;
  isPaired: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🖨️</span>
            <h3 className="text-sm font-bold text-white">Conectar nueva impresora</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {isPaired ? (
          <div className="text-center py-8 space-y-3 animate-fade-in">
            <div className="text-5xl">✓</div>
            <h3 className="text-lg font-bold text-emerald-400">Impresora conectada</h3>
            <p className="text-xs text-slate-400">Ya podés probar imprimir un ticket de prueba.</p>
            <button
              onClick={onClose}
              className="mt-3 rounded-xl bg-emerald-500 px-6 py-2 text-sm font-bold text-white"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Paso 1</div>
              <div className="text-sm font-semibold text-white mb-2">Descargá el programa para Windows</div>
              <a
                href={info.downloadUrl}
                download
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white hover:shadow-lg transition-all"
              >
                ⬇ Descargar MenuSanJuanPrint.exe
              </a>
              <div className="text-[10px] text-slate-500 mt-2">
                Tamaño: ~10 MB · Funciona en Windows 7, 8, 10 y 11
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Paso 2</div>
              <div className="text-sm font-semibold text-white mb-2">Abrí el programa y pegá este código:</div>
              <div className="rounded-lg bg-emerald-500/10 border-2 border-emerald-500/40 p-4 text-center">
                <div className="font-mono font-bold text-3xl tracking-[0.3em] text-emerald-300">
                  {info.pairingCode}
                </div>
                <div className="text-[10px] text-emerald-400/70 mt-2">
                  Válido {timeUntil(info.pairingCodeExpiresAt)}
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(info.pairingCode)}
                className="mt-2 text-[11px] text-emerald-400 hover:underline"
              >
                Copiar código
              </button>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Paso 3</div>
              <div className="text-sm font-semibold text-white">
                Esperando que se conecte...
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                <span>Esto se va a actualizar solo en cuanto el programa esté listo.</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl border border-white/10 py-2 text-xs text-slate-400 hover:bg-white/5"
            >
              Cerrar (puedo conectarla más tarde con el mismo código)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
