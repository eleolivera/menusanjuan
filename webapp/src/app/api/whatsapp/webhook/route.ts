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

// ── Restaurant + menu data ──
type RestaurantMenu = {
  slug: string;
  name: string;
  cuisineType: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  deliveryTimeMin: number | null;
  items: {
    id: string;
    name: string;
    price: number;
    description: string | null;
    category: string;
  }[];
};

let menuCache: { data: RestaurantMenu[]; summary: string; ts: number } | null =
  null;

async function getAllMenus(): Promise<{
  data: RestaurantMenu[];
  summary: string;
}> {
  // Cache for 10 minutes
  if (menuCache && Date.now() - menuCache.ts < 10 * 60 * 1000) {
    return menuCache;
  }

  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          items: {
            where: { available: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const restaurants: RestaurantMenu[] = [];
  let summary = "";

  for (const d of dealers) {
    const items: RestaurantMenu["items"] = [];
    let menuText = "";

    for (const cat of d.categories) {
      for (const item of cat.items) {
        items.push({
          id: item.id,
          name: item.name,
          price: item.price,
          description: item.description,
          category: cat.name,
        });
        menuText += `  - [${item.id}] ${item.name} ($${item.price.toLocaleString("es-AR")})${item.description ? ` — ${item.description}` : ""}\n`;
      }
    }

    if (items.length === 0) continue;

    restaurants.push({
      slug: d.slug,
      name: d.name,
      cuisineType: d.cuisineType,
      address: d.address,
      phone: d.phone,
      rating: d.rating ? Number(d.rating) : null,
      deliveryTimeMin: d.deliveryTimeMin,
      items,
    });

    summary += `\n## ${d.name} (slug: ${d.slug})`;
    summary += `\nTipo: ${d.cuisineType || "Varios"} | Rating: ${d.rating || "N/A"} | Delivery: ${d.deliveryTimeMin ? `~${d.deliveryTimeMin} min` : "Consultar"}`;
    summary += `\nMenu:\n${menuText}`;
  }

  menuCache = { data: restaurants, summary, ts: Date.now() };
  return { data: restaurants, summary };
}

// ── Generate checkout link ──
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

  const menus = await getAllMenus();
  const restaurantCount = menus.data.length;

  const systemPrompt = `Sos el asistente de MenuSanJuan, la plataforma de delivery de San Juan, Argentina. Ayudas a la gente a descubrir restaurantes, elegir que comer, y hacer pedidos.

RESTAURANTES DISPONIBLES (${restaurantCount} activos):
${menus.summary}

INSTRUCCIONES:
- Responde siempre en espanol argentino informal (vos, tuteo)
- Se calido, amigable y conciso — como un amigo que sabe de comida
- Mantene las respuestas cortas — es WhatsApp, no un email
- NUNCA uses markdown. Solo texto plano. Usa *asteriscos* para negrita de WhatsApp
- NUNCA inventes restaurantes, items ni precios que no esten en los datos

FLUJO:
1. DESCUBRIR — Si el cliente no sabe que quiere, pregunta que tipo de comida busca (cafe, pizza, sushi, hamburguesas, etc). Sugeri 2-3 restaurantes que tengan eso.
2. ELEGIR — Cuando elija un restaurante, mostra los items mas populares o relevantes (no todo el menu, solo 4-6 opciones). Si quiere ver todo el menu, manda el link: https://www.menusanjuan.com/SLUG
3. PEDIR — Ayudalo a armar el pedido. Sugeri combinaciones ("queres agregar una bebida?")
4. CHECKOUT — Cuando confirme, genera el link de checkout.

Para generar el link de checkout, al FINAL de tu mensaje agrega esta linea EXACTA:
CHECKOUT_LINK::SLUG::[{"id":"ITEM_ID","qty":CANTIDAD}]

Ejemplo si pidio 2 Cafe Mediano y 1 Brownie de HC Cafe:
CHECKOUT_LINK::hc-cafe::[{"id":"hc_cf_02","qty":2},{"id":"hc_ps_04","qty":1}]

IMPORTANTE:
- Usa los IDs exactos del menu (estan entre corchetes)
- Usa el slug exacto del restaurante
- El link se genera automaticamente, vos solo pone la linea CHECKOUT_LINK
- Si no sabes que recomendar, podes mandar al menu completo: https://www.menusanjuan.com/SLUG
- Si el cliente pide algo que ningun restaurante tiene, decile que no lo encontraste y sugeri alternativas
- Si dice "humano" o "hablar con alguien", responde: "Te comunico con alguien del equipo de MenuSanJuan. Un momento."

El cliente se llama ${name}.`;

  history.push({ role: "user", content: userMessage });
  const recentHistory = history.slice(-20);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: systemPrompt,
    messages: recentHistory,
  });

  let reply =
    response.content[0].type === "text"
      ? response.content[0].text
      : "No pude generar una respuesta.";

  // Replace CHECKOUT_LINK::slug::[items] with actual link
  const linkMatch = reply.match(/CHECKOUT_LINK::([a-z0-9-]+)::(\[.*\])/);
  if (linkMatch) {
    try {
      const slug = linkMatch[1];
      const cartItems = JSON.parse(linkMatch[2]) as {
        id: string;
        qty: number;
      }[];
      const link = buildCheckoutLink(slug, cartItems);
      reply = reply.replace(
        /CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/,
        `Completa tu pedido aca:\n${link}`
      );
    } catch {
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[.*\]/, "");
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
