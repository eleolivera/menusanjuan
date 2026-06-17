// Customer cross-resta dashboard data. Lists every dealer where this customer
// has accumulated punches OR where this customer has an active redemption.
// Requires the menusj_customer_session cookie.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rewardsFlag } from "@/lib/rewards";
import { getCustomerFromSession } from "@/lib/customer-auth";
import { RedemptionStatus } from "@/generated/prisma";

export async function GET() {
  if (!rewardsFlag()) return new NextResponse("Not found", { status: 404 });

  const customer = await getCustomerFromSession();
  if (!customer) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const progressRows = await prisma.rewardProgress.findMany({
    where: { customerId: customer.id },
    include: {
      program: {
        include: {
          dealer: { select: { slug: true, name: true, logoUrl: true } },
          rewardItem: { select: { name: true } },
        },
      },
    },
  });

  const activeRedemptions = await prisma.redemption.findMany({
    where: { customerId: customer.id, status: RedemptionStatus.READY },
    select: { id: true, programId: true, expiresAt: true },
  });
  const activeByProgram = new Map(activeRedemptions.map((r) => [r.programId, r]));

  const data = progressRows
    .filter((p) => p.program.enabled && p.program.dealer)
    .map((p) => ({
      dealer: {
        slug: p.program.dealer.slug,
        name: p.program.dealer.name,
        logoUrl: p.program.dealer.logoUrl,
      },
      programName: p.program.name,
      rewardItemName: p.program.rewardItem.name,
      punches: p.punches,
      punchesNeeded: p.program.punchesNeeded,
      eligible: p.punches >= p.program.punchesNeeded,
      activeRedemption: activeByProgram.get(p.program.id) || null,
    }));

  return NextResponse.json({
    customer: {
      displayName: customer.displayName,
      googleEmail: customer.googleEmail,
    },
    rewards: data,
  });
}
