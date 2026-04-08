import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSession, hashPassword } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    // Admins cannot register restaurants — they already have the admin panel.
    if (await getAdminSession()) {
      return NextResponse.json(
        { error: "Los admins no pueden registrar restaurantes. Cerrá sesión de admin primero." },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { email, password, restaurantName, phone, address, latitude, longitude, cuisineType, description, logoUrl, coverUrl } = body;

    if (!restaurantName || !phone) {
      return NextResponse.json({ error: "Nombre y teléfono son obligatorios" }, { status: 400 });
    }

    // Generate slug
    let slug = generateSlug(restaurantName);
    const existingDealer = await prisma.dealer.findUnique({ where: { slug } });
    if (existingDealer) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Check if already logged in — add restaurant to existing account
    const session = await getSession();

    if (session) {
      // Existing user — just create a new Account + Dealer
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: { userId: session.userId, type: "dealer" },
        });

        const dealer = await tx.dealer.create({
          data: {
            accountId: account.id,
            name: restaurantName,
            slug,
            phone,
            address: address || null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            cuisineType: cuisineType || "General",
            description: description || null,
            logoUrl: logoUrl || null,
            coverUrl: coverUrl || null,
          },
        });

        // Update role to BUSINESS if not already
        await tx.user.update({
          where: { id: session.userId },
          data: { role: "BUSINESS" },
        });

        return dealer;
      });

      // Switch active to the new restaurant
      await createSession(session.userId, result.slug);

      return NextResponse.json({ success: true, slug: result.slug }, { status: 201 });
    }

    // New user — need email + password
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios para crear una cuenta" }, { status: 400 });
    }

    // Check if email is taken
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Este email ya está registrado. Iniciá sesión primero." }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: restaurantName,
          phone,
          role: "BUSINESS",
        },
      });

      const account = await tx.account.create({
        data: { userId: user.id, type: "dealer" },
      });

      const dealer = await tx.dealer.create({
        data: {
          accountId: account.id,
          name: restaurantName,
          slug,
          phone,
          address: address || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          cuisineType: cuisineType || "General",
          description: description || null,
          logoUrl: logoUrl || null,
          coverUrl: coverUrl || null,
        },
      });

      // Check for pending restaurant assignments
      const pendingRestaurants = await tx.dealer.findMany({
        where: { pendingOwnerEmail: email },
        include: { account: true },
      });

      for (const pending of pendingRestaurants) {
        // Re-link the restaurant's account to this new user
        await tx.account.update({
          where: { id: pending.account.id },
          data: { userId: user.id },
        });
        await tx.dealer.update({
          where: { id: pending.id },
          data: { pendingOwnerEmail: null, isVerified: true, claimedAt: new Date() },
        });
        // Clean up old placeholder user
        const oldAccounts = await tx.account.count({ where: { userId: pending.account.userId } });
        if (oldAccounts === 0) {
          const oldUser = await tx.user.findUnique({ where: { id: pending.account.userId } });
          if (oldUser?.email.endsWith("@menusanjuan.com")) {
            await tx.user.delete({ where: { id: pending.account.userId } });
          }
        }
      }

      return { user, dealer, pendingLinked: pendingRestaurants.length };
    });

    await createSession(result.user.id, result.dealer.slug);

    return NextResponse.json({ success: true, slug: result.dealer.slug, pendingLinked: result.pendingLinked }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Error al registrar. Intentá de nuevo." }, { status: 500 });
  }
}
