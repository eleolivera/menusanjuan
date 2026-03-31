import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

function computeCompleteness(dealer: {
  logoUrl: string | null;
  coverUrl: string | null;
  address: string | null;
  phone: string;
  _count: { categories: number; items: number };
}) {
  const hasLogo = !!dealer.logoUrl;
  const hasCover = !!dealer.coverUrl;
  const hasAddress = !!dealer.address;
  const hasPhone = !!dealer.phone && dealer.phone !== "0000000000" && dealer.phone.length > 4;
  const hasMenu = dealer._count.categories > 0 && dealer._count.items > 0;
  const score = [hasLogo, hasCover, hasAddress, hasPhone, hasMenu].filter(Boolean).length;
  return { hasLogo, hasCover, hasAddress, hasPhone, hasMenu, score, total: 5 };
}

function autoStage(completeness: { score: number; total: number }) {
  return completeness.score >= completeness.total ? "READY" as const : "NEEDS_INFO" as const;
}

// GET — all onboarding cards with dealer data
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Get all dealers with their onboarding cards
  const dealers = await prisma.dealer.findMany({
    orderBy: { name: "asc" },
    include: {
      account: { include: { user: { select: { email: true, name: true, phone: true } } } },
      onboardingCard: { include: { notes: { orderBy: { createdAt: "desc" } } } },
      _count: {
        select: {
          categories: true,
          orders: true,
        },
      },
    },
  });

  // Also get item counts per dealer
  const itemCounts = await prisma.menuItem.groupBy({
    by: ["categoryId"],
    _count: true,
  });
  const categoryItems = await prisma.menuCategory.findMany({
    select: { id: true, dealerId: true },
  });
  const dealerItemCount: Record<string, number> = {};
  for (const cat of categoryItems) {
    const count = itemCounts.find((ic) => ic.categoryId === cat.id)?._count ?? 0;
    dealerItemCount[cat.dealerId] = (dealerItemCount[cat.dealerId] || 0) + count;
  }

  // Auto-create cards for dealers without one
  const dealersWithoutCard = dealers.filter((d) => !d.onboardingCard);
  if (dealersWithoutCard.length > 0) {
    const cardsToCreate = dealersWithoutCard.map((d) => {
      const comp = computeCompleteness({
        ...d,
        _count: { categories: d._count.categories, items: dealerItemCount[d.id] || 0 },
      });
      return {
        dealerId: d.id,
        stage: autoStage(comp),
        sortOrder: 0,
      };
    });
    await prisma.onboardingCard.createMany({ data: cardsToCreate });

    // Re-fetch to get the created cards
    const newCards = await prisma.onboardingCard.findMany({
      where: { dealerId: { in: dealersWithoutCard.map((d) => d.id) } },
      include: { notes: { orderBy: { createdAt: "desc" } } },
    });
    for (const card of newCards) {
      const dealer = dealers.find((d) => d.id === card.dealerId);
      if (dealer) (dealer as any).onboardingCard = card;
    }
  }

  const cards = dealers.map((d) => {
    const comp = computeCompleteness({
      ...d,
      _count: { categories: d._count.categories, items: dealerItemCount[d.id] || 0 },
    });
    return {
      id: d.onboardingCard!.id,
      dealerId: d.id,
      stage: d.onboardingCard!.stage,
      sortOrder: d.onboardingCard!.sortOrder,
      stageChangedAt: d.onboardingCard!.stageChangedAt,
      lastContactedAt: d.onboardingCard!.lastContactedAt,
      lastPassword: d.onboardingCard!.lastPassword,
      dealer: {
        id: d.id,
        name: d.name,
        slug: d.slug,
        phone: d.phone,
        address: d.address,
        logoUrl: d.logoUrl,
        coverUrl: d.coverUrl,
        isActive: d.isActive,
        isVerified: d.isVerified,
        isPlaceholder: d.account.user.email.endsWith("@menusanjuan.com"),
        ownerEmail: d.account.user.email,
        ownerPhone: d.account.user.phone,
        categoryCount: d._count.categories,
        itemCount: dealerItemCount[d.id] || 0,
        orderCount: d._count.orders,
      },
      completeness: comp,
      notes: d.onboardingCard!.notes || [],
    };
  });

  return NextResponse.json({ cards });
}

// PATCH — move card to new stage or update sort order
export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { cardId, stage, sortOrder, lastContactedAt } = body;

  if (!cardId) {
    return NextResponse.json({ error: "cardId requerido" }, { status: 400 });
  }

  const updateData: any = { updatedAt: new Date() };
  if (stage !== undefined) {
    updateData.stage = stage;
    updateData.stageChangedAt = new Date();
  }
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (lastContactedAt) updateData.lastContactedAt = new Date();

  const card = await prisma.onboardingCard.update({
    where: { id: cardId },
    data: updateData,
  });

  // Side effect: if moved to ONBOARDED, activate the restaurant
  if (stage === "ONBOARDED") {
    await prisma.dealer.update({
      where: { id: card.dealerId },
      data: { isActive: true, isVerified: true },
    });
  }

  return NextResponse.json(card);
}
