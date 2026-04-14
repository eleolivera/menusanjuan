import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic();

// ── Conversation state (DB-backed for Vercel serverless) ──
export type BotMessage = { role: "user" | "assistant"; content: string };

export type ConvoState = {
  messages: BotMessage[];
  selectedSlug?: string;
};

export async function getConvo(sessionId: string): Promise<ConvoState> {
  const row = await prisma.$queryRawUnsafe<{ messages: string; selectedSlug: string | null }[]>(
    `SELECT messages, "selectedSlug" FROM "BotConversation" WHERE id = $1`,
    sessionId
  );
  if (row.length > 0) {
    return {
      messages: JSON.parse(row[0].messages),
      selectedSlug: row[0].selectedSlug || undefined,
    };
  }
  return { messages: [] };
}

async function saveConvo(sessionId: string, convo: ConvoState) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "BotConversation" (id, messages, "selectedSlug", "updatedAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET messages = $2, "selectedSlug" = $3, "updatedAt" = NOW()`,
    sessionId,
    JSON.stringify(convo.messages),
    convo.selectedSlug || null
  );
}

export async function resetConvo(sessionId: string) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "BotConversation" WHERE id = $1`,
    sessionId
  );
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

// ── Debug info returned alongside reply ──
export type BotDebug = {
  selectedSlug: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  responseMs: number;
  systemPromptLength: number;
};

// ── Generate reply ──
export async function generateBotReply(
  sessionId: string,
  name: string,
  text: string
): Promise<{ reply: string; debug: BotDebug }> {
  let convo = await getConvo(sessionId);

  const lower = text.toLowerCase();
  if (["reiniciar", "nuevo pedido", "volver", "reset", "hola", "empezar"].includes(lower)) {
    convo = { messages: [] };
    await saveConvo(sessionId, convo);
  }

  let system: string;

  if (convo.selectedSlug) {
    const menu = await getMenu(convo.selectedSlug);
    if (!menu) {
      convo.selectedSlug = undefined;
      return {
        reply: "No encontre ese restaurante. Escribi *hola* para empezar de nuevo.",
        debug: { selectedSlug: null, inputTokens: 0, outputTokens: 0, costCents: 0, responseMs: 0, systemPromptLength: 0 },
      };
    }

    system = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
El cliente ya eligio el restaurante. QUEDATE EN ESTE RESTAURANTE. No sugiereas otros restaurantes a menos que el cliente lo pida explicitamente.

RESTAURANTE: ${convo.selectedSlug}
CATEGORIAS: ${menu.cats}

MENU (cada item tiene [ID]):
${menu.text}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown, NO emojis excesivos
- NO inventes items/precios
- NO numeres las categorias ni los items. Mostralos por nombre
- Cuando mostres categorias, listalas por nombre nada mas
- Si el cliente dice que quiere algo (ej "un lomo"), busca en el menu de ESTE restaurante y mostra las opciones que coincidan
- Si no encontras lo que pide en el menu, decile que no lo tienen y mostra que si tienen
- Sugeri combos ("queres agregar bebida?")
- Si el cliente quiere ver todo: https://www.menusanjuan.com/${convo.selectedSlug}

CONFIRMAR PEDIDO:
Mostra resumen + total, y al final esta linea EXACTA:
CHECKOUT_LINK::${convo.selectedSlug}::[{"id":"ID","qty":N}]

- Solo si el cliente dice "otro restaurante" o "cambiar" → decile que escriba *nuevo pedido*
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
- Texto plano + *negrita*. NO markdown, NO emojis excesivos
- Pregunta que tipo de comida busca
- Sugeri 2-3 restaurantes que encajen
- Mostra tipo cocina y rating

SELECCIONAR RESTAURANTE:
Es MUY IMPORTANTE que emitas SELECTED:: en estos casos:
- El cliente nombra un restaurante → SELECTED::slug
- El cliente dice "a ver que tiene X" o "mostrame X" → SELECTED::slug
- El cliente dice "dale" o "si" despues de que sugeriste uno → SELECTED::slug
- El cliente dice "quiero pedir de X" → SELECTED::slug

Al FINAL de tu mensaje agrega: SELECTED::slug-del-restaurante
Ejemplo: SELECTED::hc-cafe

NUNCA describas un restaurante sin seleccionarlo. Si el cliente muestra interes en un restaurante especifico, seleccionalo directamente.

- "humano" → "Te comunico con alguien. Un momento."
- Ver todos: https://www.menusanjuan.com

Cliente: ${name}`;
  }

  convo.messages.push({ role: "user", content: text });
  const recent = convo.messages.slice(-16);

  const start = Date.now();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system,
    messages: recent,
  });
  const responseMs = Date.now() - start;

  let reply = res.content[0].type === "text" ? res.content[0].text : "No pude responder.";

  // Cost: Haiku input $0.80/M, output $4/M
  const inputTokens = res.usage.input_tokens;
  const outputTokens = res.usage.output_tokens;
  const costCents = (inputTokens * 0.08 + outputTokens * 0.4) / 1000;

  // Handle SELECTED:: — restaurant chosen, now load its menu and respond in context
  const sel = reply.match(/SELECTED::([a-z0-9-]+)/);
  if (sel) {
    convo.selectedSlug = sel[1];
    const selReply = reply.replace(/SELECTED::[a-z0-9-]+/, "").trim();

    // Load the restaurant menu and make a follow-up call so the bot
    // answers with the menu categories (and remembers what the user originally asked)
    const menu = await getMenu(convo.selectedSlug);
    if (menu) {
      const menuSystem = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
El cliente acaba de elegir este restaurante. Mostra las categorias del menu y si el cliente ya dijo que quiere algo especifico, busca en el menu y mostrale las opciones.

RESTAURANTE: ${convo.selectedSlug}
CATEGORIAS: ${menu.cats}

MENU (cada item tiene [ID]):
${menu.text}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown, NO emojis excesivos
- NO inventes items/precios
- NO numeres las categorias ni los items
- Si el cliente ya pidio algo especifico (ej "una coca", "un lomo"), busca en el menu y mostra las opciones que coincidan
- Si no pidio nada especifico, mostra las categorias disponibles
- Si mencionas un link al menu, usa este: https://www.menusanjuan.com/${convo.selectedSlug}
- NO uses el link generico menusanjuan.com, siempre el del restaurante

Cliente: ${name}`;

      // Include the full conversation so the bot knows what was discussed
      const contextMessages: BotMessage[] = [
        ...convo.messages,
        { role: "assistant", content: selReply },
        { role: "user", content: "Mostrame que tienen" },
      ];

      const menuRes = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: menuSystem,
        messages: contextMessages.slice(-10),
      });

      const menuReply = menuRes.content[0].type === "text" ? menuRes.content[0].text : selReply;
      const fullReply = selReply + "\n\n" + menuReply;

      convo.messages = [
        ...convo.messages.slice(-4),
        { role: "assistant", content: fullReply },
      ];
      await saveConvo(sessionId, convo);

      const totalInput = inputTokens + menuRes.usage.input_tokens;
      const totalOutput = outputTokens + menuRes.usage.output_tokens;
      const totalCost = (totalInput * 0.08 + totalOutput * 0.4) / 1000;

      return {
        reply: fullReply,
        debug: { selectedSlug: convo.selectedSlug, inputTokens: totalInput, outputTokens: totalOutput, costCents: totalCost, responseMs: Date.now() - start, systemPromptLength: system.length },
      };
    }

    // Fallback if menu not found
    convo.messages = [{ role: "assistant", content: selReply }];
    await saveConvo(sessionId, convo);
    return {
      reply: selReply,
      debug: { selectedSlug: convo.selectedSlug, inputTokens, outputTokens, costCents, responseMs, systemPromptLength: system.length },
    };
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
  await saveConvo(sessionId, convo);

  return {
    reply,
    debug: { selectedSlug: convo.selectedSlug || null, inputTokens, outputTokens, costCents, responseMs, systemPromptLength: system.length },
  };
}
