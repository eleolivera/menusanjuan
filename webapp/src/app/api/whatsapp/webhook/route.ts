import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

// ── Webhook verification (Meta sends a GET to confirm ownership) ──
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WhatsApp] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── Incoming messages ──
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Meta sends various webhook events — we only care about messages
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (value?.messages) {
    for (const message of value.messages) {
      const from = message.from; // sender phone number
      const text = message.text?.body?.trim().toLowerCase();
      const contactName = value.contacts?.[0]?.profile?.name || "Cliente";

      console.log(`[WhatsApp] Message from ${from}: ${text}`);

      if (!text) continue;

      // Simple keyword-based bot for testing
      let reply: string;

      if (text === "hola" || text === "menu" || text === "menú") {
        reply = `Hola ${contactName}! Soy el bot de MenuSanJuan.\n\nEscribí:\n📋 *menu* — Ver el menú\n📍 *horarios* — Horarios de atención\n📞 *humano* — Hablar con alguien`;
      } else if (text === "horarios") {
        reply =
          "🕐 Lunes a Viernes: 11:00 - 23:00\n🕐 Sábados y Domingos: 12:00 - 00:00";
      } else if (text === "humano") {
        reply =
          "Un momento, te comunico con alguien del restaurante. ⏳";
      } else {
        reply = `No entendí "${message.text?.body}". Escribí *hola* para ver las opciones.`;
      }

      await sendWhatsAppMessage(from, reply);
    }
  }

  // Always return 200 quickly — Meta retries on failure
  return NextResponse.json({ status: "ok" });
}

// ── Send a text message via the Cloud API ──
async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp] Send failed:", err);
  }
}
