import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { CerrarTurnoClient } from "@/components/repartidor/CerrarTurnoClient";

export default async function CerrarTurnoPage() {
  const { driverId } = await requireDriverSession();

  const activeShift = await prisma.driverShift.findFirst({
    where: { driverId, endedAt: null },
    include: { cashEvents: true },
    orderBy: { startedAt: "desc" },
  });

  if (!activeShift) {
    // Contract: no open shift → redirect to /repartidor
    redirect("/repartidor");
  }

  const inFlight = await prisma.order.findFirst({
    where: { assignedDriverId: driverId, status: { not: "DELIVERED" } },
    select: { id: true, orderNumber: true },
  });

  const collectedTotal = activeShift.cashEvents.reduce((sum, e) => sum + e.amount, 0);
  const expectedCash = activeShift.cashOnHandStart + collectedTotal;

  return (
    <CerrarTurnoClient
      shift={{
        id: activeShift.id,
        startedAt: activeShift.startedAt.toISOString(),
        cashOnHandStart: activeShift.cashOnHandStart,
      }}
      collectedTotal={collectedTotal}
      expectedCash={expectedCash}
      blocked={!!inFlight}
      blockedOrderNumber={inFlight?.orderNumber}
      blockedOrderId={inFlight?.id}
    />
  );
}
