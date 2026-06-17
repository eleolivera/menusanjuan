// Public read-only endpoint. Returns the current punch count + program copy
// for a (dealer slug, customer phone). Used by the menu-page badge before
// the customer signs in with Google.
//
// No auth — by design, knowing your own phone is enough to see your own
// progress. Phone format is validated via libphonenumber-js; invalid → 400.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rewardsFlag, getProgressByPhoneForDealer } from "@/lib/rewards";
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

  return NextResponse.json({
    enabled: true,
    punches: data.punches,
    punchesNeeded: data.program.punchesNeeded,
    rewardName: data.program.name,
    rewardDescription: data.program.description,
    eligible: data.eligible,
    hasActiveRedemption: Boolean(data.activeRedemption),
  });
}
