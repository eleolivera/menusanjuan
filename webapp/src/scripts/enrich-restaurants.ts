/**
 * Enrich restaurants with Google Places data (address, phone, coordinates)
 *
 * For each restaurant missing address/phone/coordinates, searches Google Places
 * and updates the DB with the best match.
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan/webapp && npx tsx src/scripts/enrich-restaurants.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function searchPlace(name: string): Promise<any | null> {
  // Use Text Search API with location bias for San Juan, Argentina
  const query = encodeURIComponent(`${name} San Juan Argentina`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=-31.5375,-68.5364&radius=30000&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

async function getPlaceDetails(placeId: string): Promise<any | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,international_phone_number,formatted_phone_number&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.result || null;
}

async function main() {
  console.log("🔍 Enriching restaurants with Google Places data\n");

  if (!GOOGLE_API_KEY) {
    console.log("❌ Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Get restaurants that need enrichment
  const { rows: restaurants } = await client.query(`
    SELECT id, name, slug, phone, address, latitude, longitude
    FROM "Dealer"
    WHERE "isActive" = true
    ORDER BY name
  `);

  console.log(`📋 ${restaurants.length} active restaurants\n`);

  let enriched = 0, skipped = 0, failed = 0;

  for (const r of restaurants) {
    const needsPhone = !r.phone || r.phone === "0000000000" || r.phone === "+54";
    const needsAddress = !r.address || r.address.trim() === "";
    const needsCoords = r.latitude == null || r.longitude == null;

    if (!needsPhone && !needsAddress && !needsCoords) {
      skipped++;
      continue;
    }

    try {
      // Search Google Places
      const place = await searchPlace(r.name);
      if (!place) {
        console.log(`   ⏭️  ${r.name} — no Google Places result`);
        failed++;
        await sleep(200);
        continue;
      }

      // Verify it's in San Juan (not somewhere else)
      const addr = place.formatted_address || place.vicinity || "";
      if (!addr.toLowerCase().includes("san juan") && !addr.toLowerCase().includes("sj")) {
        console.log(`   ⏭️  ${r.name} — not in San Juan: ${addr.substring(0, 50)}`);
        failed++;
        await sleep(200);
        continue;
      }

      // Get details for phone number
      let phone = null;
      let details = null;
      if (place.place_id && needsPhone) {
        details = await getPlaceDetails(place.place_id);
        phone = details?.international_phone_number || details?.formatted_phone_number || null;
        await sleep(100);
      }

      // Build update
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (needsAddress && addr) {
        updates.push(`address = $${paramIdx}`);
        values.push(addr);
        paramIdx++;
      }

      if (needsCoords && place.geometry?.location) {
        updates.push(`latitude = $${paramIdx}`);
        values.push(place.geometry.location.lat);
        paramIdx++;
        updates.push(`longitude = $${paramIdx}`);
        values.push(place.geometry.location.lng);
        paramIdx++;
      }

      if (needsPhone && phone) {
        // Format for Argentina: ensure +54 prefix
        let cleanPhone = phone.replace(/\s/g, "").replace(/-/g, "");
        if (!cleanPhone.startsWith("+")) cleanPhone = `+${cleanPhone}`;
        updates.push(`phone = $${paramIdx}`);
        values.push(cleanPhone);
        paramIdx++;
      }

      if (updates.length === 0) {
        skipped++;
        continue;
      }

      updates.push(`"updatedAt" = NOW()`);
      values.push(r.id);
      await client.query(`UPDATE "Dealer" SET ${updates.join(", ")} WHERE id = $${paramIdx}`, values);

      enriched++;
      const what = [
        needsAddress && addr ? "addr" : null,
        needsCoords && place.geometry ? "coords" : null,
        needsPhone && phone ? "phone" : null,
      ].filter(Boolean).join("+");

      console.log(`✅ ${enriched}. ${r.name.substring(0, 35).padEnd(35)} [${what}]`);

    } catch (err: any) {
      failed++;
      console.log(`   ❌ ${r.name}: ${err.message?.substring(0, 40)}`);
    }

    await sleep(300); // Google Places rate limit
  }

  console.log(`\n📊 Enriched: ${enriched} | Skipped (complete): ${skipped} | No data: ${failed}`);
  await client.end();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
