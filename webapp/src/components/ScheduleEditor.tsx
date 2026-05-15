"use client";

import { useMemo } from "react";
import { DAY_KEY_ORDER, DAY_KEY_TO_LABEL, emptyWeek, type ServiceWeekHours, type ServiceWindow } from "@/lib/hours";

type Props = {
  /** Raw JSON string of the schedule */
  value: string | null;
  onChange: (next: string) => void;
  onCopyFromOther?: () => void;
  copyFromLabel?: string;
  title: string;
  emoji?: string;
  /** Optional status indicator (SaveIndicator) */
  statusIndicator?: React.ReactNode;
};

function parse(raw: string | null): ServiceWeekHours {
  if (!raw) return emptyWeek();
  try {
    const parsed = JSON.parse(raw);
    // Migrate legacy single-window format on the fly
    const firstVal = parsed[Object.keys(parsed)[0]];
    if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal) && "open" in firstVal && "closed" in firstVal) {
      const out: ServiceWeekHours = emptyWeek();
      for (const k of Object.keys(parsed)) {
        const d = parsed[k];
        out[k] = d.closed ? [] : [{ open: d.open, close: d.close }];
      }
      return out;
    }
    // Fill any missing day keys with closed (empty array)
    const out: ServiceWeekHours = emptyWeek();
    for (const k of Object.keys(out)) {
      out[k] = parsed[k] || [];
    }
    return out;
  } catch {
    return emptyWeek();
  }
}

export function ScheduleEditor({
  value,
  onChange,
  onCopyFromOther,
  copyFromLabel,
  title,
  emoji,
  statusIndicator,
}: Props) {
  const week = useMemo(() => parse(value), [value]);

  function emit(next: ServiceWeekHours) {
    onChange(JSON.stringify(next));
  }

  function setDay(dayKey: string, windows: ServiceWindow[]) {
    emit({ ...week, [dayKey]: windows });
  }

  function toggleClosed(dayKey: string) {
    const isClosed = (week[dayKey] || []).length === 0;
    setDay(dayKey, isClosed ? [{ open: "10:00", close: "22:00" }] : []);
  }

  function setWindow(dayKey: string, idx: number, field: "open" | "close", val: string) {
    const arr = [...(week[dayKey] || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    setDay(dayKey, arr);
  }

  function addWindow(dayKey: string) {
    const arr = [...(week[dayKey] || [])];
    if (arr.length >= 2) return;
    const last = arr[arr.length - 1];
    arr.push({ open: last?.close || "20:00", close: "23:59" });
    setDay(dayKey, arr);
  }

  function removeWindow(dayKey: string, idx: number) {
    const arr = (week[dayKey] || []).filter((_, i) => i !== idx);
    setDay(dayKey, arr);
  }

  function applyToAll(dayKey: string) {
    const src = week[dayKey] || [];
    const next: ServiceWeekHours = { ...week };
    for (const k of DAY_KEY_ORDER) next[k] = src.map((w) => ({ ...w }));
    emit(next);
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          {emoji && <span>{emoji}</span>}
          <span>{title}</span>
          {statusIndicator}
        </h3>
        {onCopyFromOther && (
          <button
            type="button"
            onClick={onCopyFromOther}
            className="text-[11px] text-primary hover:underline transition-colors"
          >
            ⤴ Copiar de {copyFromLabel}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {DAY_KEY_ORDER.map((dayKey) => {
          const windows = week[dayKey] || [];
          const isClosed = windows.length === 0;
          return (
            <div key={dayKey} className="rounded-xl border border-white/5 bg-slate-800/30 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-white w-16 shrink-0">{DAY_KEY_TO_LABEL[dayKey]}</span>
                  {/* Open/Closed toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={() => toggleClosed(dayKey)}
                      className="h-4 w-7 appearance-none rounded-full bg-slate-700 transition-colors checked:bg-emerald-500 relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-3 before:w-3 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-3"
                    />
                    <span className={`text-[10px] font-medium ${isClosed ? "text-slate-500" : "text-emerald-400"}`}>
                      {isClosed ? "Cerrado" : "Abierto"}
                    </span>
                  </label>
                </div>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => applyToAll(dayKey)}
                    title="Copiar este horario a todos los días"
                    className="text-[10px] text-slate-500 hover:text-primary transition-colors"
                  >
                    Copiar a todos
                  </button>
                )}
              </div>

              {!isClosed && (
                <div className="space-y-1.5">
                  {windows.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={w.open}
                        onChange={(e) => setWindow(dayKey, idx, "open", e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500">a</span>
                      <input
                        type="time"
                        value={w.close}
                        onChange={(e) => setWindow(dayKey, idx, "close", e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                      {windows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWindow(dayKey, idx)}
                          className="text-slate-500 hover:text-red-400 text-xs px-1"
                          title="Quitar este horario"
                        >
                          ×
                        </button>
                      )}
                      {/* Visual time bar for this window */}
                      <TimeBar open={w.open} close={w.close} />
                    </div>
                  ))}
                  {windows.length < 2 && (
                    <button
                      type="button"
                      onClick={() => addWindow(dayKey)}
                      className="text-[10px] text-primary hover:underline transition-colors"
                    >
                      + Agregar 2do horario (ej: siesta)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-500 mt-3">
        Tip: si cerrás al mediodía y abrís a la noche, podés agregar dos horarios por día.
      </p>
    </section>
  );
}

/** Visual bar showing the open window on a 24-hour scale. */
function TimeBar({ open, close }: { open: string; close: string }) {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const openMin = (oh || 0) * 60 + (om || 0);
  let closeMin = (ch || 0) * 60 + (cm || 0);
  if (closeMin <= openMin) closeMin += 24 * 60;

  const leftPct = (openMin / (24 * 60)) * 100;
  const widthPct = ((closeMin - openMin) / (24 * 60)) * 100;

  return (
    <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative min-w-[40px] ml-1" title={`${open} → ${close}`}>
      <div
        className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-primary to-amber-500"
        style={{ left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` }}
      />
      {/* Past-midnight portion */}
      {closeMin > 24 * 60 && (
        <div
          className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-primary to-amber-500"
          style={{ left: 0, width: `${((closeMin - 24 * 60) / (24 * 60)) * 100}%` }}
        />
      )}
    </div>
  );
}
