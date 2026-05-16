import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { buildTestTicket } from "@/lib/escpos-ticket";

/**
 * POST — enqueue a test ticket on this agent. Owner clicks "Probar" in the
 * dashboard. The agent picks it up on its next poll and prints it.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const agent = await prisma.printAgent.findUnique({ where: { id } });
  if (!agent || agent.dealerId !== dealer.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!agent.pairedAt) {
    return NextResponse.json(
      { error: "El agente no esta emparejado todavia" },
      { status: 409 },
    );
  }

  const payload = buildTestTicket(dealer.name);
  const job = await prisma.printJob.create({
    data: { agentId: id, kind: "TEST", payload },
  });

  return NextResponse.json({ jobId: job.id, status: "PENDING" });
}
