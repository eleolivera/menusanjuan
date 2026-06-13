/**
 * Owner-facing "Novedades" changelog. Each entry pops up in the owner portal
 * the first time the owner logs in after it was added. They acknowledge by
 * clicking "Entendido" — we store the entry's `id` in Dealer.lastSeenUpdate so
 * the same entry never shows again.
 *
 * Conventions:
 *   - id  → unique, date-prefixed kebab-case, stable forever
 *   - date → human-friendly Spanish date (only used for display)
 *   - Newest entries go FIRST. The modal shows the newest unseen entry — when
 *     there are multiple, the owner steps through them one by one.
 *   - Keep `body` casual and non-technical. Use markdown-ish bullets manually
 *     since we render plain text with line breaks.
 */

export type OwnerUpdate = {
  id: string;
  date: string;
  title: string;
  emoji: string;
  body: string; // Multi-line Spanish text. Plain text — line breaks become <br/>.
  /** Optional CTA — if present, the modal shows a primary button that opens this URL.
   * Used to deep-link the owner to the relevant config screen for a new feature. */
  cta?: { href: string; label: string };
};

export const OWNER_UPDATES: OwnerUpdate[] = [
  {
    id: "2026-06-12-combos-personalizables",
    date: "12 de junio, 2026",
    emoji: "🍔",
    title: "Combos y promos personalizables por item",
    body: [
      "Si tenés una promo tipo \"2 Pachatas + Papas\", ahora cada pachata se puede personalizar por separado.",
      "",
      "Cómo armarla:",
      "1. Editá el item del combo en tu menú",
      "2. Bajá a la sección \"Combo / Promo\"",
      "3. Tocá \"+ Agregar componente\" y elegí los items que lo arman (ej: 2 veces \"Pachata\", 1 vez \"Papas\")",
      "4. Opcional: ponele una etiqueta a cada slot (\"Pachata 1\", \"Pachata 2\") para diferenciarlas",
      "5. Guardás y listo",
      "",
      "Lo que ve el cliente:",
      "• Al tocar el combo, le aparece un sheet con un bloque por cada componente",
      "• Cada bloque trae las MISMAS opciones que tiene ese item solo (ej: las extras de la Pachata standalone se aplican acá también)",
      "• Si ponés precio extra a alguna opción, se le suma al combo automáticamente",
      "",
      "También polish general en el flujo de personalización:",
      "• El botón de \"Agregar\" siempre se ve abajo, no se pierde haciendo scroll",
      "• Los grupos obligatorios tienen badge naranja + borde, los completados se ponen verdes con \"✓ Listo\"",
      "• Si tocás \"Agregar\" sin completar lo obligatorio, te lleva directo al grupo que falta",
      "• El precio total se actualiza vivo en el botón mientras el cliente personaliza",
    ].join("\n"),
  },
  {
    id: "2026-06-11-entregado-auto-paid",
    date: "11 de junio, 2026",
    emoji: "✅",
    title: "Menos clicks al cerrar pedidos",
    body: [
      "Cambiamos cómo se marcan los pedidos como pagados al cerrarlos:",
      "",
      "🏪 RETIROS EN LOCAL",
      "Cuando lo movés a \"Entregado\", se marca como pagado automáticamente. El cliente vino al local, te pagó, no hay que tocar \"Cobrar\" después. Un solo click.",
      "",
      "🛵 DELIVERY",
      "Cuando movés un pedido de delivery a \"Entregado\", te aparece una preguntita rápida:",
      "👉 \"¿Ya estaba pagado este pedido?\"",
      "• Tocás Aceptar si el repartidor lo cobró (o si pagaron por transfer/MP) → se marca pagado.",
      "• Tocás Cancelar si todavía falta cobrar → queda como estaba.",
      "",
      "Los pedidos cerrados así te aparecen con un \"asumido\" chiquito al lado de \"Pagado\" para que después puedas distinguirlos de los que validaste con comprobante.",
      "",
      "Si todavía querés validar comprobantes a la antigua antes de cerrar, podés hacerlo — esto no obliga nada, solo te ahorra un click cuando estás corriendo.",
    ].join("\n"),
  },
  {
    id: "2026-05-24-explicit-save-zones-horarios",
    date: "24 de mayo, 2026",
    emoji: "💾",
    title: "Zonas y horarios ahora se guardan con un botón",
    body: [
      "Cambiamos cómo se guardan las zonas de delivery y los horarios. Antes se guardaban solos a medida que tipeabas, y eso causaba algún bug raro (por ejemplo, te quedaba un \"$600\" en una zona cuando vos quisiste poner \"$6.000\"). Ahora es así:",
      "",
      "📍 Zonas de delivery + Horarios de delivery + Horarios de retiro",
      "",
      "• Por default vas a ver un resumen rápido (cantidad de zonas, rango de precios, días abiertos).",
      "• Para cambiar algo: tocás \"✏️ Editar zonas\" o \"✏️ Editar horarios\".",
      "• Modificás lo que quieras — nada se guarda hasta que toques el botón verde \"Guardar\".",
      "• Si te arrepentís: tocá \"Cancelar\" y vuelve a como estaba.",
      "• Si tratás de cerrar la pestaña con cambios sin guardar, el navegador te avisa.",
      "",
      "El resto de los campos (nombre, alias MP, teléfono, etc.) siguen guardándose solos al salir del campo como antes — eso ya funcionaba bien.",
      "",
      "Lo encontrás todo en Mi Restaurante.",
    ].join("\n"),
  },
  {
    id: "2026-05-22-delivery-pricing-toggle",
    date: "22 de mayo, 2026",
    emoji: "🛵",
    title: "Costo de delivery — ahora es opcional configurarlo",
    body: [
      "Mejoramos el panel de perfil para que sea más claro cómo cobrás el envío.",
      "",
      "• Hay un nuevo toggle: 'Cobrar envío automáticamente'.",
      "• Si lo dejás APAGADO (default), el cliente ve 'Costo de envío a confirmar' al armar el pedido, y vos le pasás el precio por WhatsApp.",
      "• Si lo prendés, aparecen las opciones de 'Por zonas' o 'Precio fijo' como antes.",
      "",
      "Las restas que ya tenían zonas o precio configurado mantienen el toggle prendido — no cambia nada para vos. Las nuevas arrancan apagado para que no tengan que tocar nada hasta que quieran.",
      "",
      "Lo encontrás en Mi Restaurante → Costo de Delivery.",
    ].join("\n"),
  },
  {
    id: "2026-05-22-notas-ticket-fix",
    date: "22 de mayo, 2026",
    emoji: "🛠️",
    title: "Arreglado: las notas de los items vuelven a imprimirse",
    body: [
      "Bug que detectamos hoy: cuando agregabas un item por POS con una nota (ej. 'sin cebolla'), la nota se perdía y no salía impresa en la comanda.",
      "",
      "Ya está corregido:",
      "• Las notas por item ahora se guardan correctamente desde POS.",
      "• Aparecen tanto en el carrito del POS como en la comanda impresa.",
      "• La versión del ticket subió a v2026-05-22.a — vas a verla al pie de la próxima impresión.",
      "",
      "Si imprimís una comanda nueva con notas y no aparecen, refrescá el navegador (Ctrl+F5).",
    ].join("\n"),
  },
  {
    id: "2026-05-22-comprobantes-cerrar-ahora",
    date: "22 de mayo, 2026",
    emoji: "✨",
    title: "Comprobantes adentro del pedido + botón 'Cerrar ahora'",
    body: [
      "¡Hola! Dos cosas nuevas que ya están funcionando:",
      "",
      "📎 COMPROBANTES DE TRANSFERENCIA / MERCADO PAGO",
      "Antes el cliente te mandaba el comprobante por WhatsApp y vos lo buscabas a mano. Ahora se hace todo desde el pedido.",
      "",
      "• Cuando el cliente arma el pedido, le aparece '¿Cómo vas a pagar?' (Efectivo / Transferencia / Mercado Pago).",
      "• Si elige transfer o MP, le mostramos tu alias con botón para copiar, y puede subir el comprobante ahí mismo o más tarde desde un link que le mandamos por WhatsApp.",
      "• En tu Kanban vas a ver una pill ámbar que dice 'Comprobante recibido — Ver y validar'.",
      "• Tocás 'Ver y validar' → se abre el comprobante grande con el total al lado para comparar → ✓ Validar pago (queda pagado) o ✗ Rechazar (le borra el comprobante y le avisa al cliente que suba otro).",
      "",
      "🛑 BOTÓN 'CERRAR AHORA'",
      "Arriba a la derecha en la página de Pedidos, al lado del selector de fecha. Sirve para cuando te quedaste sin comida o querés cortar antes.",
      "",
      "• Lo tocás, confirmás, y queda cerrado el resto de la jornada — incluso si tu horario pasa la medianoche (cerrás a las 11pm y a las 12:10am no se reabre solo).",
      "• Al día siguiente abre automáticamente según tu horario normal.",
      "• Si te arrepentís, aparece un botón 🔒 'Reabrir' en el mismo lugar.",
      "",
      "Cualquier cosa rara, escribime.",
    ].join("\n"),
  },
];

/**
 * Returns the list of updates the owner hasn't acknowledged yet. Newest-first
 * order is preserved (entries are filtered, not re-sorted).
 */
export function getUnseenUpdates(lastSeenUpdate: string | null): OwnerUpdate[] {
  if (!lastSeenUpdate) return OWNER_UPDATES;
  const idx = OWNER_UPDATES.findIndex((u) => u.id === lastSeenUpdate);
  if (idx === -1) return OWNER_UPDATES; // unknown id — show everything as a safe fallback
  return OWNER_UPDATES.slice(0, idx); // entries newer than the last-seen one
}
