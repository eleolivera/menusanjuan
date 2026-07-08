import { redirect } from "next/navigation";
import { clearDriverSessionCookie, requireDriverSession } from "@/lib/driver-auth";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/repartidor/HomeClient";

export const dynamic = "force-dynamic";

export default async function RepartidorHomePage() {
  const session = await requireDriverSession();

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    include: {
      shifts: {
        where: { endedAt: null },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
      assignedOrders: {
        where: { status: { not: "DELIVERED" } },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          dealer: { select: { name: true } },
        },
      },
    },
  });

  if (!driver) {
    // Session references a deleted driver — force logout.
    // Static import of `redirect` so TS sees its `never` return type and
    // narrows `driver` to non-null below.
    await clearDriverSessionCookie();
    redirect("/repartidor/login");
  }

  const activeShift = driver.shifts[0] ?? null;
  const activeOrderRaw = driver.assignedOrders[0] ?? null;

  let cashInHand = driver.onShift && activeShift ? activeShift.cashOnHandStart : 0;
  if (activeShift) {
    const agg = await prisma.driverCashEvent.aggregate({
      where: { shiftId: activeShift.id },
      _sum: { amount: true },
    });
    cashInHand = activeShift.cashOnHandStart + (agg._sum.amount ?? 0);
  }

  const activeOrder = activeOrderRaw
    ? {
        id: activeOrderRaw.id,
        orderNumber: activeOrderRaw.orderNumber,
        customerName: activeOrderRaw.customerName,
        customerAddress: activeOrderRaw.customerAddress,
        total: activeOrderRaw.total,
        deliveryFee: activeOrderRaw.deliveryFee,
        pickedUpAt: activeOrderRaw.pickedUpAt ? activeOrderRaw.pickedUpAt.toISOString() : null,
        restaurantName: activeOrderRaw.dealer?.name ?? activeOrderRaw.restauranteSlug,
      }
    : null;

  return (
    <HomeClient
      driver={{
        id: driver.id,
        displayName: driver.displayName,
        vehicleType: driver.vehicleType,
      }}
      activeShift={
        activeShift
          ? {
              id: activeShift.id,
              startedAt: activeShift.startedAt.toISOString(),
              cashOnHandStart: activeShift.cashOnHandStart,
            }
          : null
      }
      activeOrder={activeOrder}
      cashInHand={cashInHand}
    />
  );
}
