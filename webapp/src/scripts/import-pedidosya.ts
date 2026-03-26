/**
 * Import PedidosYa scraped data into MenuSanJuan DB
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan/webapp && npx tsx src/scripts/import-pedidosya.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const DATA_DIR = "/Users/eleolivera/Downloads/pedidosya-data";

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
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

// Map PedidosYa food categories to MenuSanJuan cuisineType
function mapCuisineType(categories: { name: string }[]): string {
  if (!categories?.length) return "General";
  const name = categories[0].name.toLowerCase();
  if (name.includes("sushi") || name.includes("japon")) return "Sushi";
  if (name.includes("pizza")) return "Pizzería";
  if (name.includes("hambur") || name.includes("burger")) return "Comida Rápida";
  if (name.includes("empanada")) return "Empanadas";
  if (name.includes("helad") || name.includes("ice")) return "Heladería";
  if (name.includes("café") || name.includes("cafe") || name.includes("coffee")) return "Cafetería";
  if (name.includes("pasta") || name.includes("italian")) return "Pastas";
  if (name.includes("parrilla") || name.includes("asado") || name.includes("carne")) return "Parrilla";
  if (name.includes("poke") || name.includes("salad") || name.includes("veg")) return "Vegetariano";
  if (name.includes("postre") || name.includes("pastel") || name.includes("torta")) return "Postres";
  if (name.includes("árabe") || name.includes("arab")) return "Comida Árabe";
  if (name.includes("mexic")) return "Comida Mexicana";
  if (name.includes("china") || name.includes("chino") || name.includes("wok")) return "Comida China";
  return "Comida Rápida"; // Default for most PedidosYa restaurants
}

// Map section names to emojis
function sectionEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("hambur") || n.includes("burger")) return "🍔";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("empanada")) return "🥟";
  if (n.includes("pasta") || n.includes("tallarin") || n.includes("ñoqui") || n.includes("lasaña") || n.includes("canelone")) return "🍝";
  if (n.includes("sushi") || n.includes("roll")) return "🍣";
  if (n.includes("helad")) return "🍦";
  if (n.includes("bebid") || n.includes("gaseosa") || n.includes("agua")) return "🥤";
  if (n.includes("postre") || n.includes("torta") || n.includes("cake")) return "🍰";
  if (n.includes("café") || n.includes("cafe") || n.includes("desayuno") || n.includes("merienda")) return "☕";
  if (n.includes("ensalad")) return "🥗";
  if (n.includes("papa") || n.includes("guarnicion") || n.includes("acompañ")) return "🍟";
  if (n.includes("pollo") || n.includes("milanes")) return "🍗";
  if (n.includes("carne") || n.includes("parrilla") || n.includes("asado")) return "🥩";
  if (n.includes("sandwich") || n.includes("lomito") || n.includes("tostado")) return "🥖";
  if (n.includes("combo") || n.includes("promo")) return "⭐";
  if (n.includes("churro")) return "🥐";
  if (n.includes("wrap") || n.includes("burrito") || n.includes("piadina")) return "🌯";
  if (n.includes("poke") || n.includes("bowl")) return "🥗";
  if (n.includes("factura") || n.includes("medialuna") || n.includes("panaderia")) return "🥐";
  return "🍽️";
}

async function main() {
  console.log("🍽️  PedidosYa → MenuSanJuan Importer\n");

  // Load vendor data
  const vendorsFile = path.join(DATA_DIR, "vendors-full.json");
  if (!fs.existsSync(vendorsFile)) {
    console.log("❌ vendors-full.json not found");
    return;
  }
  const vendors: any[] = JSON.parse(fs.readFileSync(vendorsFile, "utf-8"));
  console.log(`📋 ${vendors.length} vendors loaded\n`);

  // Build vendor lookup by ID
  const vendorMap = new Map<number, any>();
  for (const v of vendors) vendorMap.set(v.id, v);

  // Find all menu files
  const menuFiles = fs.readdirSync(DATA_DIR).filter((f: string) => f.startsWith("menu-") && f.endsWith(".json"));
  console.log(`📁 ${menuFiles.length} menu files found\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const menuFile of menuFiles) {
    const menuData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, menuFile), "utf-8"));
    const partnerId = parseInt(menuFile.replace("menu-", "").replace(".json", ""));

    // Get vendor info
    const vendor = vendorMap.get(partnerId);
    if (!vendor) {
      console.log(`   ⚠️ No vendor data for ${partnerId}, skipping`);
      skipped++;
      continue;
    }

    const name = (vendor.name || `Restaurant ${partnerId}`).replace(/\s*-\s*San Juan$/i, "").replace(/\s*-\s*SJ$/i, "").trim();
    const slug = makeSlug(name);

    // Check if already exists
    const existing = await prisma.dealer.findFirst({
      where: { OR: [{ slug }, { sourceProfileId: String(partnerId) }] },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const sections = menuData.sections || [];
    if (sections.length === 0) {
      skipped++;
      continue;
    }

    const cuisineType = mapCuisineType(vendor.mainFoodCategories || []);
    const logoUrl = vendor.logo ? `https://pedidosya.dhmedia.io/image/pedidosya/restaurants/${vendor.logo}` : null;
    const lat = vendor.location?.latitude || null;
    const lng = vendor.location?.longitude || null;

    try {
      // Create placeholder user
      const placeholderEmail = `${slug}@menusanjuan.com`;
      const existingUser = await prisma.user.findUnique({ where: { email: placeholderEmail } });

      let userId: string;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const user = await prisma.user.create({
          data: { email: placeholderEmail, password: hashPassword("menusj2024"), name, phone: "0000000000" },
        });
        userId = user.id;
      }

      const account = await prisma.account.create({
        data: { userId, type: "dealer" },
      });

      const dealer = await prisma.dealer.create({
        data: {
          accountId: account.id,
          name,
          slug,
          phone: "0000000000", // Placeholder — admin fills in later
          address: null, // Not available from PedidosYa v4
          latitude: lat,
          longitude: lng,
          cuisineType,
          description: null,
          logoUrl,
          coverUrl: null,
          isActive: false, // Admin activates after review
          sourceProfileId: String(partnerId),
          sourceSite: "pedidosya",
        },
      });

      // Create menu
      let totalItems = 0;
      for (let ci = 0; ci < sections.length; ci++) {
        const section = sections[ci];
        const products = (section.products || []).filter((p: any) => p.enabled !== false);
        if (products.length === 0) continue;

        const category = await prisma.menuCategory.create({
          data: {
            dealerId: dealer.id,
            name: section.name,
            emoji: sectionEmoji(section.name),
            sortOrder: ci,
          },
        });

        for (let pi = 0; pi < products.length; pi++) {
          const product = products[pi];
          const price = product.price?.finalPrice || 0;
          const imgUuid = product.images?.urls?.[0];
          const imageUrl = imgUuid
            ? `https://pedidosya.dhmedia.io/image/pedidosya/products/${imgUuid}${imgUuid.includes('.') ? '' : '.jpg'}?quality=90&width=400`
            : null;
          const isMostOrdered = product.tags?.isMostOrdered;

          await prisma.menuItem.create({
            data: {
              categoryId: category.id,
              name: product.name,
              description: product.description || null,
              price,
              imageUrl,
              badge: isMostOrdered ? "Popular" : null,
              available: true,
              sortOrder: pi,
            },
          });
          totalItems++;
        }
      }

      imported++;
      console.log(`✅ ${imported}. ${name.padEnd(35)} ${sections.length} cat, ${totalItems} items — /${slug}`);

    } catch (err: any) {
      failed++;
      console.log(`❌ ${name}: ${err.message?.substring(0, 60)}`);
    }
  }

  console.log(`\n📊 Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`\n🎉 Done! Admin review at menusanjuan.com/admin?login`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
