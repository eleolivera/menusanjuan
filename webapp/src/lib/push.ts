import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type PushPayload = {
  type: "offer";
  offerId: string;
  orderId: string;
  restauranteName: string;
  deliveryFee: number;
  distanceKm: number | null;
  expiresAt: string; // ISO
};

let vapidReady = false;
let vapidWarned = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    if (!vapidWarned) {
      console.warn("[push] VAPID not configured; skipping");
      vapidWarned = true;
    }
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export async function sendPushToDriver(
  driverId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; unsubscribed: number }> {
  let sent = 0;
  let failed = 0;
  let unsubscribed = 0;

  try {
    if (!ensureVapid()) {
      return { sent: 0, failed: 0, unsubscribed: 0 };
    }

    const subs = await prisma.driverPushSubscription.findMany({
      where: { driverId },
    });

    const body = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          {
            // FCM priority=high → Android shows as heads-up banner + plays the
            // default notification sound + is displayed even in Doze mode.
            // Without this, the notification lands silently in the shade and
            // drivers routinely miss it. Legitimate use — an actual pending
            // order deserves a heads-up.
            urgency: "high",
            // TTL 45s matches the offer TTL — if the driver's phone was
            // offline > 45s, the offer has expired anyway, no point queueing.
            TTL: 45,
          },
        );
        sent++;
      } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string };
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          try {
            await prisma.driverPushSubscription.delete({
              where: { endpoint: sub.endpoint },
            });
          } catch {
            // ignore — may have been deleted concurrently
          }
          unsubscribed++;
        } else {
          failed++;
          console.warn("[push] send failed:", e?.statusCode, e?.body);
        }
      }
    }

    console.info(
      "[push] driver=%s sent=%d failed=%d unsubscribed=%d",
      driverId,
      sent,
      failed,
      unsubscribed,
    );
    return { sent, failed, unsubscribed };
  } catch (err) {
    console.warn("[push] unexpected error:", err);
    return { sent, failed, unsubscribed };
  }
}
