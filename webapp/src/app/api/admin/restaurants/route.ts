import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// GET — list all restaurants with ownership status
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      account: { include: { user: { select: { email: true, name: true } } } },
      categories: { select: { id: true } },
      _count: { select: { orders: true, claimRequests: true } },
    },
  });

  const restaurants = dealers.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    cuisineType: d.cuisineType,
    phone: d.phone,
    address: d.address,
    isActive: d.isActive,
    isVerified: d.isVerified,
    claimedAt: d.claimedAt,
    sourceProfileId: d.sourceProfileId,
    sourceSite: d.sourceSite,
    ownerEmail: d.account.user.email,
    isPlaceholder: d.account.user.email.endsWith("@menusanjuan.com"),
    categoryCount: d.categories.length,
    orderCount: d._count.orders,
    claimRequestCount: d._count.claimRequests,
    createdAt: d.createdAt,
  }));

  return NextResponse.json(restaurants);
}

// POST — create a new restaurant (admin)
export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone, address, cuisineType, description, logoUrl, coverUrl, slug: rawSlug } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "Nombre y teléfono son obligatorios" }, { status: 400 });
  }

  // Generate slug
  let slug = (rawSlug || name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  const existing = await prisma.dealer.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  // Create placeholder user + account + dealer
  const { hashPassword } = await import("@/lib/restaurante-auth");
  const placeholderEmail = `${slug}@menusanjuan.com`;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: placeholderEmail,
        password: hashPassword("menusj2024"),
        name,
        phone,
      },
    });

    const account = await tx.account.create({
      data: { userId: user.id, type: "dealer" },
    });

    const dealer = await tx.dealer.create({
      data: {
        accountId: account.id,
        name,
        slug,
        phone,
        address: address || null,
        cuisineType: cuisineType || "General",
        description: description || null,
        logoUrl: logoUrl || null,
        coverUrl: coverUrl || null,
        isActive: false, // Starts inactive — admin reviews and activates
      },
    });

    return dealer;
  });

  return NextResponse.json(result, { status: 201 });
}
