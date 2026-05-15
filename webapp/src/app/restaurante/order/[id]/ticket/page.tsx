import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { TicketView } from "./TicketView";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealer = await getRestauranteFromSession();
  if (!dealer) redirect("/restaurante/login");

  const order = await prisma.order.findUnique({
    where: { id },
    include: { dealer: { select: { name: true, slug: true, phone: true, logoUrl: true } } },
  });

  if (!order) notFound();
  // Only allow the owner of the resta on this order to see/print it
  if (order.restauranteSlug !== dealer.slug) notFound();

  const ticketBase = process.env.NEXT_PUBLIC_BASE_URL || "https://menusanjuan.com";
  const driverUrl = order.driverAccessToken
    ? `${ticketBase}/d/${order.id}?t=${order.driverAccessToken}`
    : null;

  return (
    <TicketView
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        restaurantName: order.dealer?.name || order.restauranteSlug,
        restaurantPhone: order.dealer?.phone || "",
        restaurantLogo: order.dealer?.logoUrl || null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress || "",
        items: order.items as any,
        total: order.total,
        deliveryFee: order.deliveryFee,
        deliveryMethod: order.deliveryMethod,
        notes: order.notes || "",
        paymentStatus: order.paymentStatus as "PAID" | "UNPAID",
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt.toISOString(),
      }}
      driverUrl={driverUrl}
    />
  );
}
