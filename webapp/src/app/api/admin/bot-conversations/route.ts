import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

/**
 * Admin-only viewer for the platform-wide bot chat history. Returns a paginated
 * list of conversations with their messages already parsed from the JSON-string
 * column, so the UI can render them as a chat thread without re-parsing.
 *
 * Query params:
 *   - limit  (default 50, max 200)
 *   - offset (default 0)
 *   - channel (optional: "web" | "whatsapp" | "admin") — filter by id prefix
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const channel = searchParams.get("channel");

  // Map channel filter to id prefix used by the bot session generator.
  // - web widget   → "pub_<timestamp>"
  // - whatsapp     → "wa_<phone>"
  // - admin tests  → "admi..." (admin playground at /admin/bot)
  const channelFilter = channel === "web" ? { startsWith: "pub_" }
    : channel === "whatsapp" ? { startsWith: "wa_" }
    : channel === "admin" ? { startsWith: "admi" }
    : undefined;

  // Use $queryRawUnsafe because `BotConversation` isn't in our Prisma schema yet
  // (it was added via raw SQL when the bot was built — we read it the same way).
  const where = channelFilter ? `WHERE id LIKE '${channelFilter.startsWith}%'` : "";
  const rowsRaw = await prisma.$queryRawUnsafe<{
    id: string;
    messages: string;
    selectedSlug: string | null;
    personality: string | null;
    updatedAt: Date;
  }[]>(
    `SELECT id, messages, "selectedSlug", personality, "updatedAt"
     FROM "BotConversation"
     ${where}
     ORDER BY "updatedAt" DESC
     LIMIT ${limit} OFFSET ${offset}`
  );
  const totalRow = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "BotConversation" ${where}`
  );
  const total = Number(totalRow[0]?.count ?? 0);

  const convos = rowsRaw.map((r) => {
    let messages: { role: "user" | "assistant"; content: string }[] = [];
    try { messages = JSON.parse(r.messages); } catch {}
    return {
      id: r.id,
      channel: r.id.startsWith("pub_") ? "web" : r.id.startsWith("wa_") ? "whatsapp" : "admin",
      selectedSlug: r.selectedSlug,
      personality: r.personality,
      updatedAt: r.updatedAt.toISOString(),
      msgCount: messages.length,
      messages,
    };
  });

  return NextResponse.json({ convos, total, limit, offset });
}
