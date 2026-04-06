import { NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { prisma } from "@/lib/prisma";

// GET — POS-related dealer info: enabled flag, table suggestions, menu
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const fullDealer = await prisma.dealer.findUnique({
    where: { id: dealer.id },
    select: { posEnabled: true, tableSuggestions: true, name: true, slug: true },
  });

  return NextResponse.json({
    posEnabled: fullDealer?.posEnabled ?? false,
    tableSuggestions: (fullDealer?.tableSuggestions as string[]) || [],
    name: fullDealer?.name,
    slug: fullDealer?.slug,
  });
}
