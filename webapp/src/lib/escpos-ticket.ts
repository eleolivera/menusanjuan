import EscPosEncoder from "esc-pos-encoder";
import { lineTotal as moneyLineTotal } from "./money";
import { formatItemQuantity } from "./order-item-display";

/**
 * Server-side generator for ESC/POS print payloads. The desktop agent receives
 * these raw bytes and writes them straight to the thermal printer — no HTML,
 * no driver text rendering, no chance of the QR being dropped.
 *
 * Bumped any time the on-paper format changes so we can debug "is the resta
 * on the new code?" — printed in the footer.
 */
const TICKET_BUILD = "v2026-08-29.esc-1";

type OrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  optionsDelta?: number;
  note?: string;
  // Variable-pricing pass-throughs so mode-aware totals compute correctly.
  pricingMode?: "FIXED" | "PACKAGED" | "BY_WEIGHT";
  tierPrice?: number;
  weight?: number;
  quantityTiers?: unknown;
};

export type EscOrder = {
  orderNumber: string;
  restaurantName: string;
  restaurantPhone: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  total: number;          // items only (subtotal)
  deliveryFee: number;
  deliveryMethod: string; // "delivery" | "pickup" | ...
  notes: string;
  paymentStatus: "PAID" | "UNPAID";
  paymentMethod: string | null;
  createdAt: string;      // ISO
};

function ars(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function newEncoder() {
  // 'cp437' is the default for most 58mm thermal printers and supports the
  // basic ASCII set we need. Non-ASCII chars are stripped (e.g. tildes —
  // we transliterate manually below).
  return new EscPosEncoder({
    width: 32,                  // 58mm at standard font A = 32 chars/line
    wordWrap: true,
    codepageMapping: "epson",
  });
}

function noTildes(s: string): string {
  // Thermal printer fonts in CP437 don't render tildes/accents. Strip them
  // rather than print "?" boxes. Keep ñ → n.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, " ");
}

/**
 * Build the ESC/POS payload for a customer order ticket.
 * Layout:
 *   [HEADER] restaurant name (big, bold, center)
 *   restaurant phone (center)
 *   --- divider ---
 *   date · order# · method (center)
 *   --- divider ---
 *   CLIENTE: name / phone / address
 *   [NOTES if any]
 *   --- divider ---
 *   ITEMS (table: qty + name + price)
 *   --- divider ---
 *   Subtotal + Envío + TOTAL (right-aligned)
 *   --- divider ---
 *   COBRAR $X (boxed) or PAGADO (boxed)
 *   QR (native ESC/POS) + caption
 *   --- divider ---
 *   menusanjuan.com + build stamp
 *   CUT
 */
export function buildOrderTicket(order: EscOrder, driverUrl: string | null): Uint8Array<ArrayBuffer> {
  const enc = newEncoder().initialize();
  const date = new Date(order.createdAt).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const methodLabel =
    order.deliveryMethod === "pickup" ? "RETIRO EN LOCAL" :
    order.deliveryMethod === "delivery" ? "DELIVERY" :
    String(order.deliveryMethod).toUpperCase();

  // Header
  enc.align("center").size(1, 1).bold(true).line(noTildes(order.restaurantName)).bold(false).size(0, 0);
  if (order.restaurantPhone) enc.line(noTildes(order.restaurantPhone));
  enc.line("--------------------------------");
  enc.line(date);
  enc.bold(true).line(`#${order.orderNumber}`).bold(false);
  enc.line(methodLabel);
  enc.line("--------------------------------");

  // Customer
  enc.align("left");
  enc.bold(true).line("CLIENTE:").bold(false);
  enc.line(noTildes(order.customerName));
  if (order.customerPhone) enc.line(order.customerPhone);
  if (order.customerAddress) enc.line(noTildes(order.customerAddress));

  if (order.notes) {
    enc.line("--------------------------------");
    enc.bold(true).line("NOTAS:").bold(false);
    enc.line(noTildes(order.notes));
  }

  enc.line("--------------------------------");

  // Items — use the encoder's table layout so qty+name on the left, price on the right
  for (const it of order.items) {
    const left = `${formatItemQuantity(it)} ${noTildes(it.name)}`;
    const total = moneyLineTotal(it);
    enc.table(
      [
        { width: 22, align: "left" },
        { width: 10, align: "right" },
      ],
      [[left, ars(total)]]
    );
    if (it.note) {
      enc.line(`   - ${noTildes(it.note)}`);
    }
  }

  enc.line("--------------------------------");

  // Totals
  enc.table(
    [{ width: 22, align: "left" }, { width: 10, align: "right" }],
    [["Subtotal", ars(order.total)]]
  );
  if (order.deliveryFee > 0) {
    enc.table(
      [{ width: 22, align: "left" }, { width: 10, align: "right" }],
      [["Envio", ars(order.deliveryFee)]]
    );
  }
  const grandTotal = order.total + order.deliveryFee;
  enc.bold(true).table(
    [{ width: 22, align: "left" }, { width: 10, align: "right" }],
    [["TOTAL", ars(grandTotal)]]
  ).bold(false);

  enc.line("--------------------------------");

  // Payment stamp — bold + simple box made of dashes
  enc.align("center").bold(true);
  if (order.paymentStatus === "PAID") {
    enc.line(`*** PAGADO ${order.paymentMethod ? `(${order.paymentMethod})` : ""} ***`);
  } else {
    enc.line(`>> COBRAR ${ars(grandTotal)} <<`);
  }
  enc.bold(false);

  // Native ESC/POS QR — printer firmware draws this, NOT image rasterization
  if (driverUrl) {
    enc.newline();
    enc.align("center").qrcode(driverUrl, { model: 2, size: 6, errorlevel: "h" });
    enc.line("Escanear: estado y entrega");
    enc.size(0, 0);
    // Backup URL as text — if the QR scan ever fails, the courier can type this
    enc.align("center").line(driverUrl.replace(/^https?:\/\//, ""));
  }

  enc.line("--------------------------------");
  enc.align("center").line("MenuSanJuan");
  enc.line("menusanjuan.com");
  enc.line(TICKET_BUILD);

  // Feed a few lines and cut
  enc.newline().newline().newline().cut("partial");

  return toArrayBufferBacked(enc.encode());
}

/**
 * Copy the encoder's Uint8Array into a fresh ArrayBuffer-backed Uint8Array.
 * Prisma's Bytes type is typed as `Uint8Array<ArrayBuffer>`, which excludes
 * `Uint8Array<ArrayBufferLike>` (the generic shape the encoder returns).
 * The copy guarantees we're on a real ArrayBuffer.
 */
function toArrayBufferBacked(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(src.length);
  const view = new Uint8Array(buf);
  view.set(src);
  return view;
}

/**
 * Hardcoded test ticket — printed when the owner clicks "Probar impresión"
 * in the dashboard. Confirms the agent works without needing a real order.
 */
export function buildTestTicket(restaurantName: string): Uint8Array<ArrayBuffer> {
  // (typed as Uint8Array<ArrayBuffer> so Prisma's `Bytes` accepts it directly)
  const enc = newEncoder().initialize();
  enc.align("center").size(1, 1).bold(true).line(noTildes(restaurantName)).bold(false).size(0, 0);
  enc.line("--------------------------------");
  enc.bold(true).line("TEST DE IMPRESORA").bold(false);
  enc.line(new Date().toLocaleString("es-AR"));
  enc.line("--------------------------------");
  enc.align("left");
  enc.line("Si lees esto, el agente esta");
  enc.line("conectado y enviando bytes al");
  enc.line("printer correctamente.");
  enc.newline();
  enc.line("Si el QR de abajo aparece:");
  enc.line("- ESC/POS funciona correcto");
  enc.line("- vas a ver el QR en cada");
  enc.line("  ticket de pedido.");
  enc.newline();
  enc.align("center").qrcode("https://menusanjuan.com", { model: 2, size: 6, errorlevel: "h" });
  enc.line("--------------------------------");
  enc.line("MenuSanJuan");
  enc.line(TICKET_BUILD);
  enc.newline().newline().newline().cut("partial");
  return toArrayBufferBacked(enc.encode());
}
