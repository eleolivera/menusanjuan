import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

const anthropic = new Anthropic();

// In-memory conversation history (per phone number)
const conversations = new Map<
  string,
  { role: "user" | "assistant"; content: string }[]
>();

// ── Webhook verification ──
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

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (value?.messages) {
    for (const message of value.messages) {
      const from = message.from;
      const text = message.text?.body?.trim();
      const contactName =
        value.contacts?.[0]?.profile?.name || "Cliente";

      if (!text) continue;

      console.log(`[WhatsApp] ${contactName} (${from}): ${text}`);

      try {
        const reply = await generateBotReply(from, contactName, text);
        await sendWhatsAppMessage(from, reply);
      } catch (err) {
        console.error("[WhatsApp] Bot error:", err);
        await sendWhatsAppMessage(
          from,
          "Disculpa, tuve un problema. Intenta de nuevo en un momento."
        );
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}

// ── Menu item with ID for checkout link generation ──
type MenuItemRef = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category: string;
};

// ── Load HC Cafe menu from DB ──
let menuCache: { items: MenuItemRef[]; text: string; ts: number } | null = null;

async function getMenu(): Promise<{ items: MenuItemRef[]; text: string }> {
  // Cache for 5 minutes
  if (menuCache && Date.now() - menuCache.ts < 5 * 60 * 1000) {
    return menuCache;
  }

  const categories = await prisma.menuCategory.findMany({
    where: { dealer: { slug: "hc-cafe" } },
    include: {
      items: {
        where: { available: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const items: MenuItemRef[] = [];
  let text = "";

  for (const cat of categories) {
    if (cat.items.length === 0) continue;
    text += `\n${cat.name}\n`;
    for (const item of cat.items) {
      items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        category: cat.name,
      });
      const price = `$${item.price.toLocaleString("es-AR")}`;
      text += `- [${item.id}] ${item.name} (${price})`;
      if (item.description) text += ` — ${item.description}`;
      text += "\n";
    }
  }

  menuCache = { items, text, ts: Date.now() };
  return { items, text };
}

// ── Generate checkout link from item IDs + quantities ──
function buildCheckoutLink(
  slug: string,
  cartItems: { id: string; qty: number }[]
): string {
  const encoded = btoa(JSON.stringify(cartItems));
  return `https://www.menusanjuan.com/${slug}?pedido=${encoded}`;
}

// ── Generate reply with Claude ──
async function generateBotReply(
  phone: string,
  name: string,
  userMessage: string
): Promise<string> {
  if (!conversations.has(phone)) {
    conversations.set(phone, []);
  }
  const history = conversations.get(phone)!;

  const menu = await getMenu();

  const systemPrompt = `Sos el asistente virtual de HC Cafe, una cafeteria de especialidad en San Juan, Argentina.

DATOS DEL LOCAL:
- Direccion: Av. Jose Ignacio de la Roza Este 716, San Juan
- Telefono: 264-571-0889
- Horarios: Lunes a Sabado 8:00 a 21:00

MENU COMPLETO (cada item tiene un [ID] entre corchetes):
${menu.text}

INSTRUCCIONES:
- Responde siempre en espanol argentino informal (vos, tuteo)
- Se calido, amigable y conciso — como un mozo simpatico
- Cuando el cliente quiera pedir, ayudalo a armar el pedido conversacionalmente
- Sugeri items que combinen bien (ej: "queres agregar un cafe con eso?")
- NUNCA inventes items ni precios que no esten en el menu
- Los precios son en pesos argentinos (ARS)
- Mantene las respuestas cortas — es WhatsApp, no un email
- NUNCA uses markdown. Solo texto plano. Usa *asteriscos* para negrita de WhatsApp cuando sea util
- Si el cliente dice "humano", "persona", "hablar con alguien", responde: "Te comunico con alguien del equipo de HC Cafe. Un momento."

FLUJO DE PEDIDO:
1. Ayuda al cliente a elegir items del menu
2. Cuando el cliente confirme lo que quiere, mostra un resumen con cada item, cantidad y precio
3. Pregunta "Confirmo el pedido?"
4. Cuando confirme, genera el link de checkout. Para esto, al FINAL de tu mensaje agrega esta linea EXACTA (el sistema la reemplaza por el link real):

CHECKOUT_LINK::[{"id":"ITEM_ID","qty":CANTIDAD},{"id":"ITEM_ID","qty":CANTIDAD}]

Ejemplo si pidio 2 Cafe Mediano y 1 Brownie:
CHECKOUT_LINK::[{"id":"hc_cf_02","qty":2},{"id":"hc_ps_04","qty":1}]

IMPORTANTE: Usa los IDs exactos del menu (estan entre corchetes). El link se genera automaticamente.

El cliente se llama ${name}.`;

  history.push({ role: "user", content: userMessage });
  const recentHistory = history.slice(-20);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages: recentHistory,
  });

  let reply =
    response.content[0].type === "text"
      ? response.content[0].text
      : "No pude generar una respuesta.";

  // Replace CHECKOUT_LINK:: with actual link
  const linkMatch = reply.match(/CHECKOUT_LINK::(\[.*\])/);
  if (linkMatch) {
    try {
      const cartItems = JSON.parse(linkMatch[1]) as { id: string; qty: number }[];
      const link = buildCheckoutLink("hc-cafe", cartItems);
      reply = reply.replace(
        /CHECKOUT_LINK::\[.*\]/,
        `Completa tu pedido aca:\n${link}`
      );
    } catch {
      reply = reply.replace(/CHECKOUT_LINK::\[.*\]/, "");
    }
  }

  history.push({ role: "assistant", content: reply });

  if (history.length > 20) {
    conversations.set(phone, history.slice(-20));
  }

  return reply;
}

// ── Send message via WhatsApp Cloud API ──
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
      text: { preview_url: true, body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp] Send failed:", err);
  }
}
