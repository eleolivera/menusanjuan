// Owner-side: create a gift Redemption for a specific customer.
//
// Auth: owner session (getRestauranteFromSession). Soft ownership check —
// the target customer must have at least one order at THIS dealer (prevents
// gifting arbitrary phone numbers cross-resta).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteContext } from "@/lib/restaurante-auth";
import { createGiftRedemption, type GiftKind } from "@/lib/rewards";

export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;

  const ctx = await getRestauranteContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { dealer } = ctx;

  // Soft-scope: target customer must have ordered at this dealer.
  const anyOrder = await prisma.order.findFirst({
    where: { customerId, restauranteSlug: dealer.slug },
    select: { id: true },
  });
  if (!anyOrder) return NextResponse.json({ error: "customer_not_in_scope" }, { status: 403 });

  let body: {
    kind?: GiftKind;
    giftMenuItemId?: string;
    giftDiscountPct?: number;
    giftDiscountAmount?: number;
    giftNote?: string;
    ttlDays?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const validKinds: GiftKind[] = ["GIFT_ITEM", "GIFT_DISCOUNT_PCT", "GIFT_DISCOUNT_AMOUNT"];
  if (!body.kind || !validKinds.includes(body.kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  // Validate reward-item ownership if applicable.
  if (body.kind === "GIFT_ITEM") {
    if (!body.giftMenuItemId) return NextResponse.json({ error: "missing_item" }, { status: 400 });
    const item = await prisma.menuItem.findFirst({
      where: { id: body.giftMenuItemId, category: { dealerId: dealer.id } },
      select: { id: true },
    });
    if (!item) return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  // Attribute the gift to the acting user (owner or staff) for audit — the
  // rewards helper preserves the parameter name `ownerUserId` for back-compat
  // but any DealerMember is allowed to gift on behalf of the resta.
  const actingUserId = ctx.sessionUserId;

  try {
    const gift = await createGiftRedemption({
      ownerUserId: actingUserId,
      dealerId: dealer.id,
      customerId,
      kind: body.kind,
      giftMenuItemId: body.giftMenuItemId,
      giftDiscountPct: body.giftDiscountPct,
      giftDiscountAmount: body.giftDiscountAmount,
      giftNote: body.giftNote,
      ttlDays: body.ttlDays,
    });
    return NextResponse.json(gift, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
