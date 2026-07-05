// Public read-only endpoint. Returns the current punch count + program copy
// for a (dealer slug, customer phone). Used by the menu-page badge before
// the customer signs in with Google.
//
// No auth — by design, knowing your own phone is enough to see your own
// progress. Phone format is validated via libphonenumber-js; invalid → 400.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rewardsFlag, getProgressByPhoneForDealer, normalizePhoneE164 } from "@/lib/rewards";
import { isValidPhone } from "@/lib/phone";

export async function GET(request: NextRequest) {
  if (!rewardsFlag()) return new NextResponse("Not found", { status: 404 });

  const slug = request.nextUrl.searchParams.get("slug");
  const phone = request.nextUrl.searchParams.get("phone");
  if (!slug || !phone) return NextResponse.json({ error: "missing_params" }, { status: 400 });
  if (!isValidPhone(phone)) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  const dealer = await prisma.dealer.findUnique({ where: { slug }, select: { id: true, rewardsEnabled: true } });
  if (!dealer || !dealer.rewardsEnabled) return NextResponse.json({ enabled: false });

  const data = await getProgressByPhoneForDealer(phone, dealer.id);
  if (!data) return NextResponse.json({ enabled: false });

  // Also fetch the reward item name + required-items names + the customer's
  // googleSub so the badge can decide whether to prompt for Google Sign-In.
  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId: dealer.id },
    select: {
      rewardItem: { select: { name: true } },
      redemptionRequiresItemIds: true,
    },
  });

  let requiresItemNames: string[] = [];
  if (program?.redemptionRequiresItemIds && Array.isArray(program.redemptionRequiresItemIds)) {
    const ids = (program.redemptionRequiresItemIds as unknown[]).filter((v): v is string => typeof v === "string");
    if (ids.length > 0) {
      const items = await prisma.menuItem.findMany({
        where: { id: { in: ids } },
        select: { name: true },
      });
      requiresItemNames = items.map((i) => i.name);
    }
  }

  // Customer.googleSub: null means they haven't done the one-time claim yet.
  // Two related flags exposed to the client:
  //   hasGoogleSignIn — status flag (drives the accrue+nudge state D)
  //   needsGoogleSignIn — computed "eligible AND no google" (legacy field used
  //   by the pre-linkage badge — kept for compatibility while we roll out).
  const canonical = normalizePhoneE164(phone) || phone;
  const customer = await prisma.customer.findUnique({
    where: { phone: canonical },
    select: { googleSub: true },
  });
  const hasGoogleSignIn = Boolean(customer?.googleSub);
  const needsGoogleSignIn = data.eligible && !hasGoogleSignIn;

  return NextResponse.json({
    enabled: true,
    punches: data.punches,
    punchesNeeded: data.program.punchesNeeded,
    rewardName: data.program.name,             // program display name (legacy field)
    rewardItemName: program?.rewardItem.name || data.program.name,
    rewardDescription: data.program.description,
    eligible: data.eligible,
    hasActiveRedemption: Boolean(data.activeRedemption),
    hasGoogleSignIn,
    needsGoogleSignIn,
    requiresItemNames,
  });
}
