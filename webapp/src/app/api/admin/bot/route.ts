import { NextRequest, NextResponse } from "next/server";
import { generateBotReply, resetConvo, getConvo } from "@/lib/bot";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get("menusj_admin")?.value;
  if (!token) return false;
  const session = await prisma.session.findFirst({
    where: { token, type: "ADMIN", expiresAt: { gt: new Date() } },
  });
  return !!session;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, sessionId: sid } = body;
  const sessionId = sid || "admin_test";

  // Reset
  if (action === "reset") {
    resetConvo(sessionId);
    return NextResponse.json({ status: "reset" });
  }

  // Feedback
  if (action === "feedback") {
    const { rating, note, userMessage, botReply, debug } = body;
    const convo = await getConvo(sessionId);

    await prisma.botFeedback.create({
      data: {
        sessionId,
        rating,
        note: note || null,
        userMessage,
        botReply,
        selectedSlug: debug?.selectedSlug || null,
        conversation: JSON.stringify(convo.messages),
        inputTokens: debug?.inputTokens || 0,
        outputTokens: debug?.outputTokens || 0,
        costCents: debug?.costCents || 0,
        responseMs: debug?.responseMs || 0,
      },
    });

    return NextResponse.json({ status: "saved" });
  }

  // Chat
  const { message } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const { reply, debug } = await generateBotReply(sessionId, "Admin", message.trim());
  return NextResponse.json({ reply, debug });
}

// GET — list feedback
export async function GET() {
  const jar = await cookies();
  const token = jar.get("menusj_admin")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findFirst({
    where: { token, type: "ADMIN", expiresAt: { gt: new Date() } },
  });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feedback = await prisma.botFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(feedback);
}
