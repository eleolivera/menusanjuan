// Customer-side: create a READY Redemption for an eligible customer at a
// resta. Requires customer Google session; the cookie is verified by
// getCustomerFromSession(). Decrements punches inside the same DB tx.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rewardsFlag, createRedemption } from "@/lib/rewards";
import { getCustomerFromSession } from "@/lib/customer-auth";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!rewardsFlag()) return new NextResponse("Not found", { status: 404 });

  // Rate-limit by IP to prevent a malicious client from rapid-firing claim
  // requests after a session leak.
  const limit = authLimiter(getClientIp(request));
  if (!limit.allowed) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  const customer = await getCustomerFromSession();
  if (!customer) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  const dealer = await prisma.dealer.findUnique({
    where: { slug: body.slug },
    select: { id: true, rewardsEnabled: true },
  });
  if (!dealer?.rewardsEnabled) return NextResponse.json({ error: "rewards_off" }, { status: 400 });

  try {
    const redemption = await createRedemption(customer.id, dealer.id);
    return NextResponse.json({ ok: true, redemptionId: redemption.id });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : "error";
    const status = code === "not_eligible" ? 400 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
