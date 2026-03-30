---
name: next-patterns
description: >
  Next.js and Prisma coding patterns for MenuSanJuan. Load when implementing
  pages, API routes, data fetching, or database queries.
---

# Next.js + Prisma Patterns — MenuSJ

## Database (Prisma 7 with pg adapter)

```typescript
// lib/prisma.ts — singleton, already configured
import { prisma } from "@/lib/prisma";

// Query example
const dealers = await prisma.dealer.findMany({
  where: { isActive: true },
  include: { categories: { include: { items: true } } },
  orderBy: [{ rating: "desc" }, { name: "asc" }],
});

// Update
await prisma.dealer.update({
  where: { id },
  data: { isActive: true, rating: 4.7 },
});
```

## API route pattern

```typescript
// webapp/src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/restaurante-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const data = await prisma.dealer.findUnique({
      where: { slug: session.activeSlug },
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("API error:", err.message);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
```

## Auth patterns

```typescript
// Restaurant user session
import { getSession } from "@/lib/restaurante-auth";
const session = await getSession();
// Returns: { userId, activeSlug, user, restaurants, activeRestaurant }

// Admin session
import { getAdminSession } from "@/lib/admin-auth";
const admin = await getAdminSession();
// Returns admin user or null

// Sessions are mutually exclusive (creating one clears the other)
```

## Image upload

```typescript
// Via API (from client)
const formData = new FormData();
formData.append("file", file);
formData.append("type", "menu-item"); // or "logo", "cover"
const res = await fetch("/api/upload", { method: "POST", body: formData });
const { url } = await res.json();
// url = "https://images.menusanjuan.com/slug/menu-item-123.jpg"

// Via URL download (from server/script)
import { resolveUrlToR2 } from "@/lib/r2";
const url = await resolveUrlToR2(sourceUrl, "slug/cover.jpg");
```

## Page patterns

```typescript
// Server component (data fetching)
// webapp/src/app/[store]/page.tsx
export default async function StorePage({ params }) {
  const { store } = await params;
  const restaurant = await getRestaurantBySlug(store);
  if (!restaurant) notFound();
  return <StoreMenu restaurant={restaurant} />;
}

// Client component (interactivity)
// webapp/src/components/SomeComponent.tsx
"use client";
import { useState, useEffect } from "react";
export function SomeComponent() { ... }
```

## Dynamic route params (Next.js 16)

```typescript
// Params are now a Promise in Next.js 16+
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

## Price formatting

```typescript
// Always use es-AR locale
<span>${price.toLocaleString("es-AR")}</span>
// Renders: $14.900
```

## Phone input

```typescript
import { PhoneInput } from "@/components/PhoneInput";
<PhoneInput
  value={phone}
  onChange={setPhone}
  label="WhatsApp del Restaurante"
  required
  darkMode  // for dashboard/admin pages
/>
```
