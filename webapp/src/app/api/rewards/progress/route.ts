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
import { getCustomerFromSession } from "@/lib/customer-auth";

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

  // Also fetch the reward item + required-items names + the customer's
  // googleSub so the badge can decide whether to prompt for Google Sign-In.
  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId: dealer.id },
    select: {
      rewardItemId: true,
      rewardItem: { select: { name: true, price: true } },
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

  // "Am I signed in for THIS phone?" — the badge state must match the
  // consumption gate at checkout, which requires the customer session cookie
  // to identify the SAME Customer.id as the one the typed phone maps to.
  // A session on a DIFFERENT Customer doesn't help — checkout will still
  // skip auto-apply because the phone-lookup returns a different row.
  //
  // hasGoogleSignIn is therefore an AND, not an OR:
  //   (a) phone-Customer exists AND has googleSub AND
  //   (b) an active session Customer exists AND its id === phone-Customer.id
  //
  // Without (b), the badge would falsely promise "listo" while checkout
  // silently fails — the bug that surfaced when Elio had a stale session
  // for a different Customer row than the phone in localStorage.
  const canonical = normalizePhoneE164(phone) || phone;
  const [customer, sessionCustomer] = await Promise.all([
    prisma.customer.findUnique({ where: { phone: canonical }, select: { id: true, googleSub: true } }),
    getCustomerFromSession(),
  ]);
  const phoneCustomerHasGoogle = Boolean(customer?.googleSub);
  const sessionMatchesPhone = Boolean(customer && sessionCustomer && sessionCustomer.id === customer.id);
  const hasGoogleSignIn = phoneCustomerHasGoogle && sessionMatchesPhone;
  const needsGoogleSignIn = data.eligible && !hasGoogleSignIn;

  return NextResponse.json({
    enabled: true,
    punches: data.punches,
    punchesNeeded: data.program.punchesNeeded,
    rewardName: data.program.name,             // program display name (legacy field)
    rewardItemId: program?.rewardItemId || null,
    rewardItemName: program?.rewardItem.name || data.program.name,
    rewardItemPrice: program?.rewardItem.price ?? null,
    rewardDescription: data.program.description,
    eligible: data.eligible,
    hasActiveRedemption: Boolean(data.activeRedemption),
    hasGoogleSignIn,
    needsGoogleSignIn,
    requiresItemNames,
  });
}
