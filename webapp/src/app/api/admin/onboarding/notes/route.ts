import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// POST — add a note to a card
export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { cardId, text, imageUrl } = await request.json();
  if (!cardId || (!text && !imageUrl)) {
    return NextResponse.json({ error: "cardId y texto o imagen requeridos" }, { status: 400 });
  }

  const note = await prisma.onboardingNote.create({
    data: { cardId, text, imageUrl },
  });

  return NextResponse.json(note);
}

// DELETE — remove a note
export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) {
    return NextResponse.json({ error: "noteId requerido" }, { status: 400 });
  }

  await prisma.onboardingNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
