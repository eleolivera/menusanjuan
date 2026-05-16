import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrintAgentFromRequest } from "@/lib/print-agent-auth";

/**
 * POST /api/print-agent/heartbeat
 * Bearer: <apiKey>
 * Body: { version?: string, hostInfo?: string }
 *
 * Called by the agent every ~60s to keep its lastSeenAt fresh. The poll
 * endpoint also touches lastSeenAt, so heartbeat is a backup for cases
 * where the agent isn't actively long-polling (e.g. brief network blip).
 */
export async function POST(req: NextRequest) {
  const agent = await getPrintAgentFromRequest();
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const version = typeof body.version === "string" ? body.version : undefined;
  const hostInfo = typeof body.hostInfo === "string" ? body.hostInfo : undefined;

  await prisma.printAgent.update({
    where: { id: agent.id },
    data: {
      lastSeenAt: new Date(),
      status: "ONLINE",
      ...(version && { version }),
      ...(hostInfo && { hostInfo }),
    },
  });
  return NextResponse.json({ ok: true });
}
