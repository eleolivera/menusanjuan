import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/orders/[id]/receipt
 * Query: ?t=<customerAccessToken>
 * Body:  multipart/form-data with `file`
 *
 * Customer-authenticated receipt upload. Anyone who has the order's
 * customerAccessToken can upload a comprobante. We:
 *   1. validate the token against the order
 *   2. reject if the order is already PAID (cashier already confirmed it
 *      via "Cobrar" / "Ya pagó" — no point in uploading after)
 *   3. reject if the total isn't finalized (deliveryFee column is non-null +
 *      method !== "delivery" or method is delivery with fee>0 — i.e. no
 *      "envío a confirmar" state)
 *   4. upload the image to R2 under comprobantes/{orderId}-{ts}.{ext}
 *   5. set paymentReceiptUrl + paymentReceiptAt + paymentStatus=PAID_UNVERIFIED
 *
 * Cashier sees the order flip in the Kanban via the existing 5s poll, then
 * opens the OrderCard to validate/reject.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "Falta token" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.customerAccessToken !== token) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Refuse to overwrite a payment the cashier already confirmed.
  if (order.paymentStatus === "PAID") {
    return NextResponse.json(
      { error: "Este pedido ya fue marcado como pagado por el restaurante." },
      { status: 409 },
    );
  }

  // Need a finalized total before accepting a receipt. The cashier can't
  // validate "comprobante de $X" against a yet-undefined delivery fee.
  if (order.deliveryMethod === "delivery" && (!order.deliveryFee || order.deliveryFee <= 0)) {
    return NextResponse.json(
      { error: "El envío todavía no está definido. Esperá a que el restaurante confirme el costo de envío antes de subir el comprobante." },
      { status: 409 },
    );
  }

  // Parse multipart
  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Subí una imagen (JPG / PNG / WEBP / HEIC)." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `La imagen es muy grande (máx ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  const ext = file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : file.type === "image/heic" || file.type === "image/heif" ? "heic"
    : "jpg";
  const key = `comprobantes/${order.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(buffer, key, file.type);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentReceiptUrl: url,
      paymentReceiptAt: new Date(),
      paymentStatus: "PAID_UNVERIFIED",
      // Note: paymentMethod stays null until the cashier validates. We don't
      // pre-fill from paymentIntent because the cashier may correct it.
    },
  });

  return NextResponse.json({
    success: true,
    paymentReceiptUrl: updated.paymentReceiptUrl,
    paymentStatus: updated.paymentStatus,
  });
}
