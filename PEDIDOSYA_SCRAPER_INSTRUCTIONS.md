# PedidosYa → MenuSanJuan — Instrucciones de Importación

## Qué es esto

Instrucciones para extraer datos de restaurantes de PedidosYa (San Juan) e importarlos a la base de datos de MenuSanJuan. Los restaurantes se crean inactivos — el admin los revisa y activa después.

---

## Paso 1: Obtener la lista de restaurantes

### Desde el browser:
1. Abrí **pedidosya.com.ar** → navegá a restaurantes de San Juan
2. Abrí DevTools (Cmd+Option+I) → pestaña **Network** → filtrar por **Fetch/XHR**
3. Buscá la request a `/v1/food-home/v1/vendors`
4. Click derecho en la respuesta → **Copy response**
5. Guardá como `/Users/eleolivera/Downloads/pedidosya-data/vendors.json`

### Si tenés control del browser (extensión):
Navegá a la página de restaurantes de San Juan en PedidosYa y capturá la respuesta de la API `/v1/food-home/v1/vendors`. Puede haber paginación — scrolleá para cargar más y capturá todas las respuestas.

### Estructura del vendors JSON:
```json
{
  "data": [
    {
      "id": 550595,
      "name": "Agape Comidas",
      "address": {
        "street": "Sargento Cabral oeste 1364",
        "latitude": -31.51658,
        "longitude": -68.58411
      },
      "logo_url": "https://pedidosya.dhmedia.io/image/pedidosya/restaurants/xxx.jpg",
      "header_url": "https://pedidosya.dhmedia.io/image/pedidosya/profile-headers/xxx.jpg",
      "link": "agape-comidas-xxx",
      "menu_id": 823801
    }
  ]
}
```

---

## Paso 2: Obtener el menú de cada restaurante

Para cada restaurante del vendors list, necesitamos su menú.

### URL del menú:
```
https://www.pedidosya.com.ar/v2/niles/partners/{id}/menus?occasion=DELIVERY
```

Donde `{id}` es el campo `id` del vendor (ej: `550595`).

### Desde el browser:
1. Para cada restaurante, abrí su página en PedidosYa
2. En Network tab, buscá la request a `/v2/niles/partners/{id}/menus`
3. Copiá la respuesta
4. Guardá como `/Users/eleolivera/Downloads/pedidosya-data/menu-{id}.json`

### Si tenés control del browser:
Para cada vendor ID del paso 1, navegá a `pedidosya.com.ar/restaurantes/san-juan/{link}-menu` y capturá la respuesta del endpoint `/v2/niles/partners/{id}/menus?occasion=DELIVERY`.

### Estructura del menu JSON:
```json
{
  "sections": [
    {
      "name": "Milanesas",
      "products": [
        {
          "name": "Milanesa napolitana",
          "description": "Con salsa de tomate y queso con 1 guarnición.",
          "price": {
            "finalPrice": 17500.00
          },
          "images": {
            "urls": ["b5fdc630-xxxx.jpeg"]
          },
          "tags": {
            "isMostOrdered": true
          },
          "enabled": true
        }
      ]
    }
  ]
}
```

---

## Paso 3: Importar a MenuSanJuan

Una vez que tengas los JSONs guardados, usá este script para importar cada restaurante.

### Proyecto: `/Users/eleolivera/Desktop/manu-san-juan/webapp`
### Env: `/Users/eleolivera/Desktop/manu-san-juan/webapp/.env`
### DB: PostgreSQL (Supabase) via Prisma

### Script de importación:

Para cada restaurante, creá y ejecutá un script como este:

```typescript
// webapp/src/scripts/import-pedidosya-{slug}.ts
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

// ======== DATOS DE PEDIDOSYA — COMPLETAR ========

const VENDOR = {
  // Del vendors.json:
  id: 0,                    // PedidosYa ID
  name: "",                 // Nombre del restaurante
  street: "",               // Dirección
  latitude: 0,
  longitude: 0,
  logoUrl: "",              // logo_url del vendor
  coverUrl: "",             // header_url del vendor
  phone: "0000000000",      // PedidosYa no da teléfono — placeholder
};

// Del menu-{id}.json — mapear sections → categories con items:
const MENU: { category: string; emoji: string; items: { name: string; price: number; description?: string; badge?: string }[] }[] = [
  // {
  //   category: "Milanesas",
  //   emoji: "🍗",
  //   items: [
  //     { name: "Milanesa napolitana", price: 17500, description: "Con salsa...", badge: "Popular" },
  //   ],
  // },
];

// ======== FIN DATOS ========

async function main() {
  const slug = makeSlug(VENDOR.name);
  const existing = await prisma.dealer.findUnique({ where: { slug } });
  if (existing) {
    console.log(`⚠️  ${VENDOR.name} ya existe (/${slug}). Abortando.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`🍽️  Importando: ${VENDOR.name} (PedidosYa #${VENDOR.id})`);

  const placeholderEmail = `${slug}@menusanjuan.com`;
  const user = await prisma.user.create({
    data: { email: placeholderEmail, password: hashPassword("menusj2024"), name: VENDOR.name, phone: VENDOR.phone },
  });
  const account = await prisma.account.create({
    data: { userId: user.id, type: "dealer" },
  });
  const dealer = await prisma.dealer.create({
    data: {
      accountId: account.id,
      name: VENDOR.name,
      slug,
      phone: VENDOR.phone,
      address: VENDOR.street || null,
      latitude: VENDOR.latitude || null,
      longitude: VENDOR.longitude || null,
      logoUrl: VENDOR.logoUrl || null,
      coverUrl: VENDOR.coverUrl || null,
      cuisineType: "General",
      isActive: false,
      sourceProfileId: String(VENDOR.id),
      sourceSite: "pedidosya",
    },
  });

  let totalItems = 0;
  for (let ci = 0; ci < MENU.length; ci++) {
    const cat = MENU[ci];
    const category = await prisma.menuCategory.create({
      data: { dealerId: dealer.id, name: cat.category, emoji: cat.emoji || null, sortOrder: ci },
    });
    for (let ii = 0; ii < cat.items.length; ii++) {
      const item = cat.items[ii];
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: item.name,
          description: item.description || null,
          price: item.price,
          badge: item.badge || null,
          available: true,
          sortOrder: ii,
        },
      });
      totalItems++;
    }
    console.log(`   📋 ${cat.emoji || "📋"} ${cat.category}: ${cat.items.length} items`);
  }

  console.log(`\n✅ ${VENDOR.name}: ${MENU.length} categorías, ${totalItems} items`);
  console.log(`   PedidosYa ID: ${VENDOR.id}`);
  console.log(`   Admin: https://menusanjuan.com/admin?login → "${VENDOR.name}"`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Ejecutar: `cd /Users/eleolivera/Desktop/manu-san-juan/webapp && npx tsx src/scripts/import-pedidosya-{slug}.ts`

---

## Mapeo de campos PedidosYa → MenuSanJuan

### Vendor → Restaurant:
| PedidosYa | MenuSanJuan | Notas |
|-----------|-------------|-------|
| `name` | `name` | Directo |
| `address.street` | `address` | Directo |
| `address.latitude` | `latitude` | Directo |
| `address.longitude` | `longitude` | Directo |
| `logo_url` | `logoUrl` | URL completa de PedidosYa CDN |
| `header_url` | `coverUrl` | URL completa de PedidosYa CDN |
| `id` | `sourceProfileId` | Guardar como string |
| — | `sourceSite` | Siempre `"pedidosya"` |
| — | `phone` | PedidosYa no da teléfono, usar `"0000000000"` |
| — | `cuisineType` | Deducir del menú o poner `"General"` |
| — | `isActive` | Siempre `false` |

### Menu Section → Category:
| PedidosYa | MenuSanJuan | Notas |
|-----------|-------------|-------|
| `sections[].name` | `category` | Directo |
| — | `emoji` | Elegir emoji apropiado basado en el nombre |

### Product → Item:
| PedidosYa | MenuSanJuan | Notas |
|-----------|-------------|-------|
| `products[].name` | `name` | Directo |
| `products[].description` | `description` | Directo (puede ser null) |
| `products[].price.finalPrice` | `price` | Número sin decimales |
| `products[].images.urls[0]` | — | Imagen en CDN de PedidosYa (no importar, expira) |
| `products[].tags.isMostOrdered` | `badge` | Si true → `"Popular"` |
| `products[].enabled` | — | Ignorar items con `enabled: false` |

### Emojis sugeridos por nombre de categoría:
| Nombre contiene | Emoji |
|-----------------|-------|
| Hamburguesa | 🍔 |
| Pizza | 🍕 |
| Milanesa | 🍗 |
| Empanada | 🥟 |
| Pasta, Tallarin, Ñoqui, Raviole, Lasaña | 🍝 |
| Bebida, Gaseosa, Agua, Cerveza | 🥤 |
| Postre, Torta, Helado | 🍰 |
| Ensalada, Vegetariano | 🥗 |
| Papa, Guarnición | 🍟 |
| Café, Desayuno | ☕ |
| Sushi, Roll | 🍣 |
| Combo, Promo | ⭐ |
| Parrilla, Carne, Asado | 🥩 |
| Pollo | 🍗 |
| Sandwich, Lomito | 🥖 |
| Wrap, Piadina | 🌯 |
| Default | 🍽️ |

---

## Proceso completo para importar en lote

1. **Guardar vendors JSON** → tiene la lista de todos los restaurantes
2. **Para cada restaurante**, guardar su menu JSON (necesita browser porque PedidosYa bloquea requests directos)
3. **Para cada par (vendor + menu)**, crear un script que:
   - Extrae los datos del vendor JSON
   - Parsea las sections/products del menu JSON
   - Mapea los campos según la tabla de arriba
   - Asigna emojis a las categorías
   - Marca items con `isMostOrdered: true` como `badge: "Popular"`
   - Ignora items con `enabled: false`
   - Ejecuta contra la DB
4. **Ejecutar** el script: `npx tsx src/scripts/import-pedidosya-{slug}.ts`
5. **Admin revisa** en menusanjuan.com/admin?login → ajusta → activa

---

## Tips

- PedidosYa image URLs (`pedidosya.dhmedia.io`) pueden expirar. Guardalas como `logoUrl`/`coverUrl` por ahora, pero idealmente descargarlas a R2 después.
- El teléfono no viene de PedidosYa — el admin lo agrega manualmente después, o el dueño lo pone cuando reclama el restaurante.
- Algunos restaurantes tienen nombres con sufijos de ubicación (ej: "Burger King - Rivadavia"). Limpiá eso en el nombre si querés.
- Si un restaurante ya existe en la DB (mismo slug), el script aborta para no duplicar.
