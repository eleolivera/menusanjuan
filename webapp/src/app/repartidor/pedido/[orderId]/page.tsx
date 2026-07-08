import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { PedidoClient } from "@/components/repartidor/PedidoClient";

type OrderItemJson = {
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  optionsDelta?: number;
  note?: string;
  options?: Array<{ name: string }> | string[];
};

export default async function RepartidorPedidoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { driverId } = await requireDriverSession();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || order.assignedDriverId !== driverId) {
    redirect("/repartidor");
  }

  // Resolve restaurant name + logo via slug
  const dealer = await prisma.dealer.findUnique({
    where: { slug: order.restauranteSlug },
    select: { name: true, logoUrl: true },
  });

  // items stored as JSON on Order.items
  const rawItems: OrderItemJson[] = Array.isArray(order.items)
    ? (order.items as unknown as OrderItemJson[])
    : [];

  const serialized = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: (order.paymentStatus || "UNPAID") as "UNPAID" | "PAID" | "PAID_UNVERIFIED",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress ?? null,
    latitude: order.latitude ?? null,
    longitude: order.longitude ?? null,
    items: rawItems.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      optionsDelta: it.optionsDelta,
      note: it.note,
    })),
    total: order.total,
    deliveryFee: order.deliveryFee,
    notes: order.notes ?? null,
    pickedUpAt: order.pickedUpAt ? order.pickedUpAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    restaurantName: dealer?.name ?? order.restauranteSlug,
    restaurantLogo: dealer?.logoUrl ?? null,
  };

  return <PedidoClient order={serialized} />;
}
