"use client";

import { useEffect, useRef, useState } from "react";

type Props = { active: boolean };

type PushStatus = "idle" | "granted" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushRegistrar({ active }: Props) {
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      typeof window === "undefined" ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushStatus("unsupported");
      return;
    }

    // Guard against StrictMode double-invocation.
    if (didRunRef.current) return;
    didRunRef.current = true;

    let cancelled = false;
    let messageHandler: ((e: MessageEvent) => void) | null = null;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (cancelled) return;

        let permission = Notification.permission;

        if (permission === "denied") {
          setPushStatus("denied");
          return;
        }

        if (permission === "default") {
          permission = await Notification.requestPermission();
          if (cancelled) return;
          if (permission !== "granted") {
            setPushStatus("denied");
            return;
          }
        }

        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublic) {
          // No key configured — silently no-op.
          setPushStatus("unsupported");
          return;
        }

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
          });
        }

        if (cancelled) return;

        // Fire-and-forget POST to server.
        try {
          const json = sub.toJSON() as {
            endpoint?: string;
            keys?: { p256dh?: string; auth?: string };
          };
          await fetch("/api/network/driver/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: json.endpoint,
              keys: {
                p256dh: json.keys?.p256dh,
                auth: json.keys?.auth,
              },
              userAgent: navigator.userAgent,
            }),
          });
        } catch {
          // Silent — matches LocationTracker convention.
        }

        if (cancelled) return;
        setPushStatus("granted");

        // Bridge SW messages → window events so foreground UI can render inline sheet.
        messageHandler = (e: MessageEvent) => {
          if (e.data?.type === "new-offer") {
            window.dispatchEvent(
              new CustomEvent("msj:new-offer", { detail: e.data.payload })
            );
          }
        };
        navigator.serviceWorker.addEventListener("message", messageHandler);
      } catch {
        if (!cancelled) setPushStatus("unsupported");
      }
    })();

    return () => {
      cancelled = true;
      if (messageHandler) {
        navigator.serviceWorker.removeEventListener("message", messageHandler);
        messageHandler = null;
      }
      // Allow re-run on next attempt.
      didRunRef.current = false;
    };
  }, [active, attempt]);

  if (!active) return null;
  if (pushStatus !== "denied") return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-medium text-red-200 backdrop-blur">
        <span>Activá las notificaciones para recibir pedidos</span>
        <button
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
