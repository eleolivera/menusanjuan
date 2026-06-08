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
    id: "2026-06-08-modo-confiar",
    date: "8 de junio, 2026",
    emoji: "⚡",
    title: "Modo confiar — pedidos pagados sin validar",
    body: [
      "Sumamos una opción para cuando no llegás a validar comprobantes.",
      "",
      "Si la prendés:",
      "• Cada pedido nuevo se marca como pagado al instante, sin importar el método (efectivo, transferencia, MP).",
      "• Los comprobantes que suban los clientes se auto-aprueban — no tenés que validarlos.",
      "• Los pedidos que estaban pendientes de validar se marcan como pagados de una al activarla.",
      "",
      "Mientras esté prendida vas a ver un cartel amarillo arriba del Kanban recordándotelo. En cada pedido pagado por este modo aparece un \"asumido (modo confiar)\" chiquito, para que después puedas distinguir cuáles validaste de verdad.",
      "",
      "⚠️ Importante: perdés trazabilidad de qué cliente pagó realmente. Solo activala si no llegás a validar y preferís esa libertad al control. La podés apagar cuando quieras.",
    ].join("\n"),
    cta: {
      href: "/restaurante/profile#modo-confiar",
      label: "Ir a la configuración",
    },
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
