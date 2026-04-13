import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

const anthropic = new Anthropic();

// Per-phone conversation state
type ConvoState = {
  messages: { role: "user" | "assistant"; content: string }[];
  selectedSlug?: string; // once a restaurant is picked
};
const conversations = new Map<string, ConvoState>();

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

// ── Incoming messages ──
export async function POST(req: NextRequest) {
  const body = await req.json();
  const value = body.entry?.[0]?.changes?.[0]?.value;

  if (value?.messages) {
    for (const message of value.messages) {
      const from = message.from;
      const text = message.text?.body?.trim();
      const contactName = value.contacts?.[0]?.profile?.name || "Cliente";
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

// ── Restaurant directory (lightweight, no items) ──
type RestaurantSummary = {
  slug: string;
  name: string;
  cuisineType: string | null;
  rating: number | null;
  deliveryTimeMin: number | null;
  itemCount: number;
};

let directoryCache: { list: RestaurantSummary[]; text: string; ts: number } | null = null;

async function getDirectory(): Promise<{ list: RestaurantSummary[]; text: string }> {
  if (directoryCache && Date.now() - directoryCache.ts < 10 * 60 * 1000) {
    return directoryCache;
  }

  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: { items: { where: { available: true }, select: { id: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const list: RestaurantSummary[] = [];
  let text = "";

  for (const d of dealers) {
    const itemCount = d.categories.reduce((sum, c) => sum + c.items.length, 0);
    if (itemCount === 0) continue;

    list.push({
      slug: d.slug,
      name: d.name,
      cuisineType: d.cuisineType,
      rating: d.rating ? Number(d.rating) : null,
      deliveryTimeMin: d.deliveryTimeMin,
      itemCount,
    });

    text += `- ${d.name} (${d.slug}) — ${d.cuisineType || "Varios"}, ${itemCount} items${d.rating ? `, ${d.rating} estrellas` : ""}\n`;
  }

  directoryCache = { list, text, ts: Date.now() };
  return { list, text };
}

// ── Single restaurant menu (loaded on demand) ──
type MenuItem = { id: string; name: string; price: number; description: string | null; category: string };

const menuCache = new Map<string, { items: MenuItem[]; text: string; ts: number }>();

async function getRestaurantMenu(slug: string): Promise<{ items: MenuItem[]; text: string } | null> {
  const cached = menuCache.get(slug);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached;

  const dealer = await prisma.dealer.findFirst({
    where: { slug, isActive: true },
    include: {
      categories: {
        include: {
          items: { where: { available: true }, orderBy: { sortOrder: "asc" } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!dealer) return null;

  const items: MenuItem[] = [];
  let text = "";

  for (const cat of dealer.categories) {
    if (cat.items.length === 0) continue;
    text += `\n${cat.name}\n`;
    for (const item of cat.items) {
      items.push({ id: item.id, name: item.name, price: item.price, description: item.description, category: cat.name });
      text += `- [${item.id}] ${item.name} ($${item.price.toLocaleString("es-AR")})${item.description ? ` — ${item.description}` : ""}\n`;
    }
  }

  const result = { items, text, ts: Date.now() };
  menuCache.set(slug, result);
  return result;
}

// ── Checkout link ──
function buildCheckoutLink(slug: string, cartItems: { id: string; qty: number }[]): string {
  const encoded = btoa(JSON.stringify(cartItems));
  return `https://www.menusanjuan.com/${slug}?pedido=${encoded}`;
}

// ── Generate reply ──
async function generateBotReply(phone: string, name: string, userMessage: string): Promise<string> {
  if (!conversations.has(phone)) {
    conversations.set(phone, { messages: [] });
  }
  const convo = conversations.get(phone)!;

  // Reset conversation if user says "reiniciar" or "nuevo pedido"
  const lower = userMessage.toLowerCase();
  if (lower === "reiniciar" || lower === "nuevo pedido" || lower === "volver") {
    convo.messages = [];
    convo.selectedSlug = undefined;
  }

  let systemPrompt: string;

  if (convo.selectedSlug) {
    // ── STEP 2: Restaurant selected, show its menu ──
    const menu = await getRestaurantMenu(convo.selectedSlug);
    if (!menu) {
      convo.selectedSlug = undefined;
      return "No encontre ese restaurante. Escribi *hola* para empezar de nuevo.";
    }

    systemPrompt = `Sos el asistente de MenuSanJuan, la plataforma de delivery de San Juan, Argentina.
El cliente ya eligio el restaurante. Ahora ayudalo a armar su pedido.

RESTAURANTE: ${convo.selectedSlug}
MENU COMPLETO (cada item tiene un [ID] entre corchetes):
${menu.text}

INSTRUCCIONES:
- Responde en espanol argentino informal (vos, tuteo)
- Se calido y conciso — es WhatsApp
- NUNCA uses markdown. Texto plano + *negrita WhatsApp*
- NUNCA inventes items ni precios
- Sugeri 4-6 items destacados si el cliente no sabe que pedir
- Sugeri combinaciones ("queres agregar una bebida?")
- Si quiere ver todo el menu: https://www.menusanjuan.com/${convo.selectedSlug}

CUANDO EL CLIENTE CONFIRME SU PEDIDO:
Mostra resumen con items, cantidades y total.
Al FINAL agrega esta linea EXACTA (el sistema genera el link):
CHECKOUT_LINK::${convo.selectedSlug}::[{"id":"ITEM_ID","qty":CANTIDAD}]

- Si dice "otro restaurante", "cambiar", o "volver", responde que puede escribir *nuevo pedido* para empezar de nuevo
- Si dice "humano", responde: "Te comunico con alguien del equipo. Un momento."

El cliente se llama ${name}.`;
  } else {
    // ── STEP 1: Help discover a restaurant ──
    const dir = await getDirectory();

    systemPrompt = `Sos el asistente de MenuSanJuan, la plataforma de delivery de San Juan, Argentina.
Ayudas a la gente a descubrir donde comer y hacer pedidos.

RESTAURANTES DISPONIBLES (${dir.list.length}):
${dir.text}

INSTRUCCIONES:
- Responde en espanol argentino informal (vos, tuteo)
- Se calido y conciso — es WhatsApp
- NUNCA uses markdown. Texto plano + *negrita WhatsApp*
- Pregunta que tipo de comida busca si no lo dice
- Sugeri 2-3 restaurantes que encajen con lo que busca
- Mostra tipo de cocina y rating si tiene

CUANDO EL CLIENTE ELIJA UN RESTAURANTE:
Responde confirmando la eleccion y agrega al FINAL esta linea EXACTA:
SELECTED::slug-del-restaurante

Ejemplo si elige HC Cafe:
SELECTED::hc-cafe

- Si el cliente ya dice un restaurante de entrada, confirma y agrega SELECTED::
- Si dice "humano", responde: "Te comunico con alguien del equipo. Un momento."
- Si quiere ver todos los restaurantes: https://www.menusanjuan.com

El cliente se llama ${name}.`;
  }

  convo.messages.push({ role: "user", content: userMessage });
  const recentMessages = convo.messages.slice(-20);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages: recentMessages,
  });

  let reply = response.content[0].type === "text"
    ? response.content[0].text
    : "No pude generar una respuesta.";

  // Handle SELECTED:: — restaurant was chosen
  const selectedMatch = reply.match(/SELECTED::([a-z0-9-]+)/);
  if (selectedMatch) {
    convo.selectedSlug = selectedMatch[1];
    reply = reply.replace(/SELECTED::[a-z0-9-]+/, "").trim();
    // Clear message history for fresh menu conversation
    convo.messages = [];
    convo.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  // Handle CHECKOUT_LINK:: — order confirmed
  const linkMatch = reply.match(/CHECKOUT_LINK::([a-z0-9-]+)::(\[.*\])/);
  if (linkMatch) {
    try {
      const slug = linkMatch[1];
      const cartItems = JSON.parse(linkMatch[2]) as { id: string; qty: number }[];
      const link = buildCheckoutLink(slug, cartItems);
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/, `Completa tu pedido aca:\n${link}`);
    } catch {
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/, "");
    }
  }

  convo.messages.push({ role: "assistant", content: reply });
  if (convo.messages.length > 20) {
    convo.messages = convo.messages.slice(-20);
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
