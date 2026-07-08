"use client";

import { useEffect, useState } from "react";

type Props = {
  onShift: boolean;
  startedAt: string | null;
  onStart: () => void;
  onEnd: () => void;
  busy: boolean;
};

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function ShiftToggle({ onShift, startedAt, onStart, onEnd, busy }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!onShift) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onShift]);

  if (!onShift) {
    return (
      <button
        onClick={onStart}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:opacity-60"
      >
        {busy ? "Iniciando..." : "Iniciar turno"}
      </button>
    );
  }

  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-300">
            En turno
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {formatElapsed(elapsedMs)}
          </div>
        </div>
        <div className="flex h-3 w-3">
          <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
        </div>
      </div>
      <button
        onClick={onEnd}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
      >
        Finalizar turno
      </button>
    </div>
  );
}
