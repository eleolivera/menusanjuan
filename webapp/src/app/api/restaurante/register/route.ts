import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRestauranteSession } from "@/lib/restaurante-auth";

function hashPassword(password: string): string {
  const crypto = require("crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

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

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, restaurantName, phone, address, cuisineType, description, logoUrl, coverUrl } = body;

    if (!email || !password || !restaurantName || !phone) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
    }

    // Generate slug and check uniqueness
    let slug = generateSlug(restaurantName);
    const existingDealer = await prisma.dealer.findUnique({ where: { slug } });
    if (existingDealer) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const verificationCode = generateVerificationCode();
    const hashedPassword = hashPassword(password);

    // Create user + account + dealer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: restaurantName,
          phone,
        },
      });

      const account = await tx.account.create({
        data: {
          userId: user.id,
          type: "dealer",
        },
      });

      const dealer = await tx.dealer.create({
        data: {
          accountId: account.id,
          name: restaurantName,
          slug,
          phone,
          address: address || null,
          cuisineType: cuisineType || "General",
          description: description || null,
          logoUrl: logoUrl || null,
          coverUrl: coverUrl || null,
        },
      });

      return { user, dealer };
    });

    // Create session
    await createRestauranteSession(result.dealer.slug);

    // TODO: Send verification email with code
    // For now, return the code so the frontend can show it
    console.log(`Verification code for ${email}: ${verificationCode}`);

    return NextResponse.json({
      success: true,
      slug: result.dealer.slug,
      verificationCode, // Remove this in production once email is set up
    }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Error al registrar. Intentá de nuevo." }, { status: 500 });
  }
}
