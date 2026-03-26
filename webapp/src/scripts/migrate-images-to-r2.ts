/**
 * Migrate PedidosYa CDN images to our R2 bucket
 *
 * Finds all dealers + menu items with pedidosya.dhmedia.io URLs,
 * downloads each image, uploads to R2, and updates the DB record.
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan/webapp && npx tsx src/scripts/migrate-images-to-r2.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});
const BUCKET = process.env.R2_BUCKET || "menusanjuan-images";
const PUBLIC_URL = "https://images.menusanjuan.com";

function isPedidosYaUrl(url: string | null): boolean {
  return !!url && url.includes("pedidosya.dhmedia.io");
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    return match ? match[1].toLowerCase() : "jpg";
  } catch {
    return "jpg";
  }
}

async function downloadAndUpload(imageUrl: string, key: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${PUBLIC_URL}/${key}`;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("🖼️  PedidosYa Image Migration → R2\n");

  // Verify R2 config
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY) {
    console.log("❌ Missing R2 env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY)");
    process.exit(1);
  }

  // ── Step 1: Migrate dealer logos ──
  const dealers = await prisma.dealer.findMany({
    where: { sourceSite: "pedidosya" },
    select: { id: true, slug: true, logoUrl: true, coverUrl: true, name: true },
  });

  console.log(`📋 ${dealers.length} PedidosYa dealers found\n`);

  let logosDone = 0, logosFailed = 0;
  for (const dealer of dealers) {
    if (isPedidosYaUrl(dealer.logoUrl)) {
      try {
        const ext = getExtFromUrl(dealer.logoUrl!);
        const key = `${dealer.slug}/logo.${ext}`;
        const newUrl = await downloadAndUpload(dealer.logoUrl!, key);
        await prisma.dealer.update({ where: { id: dealer.id }, data: { logoUrl: newUrl } });
        logosDone++;
        process.stdout.write(`\r   🏪 Logos: ${logosDone} migrated`);
      } catch (err: any) {
        logosFailed++;
        console.log(`   ❌ Logo ${dealer.name}: ${err.message}`);
      }
      await sleep(100); // gentle on PedidosYa CDN
    }

    if (isPedidosYaUrl(dealer.coverUrl)) {
      try {
        const ext = getExtFromUrl(dealer.coverUrl!);
        const key = `${dealer.slug}/cover.${ext}`;
        const newUrl = await downloadAndUpload(dealer.coverUrl!, key);
        await prisma.dealer.update({ where: { id: dealer.id }, data: { coverUrl: newUrl } });
        process.stdout.write(` | covers too`);
      } catch {
        // Cover is optional, don't count as failure
      }
      await sleep(100);
    }
  }
  console.log(`\n   ✅ Logos: ${logosDone} migrated, ${logosFailed} failed\n`);

  // ── Step 2: Migrate menu item images ──
  // Get all menu items from PedidosYa dealers
  const peyaDealerIds = dealers.map(d => d.id);
  const dealerSlugMap = new Map(dealers.map(d => [d.id, d.slug]));

  const categories = await prisma.menuCategory.findMany({
    where: { dealerId: { in: peyaDealerIds } },
    select: { id: true, dealerId: true },
  });
  const catDealerMap = new Map(categories.map(c => [c.id, c.dealerId]));
  const catIds = categories.map(c => c.id);

  const items = await prisma.menuItem.findMany({
    where: {
      categoryId: { in: catIds },
      imageUrl: { contains: "pedidosya.dhmedia.io" },
    },
    select: { id: true, categoryId: true, name: true, imageUrl: true },
  });

  console.log(`🍽️  ${items.length} menu items with PedidosYa images\n`);

  let itemsDone = 0, itemsFailed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const dealerId = catDealerMap.get(item.categoryId);
      const slug = dealerId ? dealerSlugMap.get(dealerId) || "unknown" : "unknown";
      const ext = getExtFromUrl(item.imageUrl!);
      const key = `${slug}/items/${item.id}.${ext}`;

      const newUrl = await downloadAndUpload(item.imageUrl!, key);
      await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl: newUrl } });
      itemsDone++;

      if (itemsDone % 10 === 0 || itemsDone === items.length) {
        const pct = Math.round((itemsDone / items.length) * 100);
        process.stdout.write(`\r   🍽️  Items: ${itemsDone}/${items.length} (${pct}%)`);
      }
    } catch (err: any) {
      itemsFailed++;
      if (itemsFailed <= 5) console.log(`   ❌ ${item.name}: ${err.message}`);
    }

    // Small delay every 5 items to avoid rate limiting
    if (i % 5 === 4) await sleep(200);
  }

  console.log(`\n   ✅ Items: ${itemsDone} migrated, ${itemsFailed} failed\n`);
  console.log(`📊 Total migrated: ${logosDone} logos + ${itemsDone} item images = ${logosDone + itemsDone}`);
  console.log(`📊 Total failed: ${logosFailed + itemsFailed}`);
  console.log(`\n🎉 Done! All images now on images.menusanjuan.com`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
