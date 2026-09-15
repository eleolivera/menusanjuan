// POST /api/promo/click — landing beacon for tracked links (?utm_source=…).
//
// Fired by StoreMenu on mount ONLY when the URL carried utm_source, so organic
// traffic never reaches this route. Writes one PromoClick row so the owner
// dashboard can show clicks → orders per campaign. No PII is stored.
//
// Public + unauthenticated by nature (the visitor is anonymous), so it is
// defensively cheap to abuse-proof: strict field whitelisting, length caps,
// slug must resolve to an active dealer, and a per-IP rate limit namespaced
// so it can't share a bucket with the login limiter.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// 60 clicks/min per IP — a human produces ~1 per landing; a NAT'd office or
// campus stays comfortably under; a naive script does not.
const clickLimiter = createRateLimiter({ maxAttempts: 60, windowMs: 60_000 });

const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" ? v.replace(/[^\x20-\x7E]/g, "").trim().slice(0, max) || null : null;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!clickLimiter(`click:${ip}`).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const slug = clean(body.slug, 80);
  const utmSource = clean(body.utmSource, 64);
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !utmSource) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Only record clicks for real, active restas — rejects junk slugs and
  // keeps the table from becoming a dumping ground.
  const dealer = await prisma.dealer.findUnique({ where: { slug }, select: { isActive: true } });
  if (!dealer?.isActive) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await prisma.promoClick.create({
    data: {
      dealerSlug: slug,
      utmSource,
      utmMedium: clean(body.utmMedium, 64),
      utmCampaign: clean(body.utmCampaign, 64),
      itemId: clean(body.itemId, 64),
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
