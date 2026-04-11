// Email notification to restaurant owner when a new order arrives

import { sendEmail } from "./email";
import { prisma } from "./prisma";
import type { Order, OrderItem } from "./orders-store";

/**
 * Look up the restaurant owner's email via Dealer -> Account -> User,
 * then send a branded email with the order summary.
 *
 * This function never throws — it logs errors and returns silently.
 * Designed to be called fire-and-forget from the API route.
 */
export async function notifyRestaurantOfNewOrder(order: Order): Promise<void> {
  try {
    // Resolve Dealer -> Account -> User to get the owner email
    const dealer = await prisma.dealer.findUnique({
      where: { slug: order.restauranteSlug },
      include: {
        account: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    if (!dealer) {
      console.warn(`[order-notification] Dealer not found for slug: ${order.restauranteSlug}`);
      return;
    }

    const ownerEmail = dealer.account.user.email;

    // Skip placeholder emails (imported restaurants that have no real owner)
    if (ownerEmail.endsWith("@menusanjuan.com")) {
      return;
    }

    const deliveryLabel = order.deliveryMethod === "pickup" ? "Retiro en local" : "Delivery";
    const itemsHtml = (order.items as OrderItem[])
      .map(
        (item) =>
          `<tr>
            <td style="padding: 6px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9;">${item.quantity}x ${escapeHtml(item.name)}</td>
            <td style="padding: 6px 0; font-size: 14px; color: #334155; text-align: right; border-bottom: 1px solid #f1f5f9;">$ ${item.total.toLocaleString("es-AR")}</td>
          </tr>`
      )
      .join("");

    const deliveryFeeRow =
      order.deliveryFee > 0
        ? `<tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Envio</td>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; text-align: right;">$ ${order.deliveryFee.toLocaleString("es-AR")}</td>
          </tr>`
        : "";

    const notesSection = order.notes
      ? `<p style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 8px 12px; border-radius: 8px; margin: 12px 0 0;"><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>`
      : "";

    const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; font-size: 24px; font-weight: bold; line-height: 48px;">M</div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 12px 0 4px;">Nuevo pedido</h1>
        <p style="font-size: 14px; color: #64748b; margin: 0;">${escapeHtml(dealer.name)} &mdash; ${order.orderNumber}</p>
      </div>

      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #9a3412;"><strong>Cliente:</strong> ${escapeHtml(order.customerName)}</p>
        <p style="margin: 0 0 4px; font-size: 14px; color: #9a3412;"><strong>Tel:</strong> ${escapeHtml(order.customerPhone)}</p>
        <p style="margin: 0 0 4px; font-size: 14px; color: #9a3412;"><strong>Metodo:</strong> ${deliveryLabel}</p>
        ${order.deliveryMethod !== "pickup" && order.customerAddress ? `<p style="margin: 0; font-size: 14px; color: #9a3412;"><strong>Direccion:</strong> ${escapeHtml(order.customerAddress)}</p>` : ""}
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
        ${deliveryFeeRow}
        <tr>
          <td style="padding: 10px 0 0; font-size: 16px; font-weight: 700; color: #0f172a;">Total</td>
          <td style="padding: 10px 0 0; font-size: 16px; font-weight: 700; color: #f97316; text-align: right;">$ ${order.total.toLocaleString("es-AR")}</td>
        </tr>
      </table>

      ${notesSection}

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://menusanjuan.com/restaurante/pedidos"
           style="display: inline-block; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
          Ver en el panel
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #cbd5e1; text-align: center;">menusanjuan.com</p>
    </div>
    `;

    await sendEmail({
      to: ownerEmail,
      subject: `Nuevo pedido ${order.orderNumber} - ${escapeHtml(order.customerName)}`,
      html,
    });
  } catch (err) {
    console.error("[order-notification] Failed to send notification:", err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
