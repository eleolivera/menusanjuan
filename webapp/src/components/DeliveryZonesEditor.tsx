"use client";

import { useState, useEffect, useRef } from "react";
import { GoogleMap, Circle, useJsApiLoader } from "@react-google-maps/api";
import { MoneyInput } from "@/components/MoneyInput";

const LIBRARIES: ("places")[] = ["places"];
const ZONE_COLORS = ["#f97316", "#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#eab308", "#ef4444"];
const MAX_ZONES = 7;

type Zone = { radius: number | null; price: number | null };

type Props = {
  /** Raw JSON from DB ("[{radius,price},...]" or null) */
  value: string | null;
  onChange: (json: string) => void;
  /** Restaurant coordinates, used to center the preview map */
  dealerLat: number | null;
  dealerLng: number | null;
  /** Optional save indicator */
  statusIndicator?: React.ReactNode;
};

function parse(raw: string | null): Zone[] {
  if (!raw) return [{ radius: 3, price: null }];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return [{ radius: 3, price: null }];
    return arr.map((z) => {
      const r = Number(z?.radius);
      const p = Number(z?.price);
      return {
        radius: Number.isFinite(r) && r > 0 ? r : null,
        price: Number.isFinite(p) && p >= 0 ? p : null,
      };
    });
  } catch {
    return [{ radius: 3, price: null }];
  }
}

/**
 * Builds the JSON we hand to the parent. Incomplete zones (missing radius or
 * price) are dropped before saving — the API validator rejects them otherwise.
 * The component keeps its own state for in-progress edits so partial zones
 * stay visible on screen while the user fills them in.
 */
function serialize(zones: Zone[]): string {
  const clean = zones
    .filter((z) => z.radius != null && z.price != null && z.radius > 0 && z.price >= 0)
    .map((z) => ({ radius: z.radius!, price: z.price! }))
    .sort((a, b) => a.radius - b.radius);
  return JSON.stringify(clean);
}

export function DeliveryZonesEditor({
  value,
  onChange,
  dealerLat,
  dealerLng,
  statusIndicator,
}: Props) {
  // Local state so partial edits (radius set, price still empty) don't get
  // dropped when serialize() filters out incomplete zones. We only re-sync
  // from `value` when it changes from outside (not from our own emit echo).
  const [zones, setZones] = useState<Zone[]>(() => parse(value));
  const lastEmittedRef = useRef<string | null>(value);

  useEffect(() => {
    // Server normalizes "[]" → null, so treat both as "no zones saved".
    const empty = (v: string | null) => v == null || v === "" || v === "[]";
    if (empty(value) && empty(lastEmittedRef.current)) return;
    if (value === lastEmittedRef.current) return;
    setZones(parse(value));
    lastEmittedRef.current = value ?? null;
  }, [value]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  function emit(next: Zone[]) {
    setZones(next);
    const serialized = serialize(next);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  }

  function setZone(i: number, patch: Partial<Zone>) {
    const next = zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z));
    emit(next);
  }

  function addZone() {
    if (zones.length >= MAX_ZONES) return;
    const last = zones[zones.length - 1];
    const nextRadius = (last?.radius ?? 0) + 2;
    emit([...zones, { radius: nextRadius, price: null }]);
  }

  function removeZone(i: number) {
    const next = zones.filter((_, idx) => idx !== i);
    // Never go below 1 zone — keep an empty default row
    emit(next.length === 0 ? [{ radius: 3, price: null }] : next);
  }

  // Validation per zone (UI-only)
  const validationMsgs: (string | null)[] = zones.map((z, i) => {
    if (z.radius == null || z.radius <= 0) return "⚠️ Falta el radio";
    if (z.price == null) return "⚠️ Falta el precio (no se guardará hasta que lo cargues)";
    if (i > 0) {
      const prev = zones[i - 1]?.radius ?? 0;
      if (z.radius - prev < 1) return `⚠️ Debe ser al menos 1 km mayor que zona ${i} (${prev} km)`;
    }
    return null;
  });

  // Largest radius for centering the map zoom
  const maxRadius = Math.max(0, ...zones.map((z) => z.radius ?? 0));
  const hasCoords = dealerLat != null && dealerLng != null;

  // Pick a zoom level that fits the largest circle (rough heuristic)
  const mapZoom = !maxRadius ? 15 : maxRadius <= 2 ? 14 : maxRadius <= 5 ? 13 : maxRadius <= 10 ? 12 : 11;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          Cobrá distinto según la distancia. Hasta {MAX_ZONES} zonas — cada una debe tener radio mayor a la anterior.
        </p>
        {statusIndicator}
      </div>

      {/* Zone rows */}
      <div className="space-y-2">
        {zones.map((z, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-slate-800/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
                />
                <span className="text-xs font-semibold text-white">Zona {i + 1}</span>
              </div>
              {zones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeZone(i)}
                  className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  × Quitar
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Radio (km)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={z.radius ?? ""}
                  onChange={(e) => setZone(i, { radius: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder={i === 0 ? "3.0" : `${(zones[i - 1]?.radius ?? 0) + 2}`}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Precio</label>
                <MoneyInput
                  value={z.price}
                  onChange={(v) => setZone(i, { price: v })}
                  placeholder={i === 0 ? "1500" : "2500"}
                  compact
                  darkMode
                />
              </div>
            </div>
            {validationMsgs[i] && (
              <div className="text-[10px] text-amber-300">{validationMsgs[i]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Add zone */}
      <button
        type="button"
        onClick={addZone}
        disabled={zones.length >= MAX_ZONES}
        className="w-full rounded-xl border border-dashed border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {zones.length >= MAX_ZONES ? `Llegaste al máximo de ${MAX_ZONES} zonas` : "+ Agregar zona"}
      </button>

      {/* Map preview with circles */}
      {hasCoords && (
        <div className="rounded-xl overflow-hidden border border-white/10 mt-3">
          <div className="px-3 py-2 bg-slate-800/60 text-[11px] text-slate-400">
            🗺️ Vista previa — tu local está en el centro, cada anillo es una zona
          </div>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "260px" }}
              center={{ lat: dealerLat!, lng: dealerLng! }}
              zoom={mapZoom}
              options={{
                disableDefaultUI: true,
                gestureHandling: "cooperative",
                scrollwheel: false,
                styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
              }}
            >
              {zones
                .filter((z) => z.radius != null && z.radius > 0)
                .map((z, i) => {
                  const color = ZONE_COLORS[i % ZONE_COLORS.length];
                  return (
                    <Circle
                      key={i}
                      center={{ lat: dealerLat!, lng: dealerLng! }}
                      radius={(z.radius || 0) * 1000} // km → meters
                      options={{
                        strokeColor: color,
                        strokeOpacity: 0.7,
                        strokeWeight: 2,
                        fillColor: color,
                        fillOpacity: 0.08,
                        clickable: false,
                      }}
                    />
                  );
                })}
            </GoogleMap>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-xs text-slate-500">Cargando mapa…</div>
          )}
          {/* Legend */}
          <div className="px-3 py-2 bg-slate-800/40 flex flex-wrap gap-2">
            {zones.map((z, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[10px] text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                Zona {i + 1} · {z.radius ?? "—"} km · {z.price != null ? `$${z.price.toLocaleString("es-AR")}` : "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasCoords && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          ⚠️ Para ver el mapa con las zonas, cargá tu ubicación arriba (sección Ubicación).
        </div>
      )}
    </div>
  );
}

/**
 * Read-only summary of zones. Used as the view-mode rendering for the
 * Tier 3 explicit-save pattern — owner sees this until they click "Editar".
 * Keeps the visual continuity with the editor (same color dots, same shape).
 */
export function ZonesSummary({ value }: { value: string | null }) {
  const zones = parse(value).filter((z) => z.radius != null && z.price != null);

  if (zones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <div className="text-2xl mb-2">📍</div>
        <p className="text-sm text-slate-300 font-medium">Todavía no configuraste zonas</p>
        <p className="text-xs text-slate-500 mt-1">
          Tocá &quot;Editar zonas&quot; para definir cuánto cobrás por distancia.
        </p>
      </div>
    );
  }

  const prices = zones.map((z) => z.price!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const farthest = Math.max(...zones.map((z) => z.radius!));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Zonas</div>
          <div className="text-sm font-bold text-white mt-0.5">{zones.length}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Alcance</div>
          <div className="text-sm font-bold text-white mt-0.5">{farthest} km</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/70">Rango</div>
          <div className="text-sm font-bold text-emerald-300 mt-0.5">
            {min === max
              ? `$${min.toLocaleString("es-AR")}`
              : `$${min.toLocaleString("es-AR")} – $${max.toLocaleString("es-AR")}`}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-white/5 bg-white/[0.02] divide-y divide-white/5">
        {zones.map((z, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
            />
            <span className="text-slate-300 font-medium">Zona {i + 1}</span>
            <span className="text-slate-500">hasta {z.radius} km</span>
            <span className="ml-auto font-semibold text-white">${z.price!.toLocaleString("es-AR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
