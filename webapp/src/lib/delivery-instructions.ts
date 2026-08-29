import type { Order } from "@/lib/orders-store";
import { formatItemQuantity } from "@/lib/order-item-display";

/**
 * Builds a single block of text the cashier can paste into the resta's
 * WhatsApp delivery group so the driver gets everything they need at a glance:
 * order number, customer info, address, items, amount to collect, and the
 * driver-page URL with the tracking + "marcar entregado" link.
 *
 * Used in two spots in the OrderCard:
 *   - Cliente block ("📋 Instrucciones para delivery" button)
 *   - Post-print "¿Mandar a la cocina?" modal (same button)
 *
 * Only meaningful for delivery orders; callers gate by `deliveryMethod`.
 */
export function buildDeliveryInstructions(order: Order, restaurantName: string): string {
  const lines: string[] = [];

  lines.push(`🛵 Pedido para entregar — ${restaurantName}`);
  lines.push(`#${order.orderNumber}`);
  lines.push("");

  lines.push(`Cliente: ${order.customerName}`);
  if (order.customerPhone) lines.push(`Tel: ${order.customerPhone}`);
  if (order.customerAddress) lines.push(`Dirección: ${order.customerAddress}`);
  if (order.notes) lines.push(`Notas: ${order.notes}`);

  lines.push("");
  lines.push("Items:");
  const items = (order.items as Array<{ name: string; quantity: number }> | undefined) || [];
  for (const it of items) {
    lines.push(`• ${formatItemQuantity(it)} ${it.name}`);
  }

  lines.push("");
  const totalDue = (order.total || 0) + (order.deliveryFee || 0);
  const totalLine = `Total: $${totalDue.toLocaleString("es-AR")}`;
  if (order.paymentStatus === "PAID") {
    lines.push(`${totalLine} — ✓ YA PAGÓ`);
  } else {
    lines.push(`${totalLine} — 🔴 COBRAR`);
  }

  // Driver URL (map + estado + marcar entregado). Only present on orders
  // created after we shipped driver tokens — old orders won't have one.
  if (order.driverAccessToken) {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://menusanjuan.com";
    const url = `${base}/d/${order.id}?t=${order.driverAccessToken}`;
    lines.push("");
    lines.push("Mapa + marcar entregado:");
    lines.push(url);
  }

  return lines.join("\n");
}
