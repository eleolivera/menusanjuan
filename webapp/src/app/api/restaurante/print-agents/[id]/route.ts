import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

/**
 * DELETE — revoke a paired agent. The next time it tries to poll, it'll
 * 401 and shut down on its own.
 */
export async function DELETE(
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

  await prisma.printAgent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

/**
 * PATCH — rename an agent (e.g. "PC Caja" → "PC Cocina")
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "Nombre vacio" }, { status: 400 });

  const agent = await prisma.printAgent.findUnique({ where: { id } });
  if (!agent || agent.dealerId !== dealer.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.printAgent.update({ where: { id }, data: { name } });
  return NextResponse.json({ success: true });
}
