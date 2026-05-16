import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrintAgentFromRequest } from "@/lib/print-agent-auth";

/**
 * GET /api/print-agent/poll
 * Bearer: <apiKey>
 *
 * Returns the next PENDING job for this agent. Long-polls up to ~20s waiting
 * for a new job to appear, so the agent gets near-instant push without us
 * needing a WebSocket. Returns 204 if nothing's there after the wait window.
 *
 * Vercel function timeout is 25s on Hobby/Pro, so we cap our wait at 20s with
 * a 5s buffer for response time.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const MAX_WAIT_MS = 20_000;
const POLL_INTERVAL_MS = 1_500;

export async function GET() {
  const agent = await getPrintAgentFromRequest();
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Touch lastSeenAt + status. Agent's poll itself counts as a heartbeat.
  await prisma.printAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: new Date(), status: "ONLINE" },
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const job = await prisma.printJob.findFirst({
      where: { agentId: agent.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    if (job) {
      // Mark as DISPATCHED-ish by bumping attempts. We don't set status here —
      // the ack route decides DELIVERED/FAILED. If the agent crashes mid-print
      // the job stays PENDING with attempts++ and will be retried.
      await prisma.printJob.update({
        where: { id: job.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({
        jobId: job.id,
        kind: job.kind,
        orderId: job.orderId,
        // Encode bytes as base64 — JSON-safe transport
        payloadBase64: Buffer.from(job.payload).toString("base64"),
      });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // No job available within the wait window. Agent will reconnect immediately.
  return new Response(null, { status: 204 });
}
