import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { generatePairingCode } from "@/lib/print-agent-auth";

/**
 * GET — list the resta's paired print agents (status + lastSeenAt).
 * No raw API keys ever leave the server after creation.
 */
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = Date.now();
  const agents = await prisma.printAgent.findMany({
    where: { dealerId: dealer.id },
    orderBy: { createdAt: "desc" },
  });

  // Derive a fresh status from lastSeenAt — anything older than 3 min = OFFLINE.
  // We don't trust the persisted `status` field for display; the heartbeat keeps
  // lastSeenAt fresh while the agent is alive.
  const STALE_MS = 3 * 60 * 1000;
  const out = agents.map((a) => ({
    id: a.id,
    name: a.name,
    apiKeyHint: a.apiKeyHint,
    status: a.lastSeenAt && now - a.lastSeenAt.getTime() < STALE_MS ? "ONLINE" : "OFFLINE",
    lastSeenAt: a.lastSeenAt,
    version: a.version,
    hostInfo: a.hostInfo,
    pairedAt: a.pairedAt,
    // Pairing fields — only shown while still valid (not yet paired AND not expired)
    pairingCode:
      !a.pairedAt && a.pairingCodeExpiresAt && a.pairingCodeExpiresAt > new Date()
        ? a.pairingCode
        : null,
    pairingCodeExpiresAt: !a.pairedAt ? a.pairingCodeExpiresAt : null,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({ agents: out });
}

/**
 * POST — create a new pending agent. Returns only the pairing code.
 *
 * The agent enters this code in its first-run UI, then calls /api/print-agent/pair
 * which generates the long-term API key server-side and returns it to the agent.
 * The owner never has to copy a 32-char key.
 */
export async function POST(req: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim() || "Impresora";

  // Retry on the (extremely unlikely) chance the pairing code collides.
  let pairingCode = "";
  let attempts = 0;
  while (attempts++ < 5) {
    const candidate = generatePairingCode();
    const exists = await prisma.printAgent.findUnique({ where: { pairingCode: candidate } });
    if (!exists) { pairingCode = candidate; break; }
  }
  if (!pairingCode) {
    return NextResponse.json({ error: "No pude generar codigo" }, { status: 500 });
  }

  const agent = await prisma.printAgent.create({
    data: {
      dealerId: dealer.id,
      name,
      pairingCode,
      pairingCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min window
    },
  });

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    pairingCode,
    pairingCodeExpiresAt: agent.pairingCodeExpiresAt,
    downloadUrl: "/download/MenuSanJuanPrint.exe",
  });
}
