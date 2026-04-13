import { NextRequest, NextResponse } from "next/server";
import { generateBotReply, resetConvo } from "@/lib/bot";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Verify admin session
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

  const { message, sessionId, action } = await req.json();

  // Reset action
  if (action === "reset") {
    resetConvo(sessionId || "admin_test");
    return NextResponse.json({ status: "reset" });
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const sid = sessionId || "admin_test";
  const { reply, debug } = await generateBotReply(sid, "Admin", message.trim());

  return NextResponse.json({ reply, debug });
}
