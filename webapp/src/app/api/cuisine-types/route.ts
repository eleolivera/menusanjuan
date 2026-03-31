import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — public list of cuisine types (for home page pills, registration, profile)
export async function GET() {
  try {
    const types = await prisma.cuisineType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, emoji: true },
    });
    return NextResponse.json(types);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
