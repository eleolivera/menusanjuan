// POST + DELETE /api/admin/impersonate
//
// POST { dealerSlug }: verify admin session, look up the dealer's owner
// userId, sign and set the menusj_admin_as cookie so the admin can visit
// /restaurante/* and see the owner's view. The impersonation cookie is
// HMAC-signed — a client can't craft one for a different slug.
//
// DELETE: clear the impersonation cookie. Admin cookie stays intact.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAdminSession,
  setImpersonationCookie,
  clearImpersonationCookie,
} from "@/lib/admin-auth";

// Post-impersonation redirect target. The owner UI lives on the www host,
// while admin lives on admin.menusanjuan.com — cookies are apex-scoped so
// they travel across. Absolute URL because we're crossing subdomains.
const OWNER_REDIRECT = "https://www.menusanjuan.com/restaurante";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { dealerSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const dealerSlug = body.dealerSlug?.trim();
  if (!dealerSlug) return NextResponse.json({ error: "missing_dealerSlug" }, { status: 400 });

  const dealer = await prisma.dealer.findUnique({
    where: { slug: dealerSlug },
    select: {
      slug: true,
      name: true,
      account: { select: { userId: true } },
    },
  });
  if (!dealer) return NextResponse.json({ error: "dealer_not_found" }, { status: 404 });
  if (!dealer.account?.userId) {
    return NextResponse.json({ error: "dealer_has_no_owner" }, { status: 400 });
  }

  await setImpersonationCookie({
    adminUserId: admin.userId,
    ownerUserId: dealer.account.userId,
    dealerSlug: dealer.slug,
  });

  return NextResponse.json({
    ok: true,
    dealerName: dealer.name,
    dealerSlug: dealer.slug,
    redirectTo: OWNER_REDIRECT,
  });
}

export async function DELETE() {
  // No admin gate here — exiting impersonation should always succeed even if
  // the admin session has already died in the meantime. Just clears the cookie.
  await clearImpersonationCookie();
  return NextResponse.json({
    ok: true,
    redirectTo: "https://admin.menusanjuan.com/admin",
  });
}
