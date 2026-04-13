import { NextRequest, NextResponse } from "next/server";
import { generateBotReply } from "@/lib/bot";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

// ── Webhook verification ──
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── Dedup ──
const processed = new Set<string>();

// ── Incoming messages ──
export async function POST(req: NextRequest) {
  const body = await req.json();
  const value = body.entry?.[0]?.changes?.[0]?.value;

  if (value?.statuses) {
    return NextResponse.json({ status: "ok" });
  }

  if (value?.messages) {
    for (const message of value.messages) {
      const msgId = message.id as string;
      const from = message.from as string;
      const text = (message.text?.body as string)?.trim();
      const contactName = (value.contacts?.[0]?.profile?.name as string) || "Cliente";
      if (!text || !msgId) continue;

      if (processed.has(msgId)) continue;
      processed.add(msgId);
      setTimeout(() => processed.delete(msgId), 5 * 60 * 1000);

      console.log(`[WhatsApp] ${contactName} (${from}): ${text}`);

      try {
        // Use phone number as session ID for WhatsApp
        const { reply } = await generateBotReply(`wa_${from}`, contactName, text);
        await sendWhatsAppMessage(from, reply);
        console.log(`[WhatsApp] Replied to ${from}`);
      } catch (err) {
        console.error("[WhatsApp] Bot error:", err);
        await sendWhatsAppMessage(
          from,
          "Disculpa, tuve un problema. Intenta de nuevo en un momento."
        ).catch(() => {});
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}

async function sendWhatsAppMessage(to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  });

  if (!res.ok) {
    console.error("[WhatsApp] Send failed:", await res.text());
  }
}
