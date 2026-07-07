import { NextRequest, NextResponse } from "next/server";
import { generateBotReply } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

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

// sendWhatsAppMessage now lives in lib/whatsapp.ts so any server code can
// call it. Bot webhook is one caller among many going forward (driver
// onboarding, offer push fallbacks, shift summaries, heartbeat-lost alerts).
