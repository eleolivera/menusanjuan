// Server-side WhatsApp send via the Meta WhatsApp Business API. Extracted
// from the bot webhook route so any server code can send a one-off text —
// driver onboarding codes, push fallbacks, shift summaries, heartbeat
// alerts, etc.
//
// Never fails an upstream flow: returns { ok: boolean, error?: string }
// and never throws. Missing env vars are treated as "not configured" (ok:
// false, no error thrown) so calls from best-effort hooks don't 500.

const GRAPH_API_VERSION = "v21.0";

export type SendResult =
  | { ok: true; whatsappMessageId: string | null }
  | { ok: false; error: string };

/**
 * Send a plain-text WhatsApp message to `to` (E.164 without leading +, or
 * with + — WABA accepts both; we strip + defensively). Reuses the same
 * Graph API path the bot webhook uses.
 *
 * `previewUrl` (default true) tells WhatsApp to render URL previews inline.
 * Turn off for pure notification texts where link cards would be noise.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  opts: { previewUrl?: boolean } = {}
): Promise<SendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "WABA not configured (missing env)" };
  }

  const cleanTo = to.replace(/^\+/, "").replace(/\D/g, "");
  if (cleanTo.length < 8) return { ok: false, error: "invalid recipient phone" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanTo,
          type: "text",
          text: {
            preview_url: opts.previewUrl !== false,
            body: text,
          },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[whatsapp] send failed:", res.status, body);
      return { ok: false, error: `graph_${res.status}` };
    }

    const json = await res.json().catch(() => null);
    return { ok: true, whatsappMessageId: json?.messages?.[0]?.id ?? null };
  } catch (err) {
    console.error("[whatsapp] send exception:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
