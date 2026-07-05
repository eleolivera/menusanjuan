// Owner-side rewards config. GET returns the current program + top-10
// customers near the prize. PATCH upserts the program and toggles the
// dealer-level rewardsEnabled kill switch.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { rewardsFlag, getTopProgressForDealer } from "@/lib/rewards";

export async function GET() {
  if (!rewardsFlag()) return new NextResponse("Not found", { status: 404 });

  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId: dealer.id },
  });

  // Inline the list of menu items so the owner UI can render the picker
  // without a second round-trip.
  const menuItems = await prisma.menuItem.findMany({
    where: { category: { dealerId: dealer.id }, available: true },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const topProgress = await getTopProgressForDealer(dealer.id);

  return NextResponse.json({
    rewardsEnabled: dealer.rewardsEnabled,
    program,
    menuItems: menuItems.map((m) => ({ id: m.id, name: m.name, price: m.price, category: m.category.name })),
    topProgress,
  });
}

export async function PATCH(request: NextRequest) {
  if (!rewardsFlag()) return new NextResponse("Not found", { status: 404 });

  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    rewardsEnabled?: boolean;
    name?: string;
    description?: string;
    punchesNeeded?: number;
    rewardItemId?: string;
    expiresInDays?: number;
    enabled?: boolean;
    qualifyingItemIds?: string[] | null;
    redemptionRequiresItemIds?: string[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Dealer-level kill switch
  if (body.rewardsEnabled !== undefined) {
    await prisma.dealer.update({
      where: { id: dealer.id },
      data: { rewardsEnabled: Boolean(body.rewardsEnabled) },
    });
  }

  // Program upsert. Only meaningful if at least the reward item is set.
  if (body.rewardItemId) {
    // Validate the reward item belongs to THIS dealer — anti-injection.
    const item = await prisma.menuItem.findFirst({
      where: { id: body.rewardItemId, category: { dealerId: dealer.id } },
      select: { id: true },
    });
    if (!item) return NextResponse.json({ error: "invalid_reward_item" }, { status: 400 });

    const punchesNeeded = clampInt(body.punchesNeeded, 2, 100, 10);
    const expiresInDays = clampInt(body.expiresInDays, 1, 365, 30);
    const name = (body.name || "Programa de premios").trim().slice(0, 80);
    const description = (body.description || "Juntá pedidos y llevate un premio.").trim().slice(0, 240);
    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;

    // Qualifying items: NULL/empty = "all orders count" (legacy). If provided,
    // validate every ID belongs to THIS dealer.
    let qualifyingItemIds: string[] | null = null;
    if (Array.isArray(body.qualifyingItemIds) && body.qualifyingItemIds.length > 0) {
      const clean = Array.from(new Set(body.qualifyingItemIds.filter((v): v is string => typeof v === "string" && v.length > 0)));
      if (clean.length > 0) {
        const owned = await prisma.menuItem.findMany({
          where: { id: { in: clean }, category: { dealerId: dealer.id } },
          select: { id: true },
        });
        if (owned.length !== clean.length) {
          return NextResponse.json({ error: "invalid_qualifying_items" }, { status: 400 });
        }
        qualifyingItemIds = clean;
      }
    }

    // Redemption-requires items ("free X with next purchase of Y"): same
    // validation shape as qualifyingItemIds but a distinct field. NULL/empty
    // = auto-apply on any next order.
    let redemptionRequiresItemIds: string[] | null = null;
    if (Array.isArray(body.redemptionRequiresItemIds) && body.redemptionRequiresItemIds.length > 0) {
      const clean = Array.from(new Set(body.redemptionRequiresItemIds.filter((v): v is string => typeof v === "string" && v.length > 0)));
      if (clean.length > 0) {
        const owned = await prisma.menuItem.findMany({
          where: { id: { in: clean }, category: { dealerId: dealer.id } },
          select: { id: true },
        });
        if (owned.length !== clean.length) {
          return NextResponse.json({ error: "invalid_redemption_items" }, { status: 400 });
        }
        redemptionRequiresItemIds = clean;
      }
    }

    await prisma.rewardProgram.upsert({
      where: { dealerId: dealer.id },
      create: {
        dealerId: dealer.id,
        name,
        description,
        punchesNeeded,
        rewardItemId: body.rewardItemId,
        expiresInDays,
        enabled,
        qualifyingItemIds: qualifyingItemIds ?? Prisma.JsonNull,
        redemptionRequiresItemIds: redemptionRequiresItemIds ?? Prisma.JsonNull,
      },
      update: {
        name,
        description,
        punchesNeeded,
        rewardItemId: body.rewardItemId,
        expiresInDays,
        enabled,
        qualifyingItemIds: qualifyingItemIds ?? Prisma.JsonNull,
        redemptionRequiresItemIds: redemptionRequiresItemIds ?? Prisma.JsonNull,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
