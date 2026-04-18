import { NextRequest, NextResponse } from "next/server";
import { generateBotReply, resetConvo, setPersonality } from "@/lib/bot";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, sessionId: sid } = body;
  const sessionId = sid || `pub_${Date.now()}`;

  // Validate session ID starts with pub_ (public sessions only)
  if (!sessionId.startsWith("pub_")) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  if (action === "reset") {
    await resetConvo(sessionId);
    return NextResponse.json({ status: "reset" });
  }

  if (action === "personality") {
    await setPersonality(sessionId, body.personality);
    return NextResponse.json({ status: "ok" });
  }

  const { message } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const { reply, debug } = await generateBotReply(sessionId, "Cliente", message.trim());

  // Only return reply to public users (no debug info)
  return NextResponse.json({ reply });
}
