import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrintAgentFromRequest } from "@/lib/print-agent-auth";

/**
 * POST /api/print-agent/ack
 * Bearer: <apiKey>
 * Body: { jobId: string, status: "DELIVERED" | "FAILED", error?: string }
 *
 * Agent confirms it received and tried to print a job. We mark DELIVERED
 * (success) or FAILED (with error message for the dashboard support view).
 */
export async function POST(req: NextRequest) {
  const agent = await getPrintAgentFromRequest();
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { jobId, status, error } = body as {
    jobId?: string;
    status?: "DELIVERED" | "FAILED";
    error?: string;
  };

  if (!jobId || (status !== "DELIVERED" && status !== "FAILED")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const job = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!job || job.agentId !== agent.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await prisma.printJob.update({
    where: { id: jobId },
    data: {
      status,
      errorMsg: status === "FAILED" ? (error || "Unknown error") : null,
      deliveredAt: status === "DELIVERED" ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
