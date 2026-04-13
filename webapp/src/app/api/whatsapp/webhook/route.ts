import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

const anthropic = new Anthropic();

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

  // Ignore status updates (delivered, read, etc.)
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

      // Skip duplicates
      if (processed.has(msgId)) {
        console.log(`[WhatsApp] Skipping duplicate: ${msgId}`);
        continue;
      }
      processed.add(msgId);
      setTimeout(() => processed.delete(msgId), 5 * 60 * 1000);

      console.log(`[WhatsApp] ${contactName} (${from}): ${text}`);

      try {
        const reply = await generateBotReply(from, contactName, text);
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

// ── Conversation state ──
type ConvoState = {
  messages: { role: "user" | "assistant"; content: string }[];
  selectedSlug?: string;
  ts: number;
};
const conversations = new Map<string, ConvoState>();

function getConvo(phone: string): ConvoState {
  const existing = conversations.get(phone);
  if (existing && Date.now() - existing.ts < 30 * 60 * 1000) {
    existing.ts = Date.now();
    return existing;
  }
  const fresh: ConvoState = { messages: [], ts: Date.now() };
  conversations.set(phone, fresh);
  return fresh;
}

// ── Restaurant directory ──
let dirCache: { text: string; ts: number } | null = null;

async function getDirectory(): Promise<string> {
  if (dirCache && Date.now() - dirCache.ts < 10 * 60 * 1000) return dirCache.text;

  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: { items: { where: { available: true }, select: { id: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  let text = "";
  for (const d of dealers) {
    const count = d.categories.reduce((s, c) => s + c.items.length, 0);
    if (count === 0) continue;
    text += `- ${d.name} (${d.slug}) — ${d.cuisineType || "Varios"}, ${count} items${d.rating ? `, ${d.rating} estrellas` : ""}\n`;
  }

  dirCache = { text, ts: Date.now() };
  return text;
}

// ── Single restaurant menu ──
const menuCache = new Map<string, { text: string; cats: string; ts: number }>();

async function getMenu(slug: string): Promise<{ text: string; cats: string } | null> {
  const cached = menuCache.get(slug);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached;

  const dealer = await prisma.dealer.findFirst({
    where: { slug, isActive: true },
    include: {
      categories: {
        include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!dealer) return null;

  const catNames: string[] = [];
  let text = "";

  for (const cat of dealer.categories) {
    if (cat.items.length === 0) continue;
    catNames.push(`${cat.name} (${cat.items.length})`);
    text += `\n${cat.name}\n`;
    for (const item of cat.items) {
      text += `- [${item.id}] ${item.name} ($${item.price.toLocaleString("es-AR")})${item.description ? ` — ${item.description}` : ""}\n`;
    }
  }

  const result = { text, cats: catNames.join(", "), ts: Date.now() };
  menuCache.set(slug, result);
  return result;
}

// ── Checkout link ──
function buildCheckoutLink(slug: string, items: { id: string; qty: number }[]): string {
  return `https://www.menusanjuan.com/${slug}?pedido=${btoa(JSON.stringify(items))}`;
}

// ── Generate reply ──
async function generateBotReply(phone: string, name: string, text: string): Promise<string> {
  const convo = getConvo(phone);

  const lower = text.toLowerCase();
  if (["reiniciar", "nuevo pedido", "volver", "reset", "hola", "empezar"].includes(lower)) {
    convo.messages = [];
    convo.selectedSlug = undefined;
  }

  let system: string;

  if (convo.selectedSlug) {
    const menu = await getMenu(convo.selectedSlug);
    if (!menu) {
      convo.selectedSlug = undefined;
      return "No encontre ese restaurante. Escribi *hola* para empezar de nuevo.";
    }

    system = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
El cliente eligio un restaurante. Ayudalo a pedir.

RESTAURANTE: ${convo.selectedSlug}
CATEGORIAS: ${menu.cats}

MENU (cada item tiene [ID]):
${menu.text}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown
- NO inventes items/precios
- PRIMERO mostra las categorias y pregunta cual le interesa
- Cuando elija categoria, mostra esos items con precios
- Sugeri combos ("queres agregar bebida?")
- Menu completo: https://www.menusanjuan.com/${convo.selectedSlug}

CONFIRMAR PEDIDO:
Mostra resumen + total, y al final esta linea EXACTA:
CHECKOUT_LINK::${convo.selectedSlug}::[{"id":"ID","qty":N}]

- "cambiar"/"volver" → decile que escriba *nuevo pedido*
- "humano" → "Te comunico con alguien. Un momento."

Cliente: ${name}`;
  } else {
    const dir = await getDirectory();

    system = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
Ayudas a descubrir restaurantes y pedir comida.

RESTAURANTES:
${dir}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown
- Pregunta que tipo de comida busca
- Sugeri 2-3 restaurantes que encajen
- Mostra tipo cocina y rating

CUANDO ELIJA UN RESTAURANTE:
Confirma y al FINAL agrega: SELECTED::slug-del-restaurante
Ejemplo: SELECTED::hc-cafe

- Si ya nombra un restaurante, confirma y agrega SELECTED::
- "humano" → "Te comunico con alguien. Un momento."
- Ver todos: https://www.menusanjuan.com

Cliente: ${name}`;
  }

  convo.messages.push({ role: "user", content: text });
  const recent = convo.messages.slice(-16);

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system,
    messages: recent,
  });

  let reply = res.content[0].type === "text" ? res.content[0].text : "No pude responder.";

  // Handle SELECTED::
  const sel = reply.match(/SELECTED::([a-z0-9-]+)/);
  if (sel) {
    convo.selectedSlug = sel[1];
    reply = reply.replace(/SELECTED::[a-z0-9-]+/, "").trim();
    convo.messages = [{ role: "assistant", content: reply }];
    return reply;
  }

  // Handle CHECKOUT_LINK::
  const link = reply.match(/CHECKOUT_LINK::([a-z0-9-]+)::(\[.*\])/);
  if (link) {
    try {
      const cart = JSON.parse(link[2]) as { id: string; qty: number }[];
      const url = buildCheckoutLink(link[1], cart);
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/, `Completa tu pedido aca:\n${url}`);
    } catch {
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/, "");
    }
  }

  convo.messages.push({ role: "assistant", content: reply });
  if (convo.messages.length > 16) convo.messages = convo.messages.slice(-16);

  return reply;
}

// ── Send WhatsApp message ──
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
