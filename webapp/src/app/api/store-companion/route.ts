import { NextRequest, NextResponse } from "next/server";
import { generateCompanionReply } from "@/lib/store-companion";
import type { Personality } from "@/lib/bot-shared";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, message, history, cart, personality } = body;

  if (!slug || !message?.trim()) {
    return NextResponse.json({ error: "Missing slug or message" }, { status: 400 });
  }

  const { reply, actions } = await generateCompanionReply(
    slug,
    message.trim(),
    history || [],
    cart || [],
    (personality as Personality) || "bardero"
  );

  return NextResponse.json({ reply, actions });
}
