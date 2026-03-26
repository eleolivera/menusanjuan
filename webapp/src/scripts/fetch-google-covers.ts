/**
 * Fetch Google Places photos for restaurants without cover images
 *
 * For each restaurant missing a coverUrl, searches Google Places by name + "San Juan",
 * downloads the photo, uploads to R2, and updates the DB.
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan/webapp && npx tsx src/scripts/fetch-google-covers.ts
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

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${PUBLIC_URL}/${key}`;
}

async function searchPlace(name: string): Promise<string | null> {
  const query = encodeURIComponent(`${name} restaurante San Juan Argentina`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos,name,place_id&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  const candidate = data.candidates?.[0];
  if (!candidate?.photos?.length) return null;

  return candidate.photos[0].photo_reference;
}

async function downloadPlacePhoto(photoRef: string, maxWidth = 800): Promise<Buffer | null> {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("🔍 Google Places → Restaurant Covers\n");

  if (!GOOGLE_API_KEY) {
    console.log("❌ Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    process.exit(1);
  }

  // Find restaurants without covers
  const dealers = await prisma.dealer.findMany({
    where: {
      isActive: true,
      OR: [{ coverUrl: null }, { coverUrl: "" }],
    },
    select: { id: true, name: true, slug: true, coverUrl: true },
    orderBy: { name: "asc" },
  });

  console.log(`📋 ${dealers.length} restaurants without cover images\n`);

  let done = 0, failed = 0;

  for (const dealer of dealers) {
    try {
      // Search Google Places
      const photoRef = await searchPlace(dealer.name);
      if (!photoRef) {
        console.log(`   ⏭️  ${dealer.name} — no Google Places photo`);
        failed++;
        await sleep(200);
        continue;
      }

      // Download the photo
      const photoBuffer = await downloadPlacePhoto(photoRef);
      if (!photoBuffer) {
        console.log(`   ⏭️  ${dealer.name} — photo download failed`);
        failed++;
        await sleep(200);
        continue;
      }

      // Upload to R2
      const key = `${dealer.slug}/cover-google.jpg`;
      const coverUrl = await uploadToR2(photoBuffer, key, "image/jpeg");

      // Update DB
      await prisma.dealer.update({
        where: { id: dealer.id },
        data: { coverUrl },
      });

      done++;
      console.log(`✅ ${done}. ${dealer.name.substring(0, 35).padEnd(35)} → ${coverUrl.split("/").pop()}`);

    } catch (err: any) {
      failed++;
      console.log(`   ❌ ${dealer.name}: ${err.message?.substring(0, 50)}`);
    }

    // Rate limit — Google Places allows 10 QPS
    await sleep(300);
  }

  console.log(`\n📊 Covers added: ${done} | No photo found: ${failed}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
