/**
 * Migrate cuisine types: seed the CuisineType table and backfill DealerCuisineType join records
 * Run: cd webapp && npx tsx src/scripts/migrate-cuisine-types.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";

const SEED_TYPES = [
  { label: "Comida Rápida", emoji: "🍔" },
  { label: "Parrilla", emoji: "🥩" },
  { label: "Pizzería", emoji: "🍕" },
  { label: "Cafetería", emoji: "☕" },
  { label: "Pastas", emoji: "🍝" },
  { label: "Sushi", emoji: "🍣" },
  { label: "Heladería", emoji: "🍦" },
  { label: "Empanadas", emoji: "🥟" },
  { label: "Comida Árabe", emoji: "🧆" },
  { label: "Comida Mexicana", emoji: "🌮" },
  { label: "Comida China", emoji: "🥡" },
  { label: "Vegetariano", emoji: "🥗" },
  { label: "Postres", emoji: "🍰" },
  { label: "Rotisería", emoji: "🍗" },
  { label: "Panadería", emoji: "🥐" },
  { label: "Poke / Bowls", emoji: "🥙" },
  { label: "Cervecería", emoji: "🍺" },
  { label: "General", emoji: "🍽️" },
];

function cuid(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function main() {
  console.log("🍽️  Migrating cuisine types\n");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 1. Seed CuisineType table
  let inserted = 0;
  for (let i = 0; i < SEED_TYPES.length; i++) {
    const { label, emoji } = SEED_TYPES[i];
    const existing = await client.query('SELECT id FROM "CuisineType" WHERE label = $1', [label]);
    if (existing.rows.length === 0) {
      await client.query(
        'INSERT INTO "CuisineType" (id, label, emoji, "sortOrder", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
        [cuid(), label, emoji, i]
      );
      inserted++;
      console.log(`  ✅ ${emoji} ${label}`);
    } else {
      console.log(`  ⏭️  ${emoji} ${label} (exists)`);
    }
  }
  console.log(`\nInserted: ${inserted} cuisine types\n`);

  // 2. Get all cuisine types for lookup
  const { rows: types } = await client.query('SELECT id, label FROM "CuisineType"');
  const typeMap = new Map<string, string>();
  for (const t of types) typeMap.set(t.label, t.id);

  // 3. Backfill: for each dealer with a cuisineType string, create join record
  const { rows: dealers } = await client.query('SELECT id, "cuisineType" FROM "Dealer"');
  let backfilled = 0;

  for (const d of dealers) {
    const typeId = typeMap.get(d.cuisineType);
    if (!typeId) {
      // Unknown type — assign "General"
      const generalId = typeMap.get("General");
      if (generalId) {
        const exists = await client.query('SELECT 1 FROM "DealerCuisineType" WHERE "dealerId" = $1 AND "cuisineTypeId" = $2', [d.id, generalId]);
        if (exists.rows.length === 0) {
          await client.query('INSERT INTO "DealerCuisineType" ("dealerId", "cuisineTypeId") VALUES ($1, $2)', [d.id, generalId]);
          backfilled++;
        }
      }
      continue;
    }

    const exists = await client.query('SELECT 1 FROM "DealerCuisineType" WHERE "dealerId" = $1 AND "cuisineTypeId" = $2', [d.id, typeId]);
    if (exists.rows.length === 0) {
      await client.query('INSERT INTO "DealerCuisineType" ("dealerId", "cuisineTypeId") VALUES ($1, $2)', [d.id, typeId]);
      backfilled++;
    }
  }

  console.log(`Backfilled: ${backfilled} restaurant-cuisine links`);

  await client.end();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
