"use client";

import { useEffect, useRef, useState } from "react";

type Props = { active: boolean };

type Status = "idle" | "granted" | "denied" | "unavailable";

export function LocationTracker({ active }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [attempt, setAttempt] = useState(0);
  const lastSentRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        if (cancelled) return;
        setStatus("granted");
        const now = Date.now();
        if (now - lastSentRef.current < 20_000) return;
        lastSentRef.current = now;
        try {
          await fetch("/api/network/driver/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          });
        } catch {
          // ignore transient errors
        }
      },
      (err) => {
        if (cancelled) return;
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    );
    watchIdRef.current = id;

    // Wake lock — best effort.
    (async () => {
      try {
        const anyNav = navigator as any;
        if (anyNav.wakeLock?.request) {
          wakeLockRef.current = await anyNav.wakeLock.request("screen");
        }
      } catch {
        // best effort
      }
    })();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release?.();
        } catch {
          // ignore
        }
        wakeLockRef.current = null;
      }
    };
  }, [active, attempt]);

  if (!active) return null;

  const isOk = status === "granted";
  const isDenied = status === "denied" || status === "unavailable";

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      {isOk && (
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-200 backdrop-blur">
          <span>📍</span>
          <span>Enviando ubicación</span>
        </div>
      )}
      {isDenied && (
        <div className="flex items-center gap-3 rounded-full border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-medium text-red-200 backdrop-blur">
          <span>Permitir ubicación</span>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
          >
            Reintentar
          </button>
        </div>
      )}
      {status === "idle" && (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur">
          <span>Buscando ubicación...</span>
        </div>
      )}
    </div>
  );
}
