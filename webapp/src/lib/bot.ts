import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getMenu, applyPersonality, type Personality } from "@/lib/bot-shared";

const anthropic = new Anthropic();

// ── Conversation state (DB-backed for Vercel serverless) ──
export type BotMessage = { role: "user" | "assistant"; content: string };

export type { Personality } from "@/lib/bot-shared";

export type ConvoState = {
  messages: BotMessage[];
  selectedSlug?: string;
  personality: Personality;
};

export async function getConvo(sessionId: string): Promise<ConvoState> {
  const row = await prisma.$queryRawUnsafe<{ messages: string; selectedSlug: string | null; personality: string | null }[]>(
    `SELECT messages, "selectedSlug", "personality" FROM "BotConversation" WHERE id = $1`,
    sessionId
  );
  if (row.length > 0) {
    return {
      messages: JSON.parse(row[0].messages),
      selectedSlug: row[0].selectedSlug || undefined,
      personality: (row[0].personality as Personality) || "normal",
    };
  }
  return { messages: [], personality: "bardero" };
}

async function saveConvo(sessionId: string, convo: ConvoState) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "BotConversation" (id, messages, "selectedSlug", "personality", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET messages = $2, "selectedSlug" = $3, "personality" = $4, "updatedAt" = NOW()`,
    sessionId,
    JSON.stringify(convo.messages),
    convo.selectedSlug || null,
    convo.personality
  );
}

export async function setPersonality(sessionId: string, personality: Personality) {
  const convo = await getConvo(sessionId);
  convo.personality = personality;
  await saveConvo(sessionId, convo);
}

export async function resetConvo(sessionId: string) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "BotConversation" WHERE id = $1`,
    sessionId
  );
}

// ── Restaurant directory with top items ──
let dirCache: { text: string; ts: number } | null = null;

async function getDirectory(): Promise<string> {
  if (dirCache && Date.now() - dirCache.ts < 10 * 60 * 1000) return dirCache.text;

  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          items: {
            where: { available: true },
            orderBy: { sortOrder: "asc" },
            take: 8,
            select: { id: true, name: true, price: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  let text = "";
  for (const d of dealers) {
    const allItems = d.categories.flatMap((c) => c.items);
    if (allItems.length === 0) continue;
    text += `- ${d.name} (slug:${d.slug}) — ${d.cuisineType || "Varios"}${d.rating ? `, ${d.rating}★` : ""}\n`;
    // Include top items inline so bot can reference them across restaurants
    const topItems = allItems.slice(0, 5);
    for (const item of topItems) {
      text += `  · [${item.id}] ${item.name} ($${item.price.toLocaleString("es-AR")})\n`;
    }
  }

  dirCache = { text, ts: Date.now() };
  return text;
}

// ── Checkout link ──
function buildCheckoutLink(slug: string, items: { id: string; qty: number }[]): string {
  return `https://www.menusanjuan.com/${slug}?pedido=${btoa(JSON.stringify(items))}`;
}

// ── Rich UI blocks ──
export type RestaurantCard = {
  type: "restaurant";
  slug: string;
  name: string;
  cuisineType: string | null;
  rating: number | null;
  coverUrl: string | null;
  logoUrl: string | null;
  itemCount: number;
};

export type CategoryButton = {
  type: "category";
  name: string;
  itemCount: number;
};

export type ItemCard = {
  type: "item";
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  category: string;
};

export type CrossItemCard = {
  type: "cross_item";
  id: string;
  slug: string;
  restaurantName: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
};

export type CheckoutBlock = {
  type: "checkout";
  url: string;
  slug: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
};

export type BotBlock =
  | { type: "restaurants"; items: RestaurantCard[] }
  | { type: "categories"; items: CategoryButton[]; slug: string; restaurantName: string }
  | { type: "menu_items"; items: ItemCard[]; category: string }
  | { type: "cross_items"; items: CrossItemCard[] }
  | CheckoutBlock;

// ── Fetch restaurant cards data ──
async function getRestaurantCards(slugs: string[]): Promise<RestaurantCard[]> {
  if (slugs.length === 0) return [];
  const dealers = await prisma.dealer.findMany({
    where: { slug: { in: slugs }, isActive: true },
    include: {
      categories: {
        include: { items: { where: { available: true }, select: { id: true } } },
      },
    },
  });
  return dealers.map((d) => ({
    type: "restaurant" as const,
    slug: d.slug,
    name: d.name,
    cuisineType: d.cuisineType,
    rating: d.rating ? Number(d.rating) : null,
    coverUrl: d.coverUrl,
    logoUrl: d.logoUrl,
    itemCount: d.categories.reduce((s, c) => s + c.items.length, 0),
  }));
}

// ── Fetch category buttons for a restaurant ──
async function getCategoryButtons(slug: string): Promise<{ buttons: CategoryButton[]; restaurantName: string } | null> {
  const dealer = await prisma.dealer.findFirst({
    where: { slug, isActive: true },
    include: {
      categories: {
        include: { items: { where: { available: true }, select: { id: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!dealer) return null;
  return {
    restaurantName: dealer.name,
    buttons: dealer.categories
      .filter((c) => c.items.length > 0)
      .map((c) => ({ type: "category" as const, name: c.name, itemCount: c.items.length })),
  };
}

// ── Fetch item cards for a category in a restaurant ──
async function getItemCards(slug: string, categoryName: string): Promise<ItemCard[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      available: true,
      category: {
        name: { contains: categoryName, mode: "insensitive" },
        dealer: { slug },
      },
    },
    include: { category: { select: { name: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return items.map((i) => ({
    type: "item" as const,
    id: i.id,
    name: i.name,
    price: i.price,
    description: i.description,
    imageUrl: i.imageUrl,
    category: i.category.name,
  }));
}

// ── Extract slugs mentioned in bot reply ──
function extractMentionedSlugs(reply: string, directory: string): string[] {
  const slugs: string[] = [];
  const lines = directory.split("\n");
  for (const line of lines) {
    const match = line.match(/\(([a-z0-9-]+)\)/);
    if (match) {
      const slug = match[1];
      // Check if restaurant name appears in the reply
      const nameMatch = line.match(/^- (.+?) \(/);
      if (nameMatch && reply.toLowerCase().includes(nameMatch[1].toLowerCase())) {
        slugs.push(slug);
      }
    }
  }
  return slugs.slice(0, 5); // max 5 cards
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
): Promise<{ reply: string; blocks: BotBlock[]; debug: BotDebug }> {
  let convo = await getConvo(sessionId);

  const lower = text.toLowerCase();

  // Personality toggle
  if (lower === "modo bardero" || lower === "bardero") {
    convo.personality = "bardero";
    await saveConvo(sessionId, convo);
    return {
      reply: "Jajaja dale culiao, activaste el *modo bardero*. Ahora te voy a atender como se debe, sin filtro. ¿Qué carajo querés morfar?",
      blocks: [], debug: { selectedSlug: convo.selectedSlug || null, inputTokens: 0, outputTokens: 0, costCents: 0, responseMs: 0, systemPromptLength: 0 },
    };
  }
  if (lower === "modo normal" || lower === "normal") {
    convo.personality = "normal";
    await saveConvo(sessionId, convo);
    return {
      reply: "Listo, volví al modo tranquilo. ¿En qué te puedo ayudar?",
      blocks: [], debug: { selectedSlug: convo.selectedSlug || null, inputTokens: 0, outputTokens: 0, costCents: 0, responseMs: 0, systemPromptLength: 0 },
    };
  }

  // Reset (preserve personality)
  if (["reiniciar", "nuevo pedido", "volver", "reset", "hola", "empezar"].includes(lower)) {
    convo = { messages: [], personality: convo.personality };
    await saveConvo(sessionId, convo);
  }

  let system: string;

  if (convo.selectedSlug) {
    const menu = await getMenu(convo.selectedSlug);
    if (!menu) {
      convo.selectedSlug = undefined;
      return {
        reply: "No encontre ese restaurante. Escribi *hola* para empezar de nuevo.",
        blocks: [], debug: { selectedSlug: null, inputTokens: 0, outputTokens: 0, costCents: 0, responseMs: 0, systemPromptLength: 0 },
      };
    }

    system = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
Estas ayudando al cliente a pedir de ${convo.selectedSlug}. Pero sos el bot de MenuSanJuan (TODA la plataforma), no de un solo restaurante.

RESTAURANTE ACTUAL: ${convo.selectedSlug}
CATEGORIAS: ${menu.cats}

MENU (cada item tiene [ID]):
${menu.text}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown, NO emojis excesivos
- NO inventes items/precios
- NO numeres las categorias ni los items
- Si el cliente dice que quiere algo, busca en el menu y mostra las opciones
- Sugeri combos ("queres agregar bebida?")
- Link al menu completo: https://www.menusanjuan.com/${convo.selectedSlug}

CAMBIAR DE RESTAURANTE:
- Si el cliente pide algo que NO hay en este menu, ofrecele buscar otro restaurante
- Si el cliente dice "quiero pedir de otro lado", "otro restaurante", "dame un link a X", emiti SWITCH:: al final
- Si pide un link a un restaurante especifico, dale el link directo: https://www.menusanjuan.com/SLUG y emiti SWITCH::
- NUNCA digas "yo solo trabajo con este restaurante" — vos sos MenuSanJuan, trabajas con TODOS
- Despues de confirmar un pedido, ofrece: "¿Queres pedir de otro restaurante tambien?"

PERSONALIZACION:
- Items con OPCIONES obligatorias: pregunta antes de agregar
- Items con opciones opcionales: sugeri "¿queres agregar algo extra?"
- Mismo item con diferentes opciones = entradas separadas
- Notas por item: "sin cebolla", "bien cocido" — incluir en resumen

CONFIRMAR PEDIDO:
Mostra resumen con items, opciones, notas, cantidades y total.
Al final agrega esta linea EXACTA:
CHECKOUT_LINK::${convo.selectedSlug}::[{"id":"ID","qty":N,"options":"sabor1, sabor2","notes":"sin cebolla"}]

Despues del CHECKOUT_LINK, pregunta: "¿Queres pedir de otro restaurante tambien?"
Si dice que si, emiti SWITCH:: para volver al menu principal.

- "humano" → "Te comunico con alguien. Un momento."

Cliente: ${name}`;
  } else {
    const dir = await getDirectory();

    system = `Sos el asistente de MenuSanJuan, delivery de San Juan, Argentina.
Ayudas a descubrir restaurantes y productos de toda la ciudad.

RESTAURANTES Y ALGUNOS ITEMS (cada item tiene [ID] y cada resta slug):
${dir}

REGLAS:
- Espanol argentino informal, conciso, WhatsApp
- Texto plano + *negrita*. NO markdown, NO emojis excesivos
- Sos un asistente que muestra OPCIONES VISUALES con tarjetas — no listes con texto largo

MOSTRAR ITEMS DE DIFERENTES RESTAURANTES (cross-restaurant):
Cuando el cliente busca un tipo de comida (ej: "pizza", "cafe", "algo dulce"), mostrale items concretos de VARIOS restaurantes como tarjetas. Usa este formato al FINAL de tu mensaje:

CROSS_ITEMS::slug1:id1,slug2:id2,slug3:id3

Ejemplo: cliente dice "quiero pizza":
Respondes con un comentario breve y al final:
CROSS_ITEMS::il-pilonte:item-x,abuelo-yuyi:item-y,indalecio-pizzas:item-z

Podes mostrar entre 3 y 6 items de 2-4 restaurantes distintos. Cuando el cliente toque una tarjeta, se abre el restaurante en otra pestana con el item listo para agregar.

SELECCIONAR UN RESTAURANTE ENTERO:
Solo usa SELECTED::slug si el cliente:
- Quiere explorar TODO el menu de un restaurante especifico
- Dice "quiero pedir solo de X"
Ejemplo: SELECTED::hc-cafe

PRIORIDAD:
1. Si el cliente busca un TIPO de comida → usa CROSS_ITEMS (tarjetas visuales)
2. Si el cliente quiere ENTRAR a un restaurante especifico → usa SELECTED
3. Si no tenes info suficiente, pregunta primero

- "humano" → "Te comunico con alguien. Un momento."
- Ver todos: https://www.menusanjuan.com

Cliente: ${name}`;
  }

  convo.messages.push({ role: "user", content: text });
  const recent = convo.messages.slice(-16);

  // Apply personality overlay
  const finalSystem = applyPersonality(system, convo.personality);

  const start = Date.now();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: finalSystem,
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

      // Get category buttons for the selected restaurant
      const catData = await getCategoryButtons(convo.selectedSlug);
      const blocks: BotBlock[] = [];
      if (catData) {
        blocks.push({ type: "categories", items: catData.buttons, slug: convo.selectedSlug, restaurantName: catData.restaurantName });
      }

      return {
        reply: fullReply,
        blocks,
        debug: { selectedSlug: convo.selectedSlug, inputTokens: totalInput, outputTokens: totalOutput, costCents: totalCost, responseMs: Date.now() - start, systemPromptLength: system.length },
      };
    }

    // Fallback if menu not found
    convo.messages = [{ role: "assistant", content: selReply }];
    await saveConvo(sessionId, convo);
    return {
      reply: selReply,
      blocks: [],
      debug: { selectedSlug: convo.selectedSlug, inputTokens, outputTokens, costCents, responseMs, systemPromptLength: system.length },
    };
  }

  // Handle SWITCH:: — user wants to switch restaurants
  if (reply.includes("SWITCH::")) {
    convo.selectedSlug = undefined;
    reply = reply.replace(/SWITCH::/g, "").trim();
    convo.messages.push({ role: "assistant", content: reply });
    await saveConvo(sessionId, convo);
    return {
      reply,
      blocks: [],
      debug: { selectedSlug: null, inputTokens, outputTokens, costCents, responseMs, systemPromptLength: system.length },
    };
  }

  // Handle CHECKOUT_LINK:: — non-greedy JSON array match so trailing text doesn't break parse
  const blocks: BotBlock[] = [];
  const link = reply.match(/CHECKOUT_LINK::([a-z0-9-]+)::(\[[^\]]*\])/);
  if (link) {
    try {
      const cart = JSON.parse(link[2]) as { id: string; qty: number }[];
      const url = buildCheckoutLink(link[1], cart);
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[[^\]]*\]/, "");

      // Build checkout block with item details
      const menu = await getMenu(link[1]);
      const checkoutItems = cart.map((c) => {
        const menuText = menu?.text || "";
        const itemMatch = menuText.match(new RegExp(`\\[${c.id}\\] (.+?) \\(\\$([\\d.,]+)\\)`));
        return { name: itemMatch?.[1] || c.id, qty: c.qty, price: itemMatch ? parseFloat(itemMatch[2].replace(/\./g, "").replace(",", ".")) : 0 };
      });
      const total = checkoutItems.reduce((s, i) => s + i.price * i.qty, 0);

      blocks.push({ type: "checkout", url, slug: link[1], items: checkoutItems, total });

      // After checkout, reset to discovery mode for next order
      convo.selectedSlug = undefined;
    } catch {
      reply = reply.replace(/CHECKOUT_LINK::[a-z0-9-]+::\[[^\]]*\]/, "");
    }
  }

  // Parse CROSS_ITEMS:: — cross-restaurant item cards (only allow slug:id chars, strip trailing punctuation)
  const crossMatch = reply.match(/CROSS_ITEMS::([a-z0-9\-:,\s]+)/);
  if (crossMatch) {
    const pairs = crossMatch[1]
      .split(",")
      .map((p) => p.trim().replace(/[.,;:!?\s]+$/, ""))
      .filter((p) => p.includes(":"))
      .map((p) => {
        const [slug, id] = p.split(":");
        return { slug: slug.trim(), id: id.trim() };
      })
      .filter((p) => p.slug && p.id);

    if (pairs.length > 0) {
      const itemIds = pairs.map((p) => p.id);
      const items = await prisma.menuItem.findMany({
        where: { id: { in: itemIds }, available: true },
        include: { category: { include: { dealer: { select: { slug: true, name: true } } } } },
      });

      const crossCards: CrossItemCard[] = [];
      for (const pair of pairs) {
        const item = items.find((i) => i.id === pair.id);
        if (item && item.category.dealer.slug === pair.slug) {
          crossCards.push({
            type: "cross_item",
            id: item.id,
            slug: item.category.dealer.slug,
            restaurantName: item.category.dealer.name,
            name: item.name,
            price: item.price,
            description: item.description,
            imageUrl: item.imageUrl,
          });
        }
      }

      if (crossCards.length > 0) {
        blocks.push({ type: "cross_items", items: crossCards });
      }
    }
    reply = reply.replace(/CROSS_ITEMS::[a-z0-9\-:,\s]+/g, "").trim();
  }

  // If we're in discovery mode and the bot mentioned restaurants (not cross items), attach restaurant cards
  if (!convo.selectedSlug && !link && !crossMatch) {
    const dir = dirCache?.text || "";
    const mentionedSlugs = extractMentionedSlugs(reply, dir);
    if (mentionedSlugs.length > 0) {
      const cards = await getRestaurantCards(mentionedSlugs);
      if (cards.length > 0) {
        blocks.push({ type: "restaurants", items: cards });
      }
    }
  }

  convo.messages.push({ role: "assistant", content: reply });
  if (convo.messages.length > 16) convo.messages = convo.messages.slice(-16);
  await saveConvo(sessionId, convo);

  return {
    reply,
    blocks,
    debug: { selectedSlug: convo.selectedSlug || null, inputTokens, outputTokens, costCents, responseMs, systemPromptLength: system.length },
  };
}
