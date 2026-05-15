"use client";

import { useMemo, useRef, useState, useEffect } from "react";
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
                <div className="space-y-3">
                  {windows.map((w, idx) => {
                    const overnight = isOvernight(w.open, w.close);
                    const nextDayLabel = overnight ? nextDayName(dayKey) : null;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center gap-2">
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
                            className={`rounded-lg border bg-white/5 px-2 py-1.5 text-xs text-white focus:outline-none ${
                              overnight ? "border-indigo-400/50 focus:border-indigo-400" : "border-white/10 focus:border-primary"
                            }`}
                          />
                          {overnight && (
                            <span className="text-[10px] text-indigo-300 flex items-center gap-1">
                              <span>🌙</span>
                              <span>cierra el {nextDayLabel}</span>
                            </span>
                          )}
                          {windows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeWindow(dayKey, idx)}
                              className="ml-auto text-slate-500 hover:text-red-400 text-xs px-1"
                              title="Quitar este horario"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {/* Visual time bar with draggable handles, full width */}
                        <TimeBar
                          open={w.open}
                          close={w.close}
                          onChange={(o, c) => {
                            if (o !== w.open) setWindow(dayKey, idx, "open", o);
                            if (c !== w.close) setWindow(dayKey, idx, "close", c);
                          }}
                        />
                      </div>
                    );
                  })}
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
        Tip: si cerrás al mediodía y abrís a la noche, podés agregar dos horarios por día. Si cerrás <em>después de medianoche</em> (ej. Viernes 20:00 → 02:00), poné la hora de cierre normal — el horario se entiende como hasta la madrugada del día siguiente.
      </p>
    </section>
  );
}

function isOvernight(open: string, close: string): boolean {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const openMin = (oh || 0) * 60 + (om || 0);
  const closeMin = (ch || 0) * 60 + (cm || 0);
  return closeMin > 0 && closeMin <= openMin;
}

const NEXT_DAY: Record<string, string> = {
  lun: "Martes", mar: "Miércoles", mie: "Jueves", jue: "Viernes",
  vie: "Sábado", sab: "Domingo", dom: "Lunes",
};

function nextDayName(dayKey: string): string {
  return NEXT_DAY[dayKey] || "día siguiente";
}

/**
 * Visual range slider for a single open/close window.
 * Bar represents 0–28h (4am next day max), with a vertical midnight line so
 * overnight windows visibly continue past it to the right. Handles at both ends
 * are draggable (snap to 15 min) — typing in the time inputs above also works.
 */
function TimeBar({
  open,
  close,
  onChange,
}: {
  open: string;
  close: string;
  onChange: (open: string, close: string) => void;
}) {
  const TOTAL_MIN = 28 * 60; // bar spans 0h → 28h
  const SNAP_MIN = 15;
  const MIDNIGHT_MIN = 24 * 60;
  const midnightPct = (MIDNIGHT_MIN / TOTAL_MIN) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"open" | "close" | null>(null);

  const openMin = toMin(open);
  let closeMin = toMin(close);
  const overnight = closeMin > 0 && closeMin <= openMin;
  if (overnight) closeMin += MIDNIGHT_MIN;

  const openPct = (openMin / TOTAL_MIN) * 100;
  const closePct = (Math.min(closeMin, TOTAL_MIN) / TOTAL_MIN) * 100;

  function minFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect();
    const rel = (clientX - rect.left) / rect.width;
    const raw = rel * TOTAL_MIN;
    const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    return Math.max(0, Math.min(TOTAL_MIN, snapped));
  }

  useEffect(() => {
    if (!dragging) return;
    function move(e: MouseEvent | TouchEvent) {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const m = minFromClientX(clientX);
      if (dragging === "open") {
        // Don't let open jump past close
        const cAbs = overnight ? toMin(close) + MIDNIGHT_MIN : toMin(close);
        const newOpen = Math.min(m, Math.max(0, cAbs - SNAP_MIN));
        onChange(fromMin(newOpen % MIDNIGHT_MIN), close);
      } else {
        // close: clamp to >= open + SNAP_MIN, allow past midnight
        const newClose = Math.max(m, openMin + SNAP_MIN);
        onChange(open, fromMin(newClose % MIDNIGHT_MIN));
      }
      e.preventDefault();
    }
    function end() {
      setDragging(null);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", end);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", end);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
    };
  }, [dragging, open, close, openMin, overnight, onChange]);

  // Hour labels along the track — every 4 hours + midnight callout
  const hourTicks = [0, 4, 8, 12, 16, 20, 24, 28];

  return (
    <div className="w-full select-none">
      {/* Track */}
      <div ref={trackRef} className="relative h-7" style={{ touchAction: "pan-y" }}>
        {/* Background track */}
        <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-slate-800" />

        {/* Midnight separator */}
        <div
          className="absolute top-0 bottom-0 w-px bg-slate-500"
          style={{ left: `${midnightPct}%` }}
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-medium text-slate-400 whitespace-nowrap">
            12am
          </span>
        </div>

        {/* Selected range */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-2 ${overnight ? "rounded-l-full" : "rounded-full"} bg-gradient-to-r from-primary to-amber-500`}
          style={{ left: `${openPct}%`, width: `${Math.max(0, closePct - openPct)}%` }}
        />

        {/* Open handle */}
        <button
          type="button"
          aria-label="Hora de apertura"
          onMouseDown={() => setDragging("open")}
          onTouchStart={() => setDragging("open")}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white border-2 border-primary shadow-md transition-transform ${dragging === "open" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"}`}
          style={{ left: `${openPct}%` }}
        />

        {/* Close handle */}
        <button
          type="button"
          aria-label="Hora de cierre"
          onMouseDown={() => setDragging("close")}
          onTouchStart={() => setDragging("close")}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white border-2 border-amber-500 shadow-md transition-transform ${dragging === "close" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"}`}
          style={{ left: `${closePct}%` }}
        />
      </div>

      {/* Hour tick labels */}
      <div className="relative h-3 mt-0.5">
        {hourTicks.map((h) => {
          const pct = (h * 60) / TOTAL_MIN * 100;
          const label = h === 0 ? "0" : h === 24 ? "" : h > 24 ? `+${h - 24}` : `${h}`;
          if (!label) return null;
          return (
            <span
              key={h}
              className="absolute top-0 -translate-x-1/2 text-[8px] text-slate-600"
              style={{ left: `${pct}%` }}
            >
              {label}h
            </span>
          );
        })}
      </div>
    </div>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMin(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
