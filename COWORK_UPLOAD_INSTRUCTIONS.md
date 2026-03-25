# MenuSanJuan — Instrucciones para Subir Restaurantes

## Qué es esto

Vas a leer menús de restaurantes (de PDF, foto, documento, o cualquier fuente) y subirlos directamente a la base de datos de MenuSanJuan. Cada restaurante tiene un perfil + menú organizado por categorías con items y precios.

**IMPORTANTE**: Los restaurantes se crean como **inactivos y sin dueño**. Después de subirlos, el admin los revisa, ajusta, y activa. Nada se publica automáticamente.

---

## Setup

El proyecto está en: `/Users/eleolivera/Desktop/manu-san-juan/webapp`

La conexión a la base de datos está en `/Users/eleolivera/Desktop/manu-san-juan/webapp/.env`:
```
DATABASE_URL="postgresql://postgres.hzokeqvgmbhfrnrkxxtd:5PpeIcCB8M9QExoh@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

Para ejecutar scripts contra la DB, usá `npx tsx` desde el directorio `webapp/`:

```bash
cd /Users/eleolivera/Desktop/manu-san-juan/webapp
npx tsx src/scripts/TU_SCRIPT.ts
```

---

## Cómo subir un restaurante

Creá un script TypeScript en `webapp/src/scripts/` que haga todo. Acá está la plantilla:

```typescript
// webapp/src/scripts/upload-restaurant.ts
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import crypto from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

function makeSlug(name: string): string {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-").trim();
}

async function main() {
  // ============================================
  // DATOS DEL RESTAURANTE — COMPLETAR ACÁ
  // ============================================
  const RESTAURANT = {
    name: "NOMBRE DEL RESTAURANTE",
    phone: "TELEFONO O 0000000000",
    address: "DIRECCION O null",
    cuisineType: "TIPO DE COCINA",  // Ver lista abajo
    description: "DESCRIPCION CORTA 1-2 ORACIONES",
  };

  const MENU = [
    {
      category: "NOMBRE CATEGORIA",
      emoji: "EMOJI",
      items: [
        { name: "ITEM 1", price: 5500, description: "DESCRIPCION OPCIONAL" },
        { name: "ITEM 2", price: 3200 },
        // ... más items
      ],
    },
    // ... más categorías
  ];
  // ============================================

  const slug = makeSlug(RESTAURANT.name);
  const existing = await prisma.dealer.findUnique({ where: { slug } });
  if (existing) {
    console.log(`⚠️  ${RESTAURANT.name} ya existe (/${slug}). Abortando.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`🍽️  Subiendo: ${RESTAURANT.name}`);

  // Crear placeholder user + account + dealer
  const placeholderEmail = `${slug}@menusanjuan.com`;

  const user = await prisma.user.create({
    data: {
      email: placeholderEmail,
      password: hashPassword("menusj2024"),
      name: RESTAURANT.name,
      phone: RESTAURANT.phone,
    },
  });

  const account = await prisma.account.create({
    data: { userId: user.id, type: "dealer" },
  });

  const dealer = await prisma.dealer.create({
    data: {
      accountId: account.id,
      name: RESTAURANT.name,
      slug,
      phone: RESTAURANT.phone,
      address: RESTAURANT.address || null,
      cuisineType: RESTAURANT.cuisineType || "General",
      description: RESTAURANT.description || null,
      isActive: false,  // INACTIVO hasta que admin active
    },
  });

  console.log(`   ✅ Restaurante creado: /${slug} (id: ${dealer.id})`);

  // Crear categorías + items
  let totalItems = 0;
  for (let ci = 0; ci < MENU.length; ci++) {
    const cat = MENU[ci];
    const category = await prisma.menuCategory.create({
      data: {
        dealerId: dealer.id,
        name: cat.category,
        emoji: cat.emoji || null,
        sortOrder: ci,
      },
    });

    for (let ii = 0; ii < cat.items.length; ii++) {
      const item = cat.items[ii];
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: item.name,
          description: (item as any).description || null,
          price: item.price,
          badge: (item as any).badge || null,
          available: true,
          sortOrder: ii,
        },
      });
      totalItems++;
    }

    console.log(`   📋 ${cat.emoji || "📋"} ${cat.category}: ${cat.items.length} items`);
  }

  console.log(`\n✅ Listo! ${MENU.length} categorías, ${totalItems} items`);
  console.log(`   Admin: https://menusanjuan.com/admin?login → click en "${RESTAURANT.name}"`);
  console.log(`   Página (inactiva): https://menusanjuan.com/${slug}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

---

## Cómo usarlo

1. Leé el menú (PDF, foto, etc.)
2. Copiá la plantilla de arriba
3. Completá `RESTAURANT` y `MENU` con los datos extraídos
4. Guardá como `webapp/src/scripts/upload-NOMBRE.ts`
5. Ejecutá:

```bash
cd /Users/eleolivera/Desktop/manu-san-juan/webapp
npx tsx src/scripts/upload-NOMBRE.ts
```

---

## Tipos de cocina válidos

Usá exactamente uno de estos:
- Comida Rápida
- Parrilla
- Pizzería
- Cafetería
- Pastas
- Sushi
- Heladería
- Empanadas
- Comida Árabe
- Comida Mexicana
- Comida China
- Vegetariano
- Postres
- Rotisería
- General (si no encaja en ninguno)

---

## Emojis comunes para categorías

| Categoría | Emoji |
|-----------|-------|
| Hamburguesas | 🍔 |
| Lomitos / Sandwiches | 🥖 |
| Pizzas | 🍕 |
| Empanadas | 🥟 |
| Pastas | 🍝 |
| Parrilla / Carnes | 🥩 |
| Pollo | 🍗 |
| Milanesas | 🍗 |
| Ensaladas | 🥗 |
| Guarniciones / Papas | 🍟 |
| Postres | 🍰 |
| Bebidas | 🥤 |
| Bebidas Alcohólicas | 🍷 |
| Cafetería | ☕ |
| Helados | 🍦 |
| Combos / Promos | ⭐ |
| Sushi / Rolls | 🍣 |
| Desayunos / Meriendas | 🥐 |
| Minutas | 🍽️ |
| Platos Calientes | 🍲 |
| Pescados | 🐟 |
| Entradas | 🥗 |

---

## Reglas

1. **Precio**: Número sin `$`. Si ves "$5.500" o "$5500" → `5500`
2. **Teléfono**: Si no aparece, usá `"0000000000"`
3. **Categorías**: Si el menú no tiene secciones claras, crealas vos
4. **Descripción de items**: Solo si el menú la tiene. No inventes.
5. **Badge**: Solo si el menú marca algo como destacado → `"Popular"`, `"Nuevo"`, o `"Especial"`
6. **Items sin precio**: `price: 0` y description `"Consultar precio"`
7. **Se crea INACTIVO** — el admin lo revisa y activa después
8. **No se suben imágenes** — solo datos. Las imágenes se agregan después desde el admin.

---

## Qué pasa después

1. Restaurante creado como **INACTIVO** (no aparece en el sitio)
2. Admin va a `menusanjuan.com/admin?login` (email: admin@menusanjuan.com / pass: admin-menusj-2024)
3. Click en el restaurante → revisa nombre, menú, precios
4. Ajusta lo que haga falta
5. Toggle **"Activo"** para publicarlo
6. Opcionalmente asigna un dueño por email
