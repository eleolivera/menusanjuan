// Customer-side: validates a redemption code against a cart and returns the
// discount preview (or error). No auth — the code itself is the credential.
// Rate-limited by IP so an attacker can't brute-force the 31^8 code space.

import { NextRequest, NextResponse } from "next/server";
import { previewRedemptionCode } from "@/lib/rewards";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = authLimiter(ip);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: { code?: string; dealerSlug?: string; cartItems?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const { code, dealerSlug, cartItems } = body;
  if (!code || !dealerSlug) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const result = await previewRedemptionCode({ code, dealerSlug, cartItems: cartItems ?? [] });
  return NextResponse.json(result);
}
