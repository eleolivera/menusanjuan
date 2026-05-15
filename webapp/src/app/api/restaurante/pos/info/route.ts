import { NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { prisma } from "@/lib/prisma";
import { parseDeliveryZones } from "@/lib/delivery";

// GET — POS-related dealer info: enabled flag, table suggestions, delivery config
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const fullDealer = await prisma.dealer.findUnique({
    where: { id: dealer.id },
    select: {
      posEnabled: true,
      tableSuggestions: true,
      name: true,
      slug: true,
      latitude: true,
      longitude: true,
      address: true,
      deliveryEnabled: true,
      deliveryZones: true,
      deliveryCloseRadius: true,
      deliveryClosePrice: true,
      deliveryFarRadius: true,
      deliveryFarPrice: true,
      deliveryFee: true,
    },
  });

  return NextResponse.json({
    posEnabled: fullDealer?.posEnabled ?? false,
    tableSuggestions: (fullDealer?.tableSuggestions as string[]) || [],
    name: fullDealer?.name,
    slug: fullDealer?.slug,
    address: fullDealer?.address ?? null,
    deliveryConfig: {
      deliveryEnabled: fullDealer?.deliveryEnabled ?? false,
      deliveryZones: parseDeliveryZones(fullDealer?.deliveryZones ?? null),
      deliveryCloseRadius: fullDealer?.deliveryCloseRadius ?? null,
      deliveryClosePrice: fullDealer?.deliveryClosePrice ?? null,
      deliveryFarRadius: fullDealer?.deliveryFarRadius ?? null,
      deliveryFarPrice: fullDealer?.deliveryFarPrice ?? null,
      deliveryFee: fullDealer?.deliveryFee ?? null,
      latitude: fullDealer?.latitude ?? null,
      longitude: fullDealer?.longitude ?? null,
    },
  });
}
