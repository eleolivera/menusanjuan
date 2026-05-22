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
};

export const OWNER_UPDATES: OwnerUpdate[] = [
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
