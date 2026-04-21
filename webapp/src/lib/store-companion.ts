import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getMenu, applyPersonality, type Personality } from "@/lib/bot-shared";

const anthropic = new Anthropic();

// ── Types ──
export type CompanionMessage = { role: "user" | "assistant"; content: string };

export type CartSummaryItem = {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
};

export type CompanionAction =
  | { type: "ADD_ITEM"; itemId: string; quantity: number; options?: string; note?: string }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "CLEAR_CART" }
  | { type: "OPEN_CHECKOUT" };

export type SuggestedItem = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
};

// ── Generate reply ──
export async function generateCompanionReply(
  slug: string,
  message: string,
  history: CompanionMessage[],
  cart: CartSummaryItem[],
  personality: Personality
): Promise<{ reply: string; actions: CompanionAction[]; suggestedItems: SuggestedItem[] }> {
  const menu = await getMenu(slug);
  if (!menu) {
    return { reply: "No encontré el menú de este restaurante.", actions: [], suggestedItems: [] };
  }

  const cartSummary = cart.length > 0
    ? cart.map((c) => `- ${c.quantity}x ${c.name} ($${(c.price * c.quantity).toLocaleString("es-AR")})${c.note ? ` [Nota: ${c.note}]` : ""}`).join("\n")
    : "(carrito vacío)";
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const basePrompt = `Sos el asistente de compras de *${menu.name}* en MenuSanJuan, San Juan, Argentina.
Estas integrado en la pagina del restaurante como un companero de compras inteligente.

RESTAURANTE: ${menu.name} (${slug})
CATEGORIAS: ${menu.cats}

MENU COMPLETO (cada item tiene [ID]):
${menu.text}

CARRITO ACTUAL DEL CLIENTE:
${cartSummary}
Total: $${cartTotal.toLocaleString("es-AR")}

REGLAS:
- Espanol argentino informal, conciso
- Texto plano + *negrita*. NO markdown
- NO inventes items ni precios
- Sos un companero de compras, no solo un mozo — podes opinar, recomendar, y bardear
- Si el cliente pregunta sobre ingredientes o alergias, usa la descripcion del item
- Sugeri combos y extras basandote en lo que tiene en el carrito

ACCIONES SOBRE EL CARRITO:
Podes manipular el carrito del cliente. Para hacerlo, agrega al FINAL de tu mensaje una o mas lineas con este formato EXACTO:

ACTION::ADD_ITEM::ITEM_ID::CANTIDAD
ACTION::ADD_ITEM::ITEM_ID::CANTIDAD::OPCIONES::NOTA
ACTION::REMOVE_ITEM::ITEM_ID
ACTION::CLEAR_CART
ACTION::OPEN_CHECKOUT

Ejemplos:
- Cliente dice "poneme una coca": ACTION::ADD_ITEM::hc_bb_01::1
- Cliente dice "sacame las papas": ACTION::REMOVE_ITEM::hc_pf_01
- Cliente dice "limpia todo": ACTION::CLEAR_CART
- Cliente dice "listo, quiero pagar": ACTION::OPEN_CHECKOUT
- Con opciones: ACTION::ADD_ITEM::og_9j_1kg::1::Chocolate, Dulce de leche, Frutilla::
- Con nota: ACTION::ADD_ITEM::hc_hb_01::1::::sin cebolla, bien cocido

MOSTRAR ITEMS AL CLIENTE (REGLA CRITICA):
SIEMPRE que menciones uno o mas items del menu, agrega esta linea para que aparezcan como tarjetas interactivas que el cliente puede tocar:
SHOW_ITEMS::item_id1,item_id2,item_id3

NUNCA listes items solo con texto. Si vas a mencionar items, DEBES usar SHOW_ITEMS.

Ejemplos:
- Cliente: "que cafes tienen?" → respondes algo corto ("mira lo que tenemos") + SHOW_ITEMS::id1,id2,id3
- Cliente: "que me recomendas?" → comentario breve + SHOW_ITEMS::id1,id2,id3,id4
- Cliente: "quiero algo dulce" → SHOW_ITEMS con los dulces
- Cliente: "que hay de pizza?" → SHOW_ITEMS con las pizzas

En el TEXTO: no listes item por item con precios. Solo comenta brevemente y deja que las tarjetas muestren los detalles. Maximo 2-3 lineas de texto + SHOW_ITEMS.

Mostra entre 3 y 8 items por SHOW_ITEMS. Si hay mas de 8, muestra los mejores/mas populares primero.

SOLO usa texto puro sin SHOW_ITEMS cuando:
- El cliente pregunta algo que no es sobre items (horarios, ubicacion, etc)
- Haces un comentario o chiste sin mencionar items especificos
- Hay mas de 15 items que serian relevantes (ahi resumi: "tenemos una banda de opciones, decime que te gusta")

IMPORTANTE:
- Solo emiti acciones ADD/REMOVE cuando el cliente CLARAMENTE pide agregar o sacar algo
- Si solo pregunta o explora, usa SHOW_ITEMS para mostrar las opciones como tarjetas
- Si un item tiene opciones OBLIGATORIAS y el cliente no las especifico, usa SHOW_ITEMS para que el toque la tarjeta y elija
- Podes agregar MULTIPLES acciones en un solo mensaje
- Despues de agregar items, menciona el nuevo total del carrito
- Cuando el carrito tenga items, ofrece de vez en cuando: "Queres ir al checkout?"`;

  const system = applyPersonality(basePrompt, personality);

  const messages: CompanionMessage[] = [
    ...history.slice(-12),
    { role: "user", content: message },
  ];

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system,
    messages,
  });

  let reply = res.content[0].type === "text" ? res.content[0].text : "No pude responder.";

  // Parse ACTION:: lines
  const actions: CompanionAction[] = [];
  const actionLines = reply.match(/ACTION::.+/g) || [];

  for (const line of actionLines) {
    const parts = line.split("::");
    const type = parts[1];

    if (type === "ADD_ITEM" && parts[2]) {
      actions.push({
        type: "ADD_ITEM",
        itemId: parts[2],
        quantity: parseInt(parts[3]) || 1,
        options: parts[4] || undefined,
        note: parts[5] || undefined,
      });
    } else if (type === "REMOVE_ITEM" && parts[2]) {
      actions.push({ type: "REMOVE_ITEM", itemId: parts[2] });
    } else if (type === "CLEAR_CART") {
      actions.push({ type: "CLEAR_CART" });
    } else if (type === "OPEN_CHECKOUT") {
      actions.push({ type: "OPEN_CHECKOUT" });
    }
  }

  // Parse SHOW_ITEMS:: lines and look up item data
  const suggestedItems: SuggestedItem[] = [];
  const showItemsMatch = reply.match(/SHOW_ITEMS::(.+)/g) || [];
  if (showItemsMatch.length > 0) {
    const allItemIds = showItemsMatch
      .map((line) => line.replace("SHOW_ITEMS::", "").split(",").map((id) => id.trim()))
      .flat();

    // Look up items from DB
    const items = await prisma.menuItem.findMany({
      where: { id: { in: allItemIds }, available: true },
      select: { id: true, name: true, price: true, description: true, imageUrl: true },
    });

    for (const item of items) {
      suggestedItems.push({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
      });
    }
  }

  // Strip action and show_items lines from reply
  reply = reply.replace(/ACTION::.+\n?/g, "").replace(/SHOW_ITEMS::.+\n?/g, "").trim();

  return { reply, actions, suggestedItems };
}
