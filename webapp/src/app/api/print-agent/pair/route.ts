import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/print-agent-auth";

/**
 * POST /api/print-agent/pair
 * Body: { code: string, hostInfo?: string, version?: string }
 *
 * The desktop agent calls this on first run with the 6-char code the owner
 * generated in the dashboard. We exchange the code for a long-term API key,
 * mark the agent as paired, and clear the code so it can't be reused.
 *
 * No auth required (yet) — the code itself IS the auth. Single-use,
 * short-lived (~30 min).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = (body.code as string | undefined)?.trim().toUpperCase();
  const hostInfo = (body.hostInfo as string | undefined)?.slice(0, 200);
  const version = (body.version as string | undefined)?.slice(0, 50);

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const agent = await prisma.printAgent.findUnique({ where: { pairingCode: code } });
  if (!agent) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }
  if (agent.pairedAt) {
    return NextResponse.json({ error: "Código ya fue usado" }, { status: 409 });
  }
  if (!agent.pairingCodeExpiresAt || agent.pairingCodeExpiresAt < new Date()) {
    return NextResponse.json({ error: "Código expirado" }, { status: 410 });
  }

  // Generate the long-term API key, hash and store it, return raw to agent
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);

  await prisma.printAgent.update({
    where: { id: agent.id },
    data: {
      apiKeyHash,
      apiKeyHint: apiKey.slice(-4),
      pairingCode: null,
      pairingCodeExpiresAt: null,
      pairedAt: new Date(),
      lastSeenAt: new Date(),
      status: "ONLINE",
      hostInfo,
      version,
    },
  });

  // Load the dealer name so the agent can show it in its tray tooltip
  const dealer = await prisma.dealer.findUnique({
    where: { id: agent.dealerId },
    select: { name: true, slug: true },
  });

  return NextResponse.json({
    agentId: agent.id,
    agentName: agent.name,
    apiKey,                                // store this, use as Bearer forever
    dealerName: dealer?.name || "",
    dealerSlug: dealer?.slug || "",
  });
}
