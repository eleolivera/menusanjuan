"use client";

// Shared driver admin. Two hosts:
//  - /restaurante/drivers      → api base = "/api/restaurante/drivers"
//  - /admin/network/drivers    → api base = "/api/admin/network/drivers"
//
// Same UI, same schema; the base URL prop swaps between the two auth+scope
// contexts. Adds, edits, deactivates, regenerates login codes, sends the
// code via WhatsApp.

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Send, PowerOff, Bike, Car, Copy, X } from "lucide-react";

type Driver = {
  id: string;
  phone: string;
  displayName: string;
  vehicleType: string | null;
  isActive: boolean;
  loginCode: string | null;
  loginCodeExpiresAt: string | null;
  onShift: boolean;
  lastPingAt: string | null;
  createdAt: string;
};

const VEHICLE_ICON = { moto: Bike, auto: Car, bike: Bike } as const;

export function DriverAdmin({
  apiBase,
  contextLabel,
}: {
  apiBase: string;
  contextLabel: string; // "Red MenuSanJuan" or "Mis repartidores"
}) {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [showCodeFor, setShowCodeFor] = useState<Driver | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiBase)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setDrivers(d.drivers))
      .catch((e) => setError(String(e)));
  }, [apiBase]);

  async function reload() {
    const r = await fetch(apiBase);
    if (r.ok) setDrivers((await r.json()).drivers);
  }

  async function deactivate(driver: Driver) {
    if (!confirm(`Desactivar a ${driver.displayName}? No podrá aceptar nuevos pedidos.`)) return;
    setBusyId(driver.id);
    await fetch(`${apiBase}/${driver.id}`, { method: "DELETE" });
    setBusyId(null);
    reload();
  }

  async function reactivate(driver: Driver) {
    setBusyId(driver.id);
    await fetch(`${apiBase}/${driver.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    setBusyId(null);
    reload();
  }

  async function regenerateCode(driver: Driver) {
    setBusyId(driver.id);
    const res = await fetch(`${apiBase}/${driver.id}/regenerate-code`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      const { driver: updated } = await res.json();
      setShowCodeFor({ ...driver, loginCode: updated.loginCode, loginCodeExpiresAt: updated.loginCodeExpiresAt });
      reload();
    }
  }

  function sendCode(driver: Driver) {
    if (!driver.loginCode) return;
    const firstName = driver.displayName.split(/\s+/)[0] || driver.displayName;
    const message =
      `Hola ${firstName}! Tu código para MenuSanJuan Repartidor: *${driver.loginCode}*\n\n` +
      `Instalá desde https://menusanjuan.com/repartidor y usá ese código junto a tu número.`;
    const cleanPhone = driver.phone.replace(/\D/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (error) return <div className="p-8 text-red-400 text-sm">Error cargando repartidores: {error}</div>;
  if (!drivers) return <div className="p-8 text-slate-400 text-sm">Cargando…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Repartidores</h1>
          <p className="text-sm text-slate-400 mt-1">{contextLabel} · {drivers.filter(d => d.isActive).length} activos</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
        >
          <Plus className="h-4 w-4" />
          Agregar repartidor
        </button>
      </header>

      {drivers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-10 text-center">
          <p className="text-sm text-slate-400 mb-2">Todavía no tenés repartidores cargados.</p>
          <p className="text-xs text-slate-500">Agregá al menos uno para que reciba pedidos desde la app MenuSanJuan Repartidor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((d) => {
            const VIcon = d.vehicleType && (d.vehicleType in VEHICLE_ICON) ? VEHICLE_ICON[d.vehicleType as keyof typeof VEHICLE_ICON] : Bike;
            const busy = busyId === d.id;
            return (
              <div
                key={d.id}
                className={`rounded-2xl border border-white/5 bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!d.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <VIcon className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{d.displayName}</span>
                    {d.onShift && (
                      <span className="text-[10px] rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-bold">EN TURNO</span>
                    )}
                    {!d.isActive && (
                      <span className="text-[10px] rounded-full bg-slate-700/50 px-2 py-0.5 text-slate-400 font-bold">INACTIVO</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{d.phone}</span>
                    <span>·</span>
                    <span>Alta {new Date(d.createdAt).toLocaleDateString("es-AR")}</span>
                    {d.lastPingAt && <><span>·</span><span>Último ping: {new Date(d.lastPingAt).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap sm:shrink-0">
                  {d.loginCode && (
                    <button
                      onClick={() => setShowCodeFor(d)}
                      disabled={busy}
                      className="text-xs rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-2 text-slate-300"
                      title="Ver código de acceso"
                    >
                      Código {d.loginCode}
                    </button>
                  )}
                  <button
                    onClick={() => regenerateCode(d)}
                    disabled={busy}
                    className="rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-2 text-xs text-slate-300 inline-flex items-center gap-1"
                    title="Regenerar código"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => sendCode(d)}
                    disabled={busy || !d.loginCode}
                    className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-2 text-xs text-emerald-300 inline-flex items-center gap-1 disabled:opacity-40"
                    title="Enviar código por WhatsApp"
                  >
                    <Send className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                  {d.isActive ? (
                    <button
                      onClick={() => deactivate(d)}
                      disabled={busy}
                      className="rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-300 px-2.5 py-2 text-xs text-slate-400 inline-flex items-center gap-1"
                      title="Desactivar"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivate(d)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-2 text-xs text-emerald-300"
                    >
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddDriverSheet
          apiBase={apiBase}
          onClose={() => setAddOpen(false)}
          onCreated={(driver) => {
            setAddOpen(false);
            setShowCodeFor(driver);
            reload();
          }}
        />
      )}

      {showCodeFor && <CodeSheet driver={showCodeFor} onClose={() => setShowCodeFor(null)} onSend={() => sendCode(showCodeFor)} />}
    </div>
  );
}

function AddDriverSheet({
  apiBase,
  onClose,
  onCreated,
}: {
  apiBase: string;
  onClose: () => void;
  onCreated: (driver: Driver) => void;
}) {
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [vehicleType, setVehicleType] = useState<"moto" | "auto" | "bike">("moto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, displayName, vehicleType }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "error");
      setBusy(false);
      return;
    }
    const j = await res.json();
    onCreated(j.driver);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[95vh] rounded-t-3xl sm:rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between border-b border-white/10 p-5">
          <div className="font-semibold text-white">Nuevo repartidor</div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Nombre</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Juan Pérez"
              className="mt-1 w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Teléfono (con código de país)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 264 5551234"
              className="mt-1 w-full rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-white"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-slate-300 mb-1 block">Vehículo</span>
            <div className="flex gap-2">
              {(["moto", "auto", "bike"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicleType(v)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    vehicleType === v ? "bg-primary text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {v === "moto" ? "🛵 Moto" : v === "auto" ? "🚗 Auto" : "🚲 Bici"}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-xs text-red-400">{errorLabel(error)}</div>}
        </div>
        <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-white/10 p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Cancelar</button>
          <button
            onClick={submit}
            disabled={busy || !phone.trim() || !displayName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Creando…" : "Crear"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CodeSheet({ driver, onClose, onSend }: { driver: Driver; onClose: () => void; onSend: () => void }) {
  const [copied, setCopied] = useState(false);
  const expires = driver.loginCodeExpiresAt ? new Date(driver.loginCodeExpiresAt).toLocaleString("es-AR") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[95vh] rounded-t-3xl sm:rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between border-b border-white/10 p-5">
          <div className="font-semibold text-white">Código para {driver.displayName}</div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-slate-950/60 border border-white/10 p-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Código de acceso</div>
            <div className="text-3xl font-black tracking-wider text-white font-mono">{driver.loginCode}</div>
            {expires && <div className="text-[11px] text-slate-500 mt-2">Vence {expires}</div>}
          </div>
          <p className="text-xs text-slate-400">
            Enviale este código junto al link <span className="text-white">menusanjuan.com/repartidor</span>. Al iniciar sesión, ingresa su número + este código.
          </p>
        </div>
        <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-white/10 p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(driver.loginCode || "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={onSend}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            <Send className="h-4 w-4" />
            Enviar por WhatsApp
          </button>
        </footer>
      </div>
    </div>
  );
}

function errorLabel(code: string): string {
  const map: Record<string, string> = {
    invalid_phone: "Número inválido. Usá formato internacional (+54…)",
    missing_name: "Faltó el nombre.",
    phone_in_use: "Ese teléfono ya está registrado como repartidor.",
    unauthorized: "Sesión expirada.",
    invalid_body: "Datos inválidos.",
  };
  return map[code] || `Error: ${code}`;
}
