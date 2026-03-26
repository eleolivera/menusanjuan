/**
 * Targeted batch scraper — scrapes menus for specific vendor IDs + all missing from vendors-full.json
 * Stops on closed restaurants or expired cookies. Saves progress.
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan && npx tsx scraper/scrape-batch.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const OUTPUT_DIR = "/Users/eleolivera/Downloads/pedidosya-data";
const COOKIE_FILE = "/Users/eleolivera/Desktop/manu-san-juan/scraper/cookies.txt";
const BASE_URL = "https://www.pedidosya.com.ar";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function curlFetch(url: string, method = "GET", body?: string): { status: number; body: string } {
  const cookies = fs.readFileSync(COOKIE_FILE, "utf-8").trim().replace(/\n/g, "");
  const bodyArgs = body ? `-d '${body}' -H "content-type: application/json"` : "";
  const methodArg = method === "POST" ? "-X POST" : "";
  try {
    const result = execSync(`curl -s -w "\\n%{http_code}" \
      ${methodArg} ${bodyArgs} \
      -H "cookie: ${cookies}" \
      -H "user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36" \
      -H "accept: application/json, text/plain, */*" \
      -H "referer: ${BASE_URL}/restaurantes/san-juan" \
      -H "sec-ch-ua-mobile: ?1" \
      -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \
      -H 'sec-ch-ua-platform: "Android"' \
      -H "sec-fetch-dest: empty" \
      -H "sec-fetch-mode: cors" \
      -H "sec-fetch-site: same-origin" \
      "${url}"`, { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }).toString();
    const lines = result.trim().split("\n");
    const status = parseInt(lines[lines.length - 1]);
    const bodyOut = lines.slice(0, -1).join("\n");
    return { status, body: bodyOut };
  } catch {
    return { status: 0, body: "" };
  }
}

// New vendor IDs from latest page (not yet in vendors-full.json)
const NEW_VENDOR_IDS = [584792,584838,585062,585091,585872,585916,586311,587879,588560,588805,590032,590309,590370,590606,590720,590937,590948,591869,594253,595703,596134,597288,597882,598421,600581,600662,601490,601641,602134,602198];

async function main() {
  console.log("🍽️  PedidosYa Batch Scraper\n");

  // Load existing vendors
  const vendorsFile = path.join(OUTPUT_DIR, "vendors-full.json");
  const vendors: any[] = fs.existsSync(vendorsFile) ? JSON.parse(fs.readFileSync(vendorsFile, "utf-8")) : [];
  const vendorMap = new Map<number, any>();
  for (const v of vendors) vendorMap.set(v.id, v);

  // Build full list: new IDs first, then all missing from vendors-full.json
  const allIds: number[] = [...NEW_VENDOR_IDS];
  for (const v of vendors) {
    if (!allIds.includes(v.id)) allIds.push(v.id);
  }

  // Filter to only those missing menu files
  const needMenu = allIds.filter(id => !fs.existsSync(path.join(OUTPUT_DIR, `menu-${id}.json`)));
  console.log(`📋 Total vendors: ${vendors.length + NEW_VENDOR_IDS.filter(id => !vendorMap.has(id)).length}`);
  console.log(`🔍 Need menus: ${needMenu.length}\n`);

  if (needMenu.length === 0) { console.log("✅ All done!"); return; }

  // Test cookies
  const testRes = curlFetch(`${BASE_URL}/v2/niles/partners/${needMenu[0]}/menus?occasion=DELIVERY`);
  if (testRes.status === 403) {
    console.log("❌ Cookies expired (403). Update scraper/cookies.txt");
    return;
  }
  // Even if test returned non-200, continue — some restaurants may be closed
  console.log(`✅ Cookies working (test: HTTP ${testRes.status})\n`);

  let done = 0, closed = 0, failed = 0;
  const failedIds: number[] = [];
  const closedIds: number[] = [];

  for (let i = 0; i < needMenu.length; i++) {
    const id = needMenu[i];
    const menuFile = path.join(OUTPUT_DIR, `menu-${id}.json`);

    try {
      const res = curlFetch(`${BASE_URL}/v2/niles/partners/${id}/menus?occasion=DELIVERY`);

      if (res.status === 403) {
        console.log(`\n\n⚠️  403 — cookies expired after ${done} menus.`);
        const remaining = needMenu.slice(i);
        const report = { done, closed, failed, closedIds, failedIds, remainingIds: remaining, timestamp: new Date().toISOString() };
        fs.writeFileSync(path.join(OUTPUT_DIR, "scrape-progress.json"), JSON.stringify(report, null, 2));
        console.log(`   Progress saved. ${remaining.length} remaining for next session.`);
        break;
      }

      if (res.status !== 200) {
        // Non-200 but not 403 — likely closed or unavailable
        const vendor = vendorMap.get(id);
        const name = vendor?.name || `ID ${id}`;
        console.log(`   ⏸️  ${id} ${name.substring(0, 35)} — HTTP ${res.status} (closed?)`);
        closed++;
        closedIds.push(id);

        // If we get 3+ closed in a row, most restaurants are probably closed — stop
        if (closedIds.length >= 3 && closedIds.slice(-3).every((_, idx, arr) => idx === 0 || true)) {
          // Check if last 3 were all closed
          const lastThree = needMenu.slice(Math.max(0, i - 2), i + 1);
          const allClosed = lastThree.every(lid => closedIds.includes(lid));
          if (allClosed && closed >= 3) {
            console.log(`\n   ⏹️  3+ closed in a row — stopping. Retry Friday 9pm.`);
            const remaining = needMenu.slice(i + 1);
            const report = { done, closed, failed, closedIds, failedIds, remainingIds: remaining, timestamp: new Date().toISOString() };
            fs.writeFileSync(path.join(OUTPUT_DIR, "scrape-progress.json"), JSON.stringify(report, null, 2));
            break;
          }
        }
        continue;
      }

      const menu = JSON.parse(res.body);
      const sections = menu.sections || [];
      const items = sections.reduce((s: number, sec: any) => s + (sec.products?.length || 0), 0);

      if (sections.length === 0) {
        const vendor = vendorMap.get(id);
        console.log(`   ⏸️  ${id} ${(vendor?.name || "?").substring(0, 35)} — empty menu (closed)`);
        closed++;
        closedIds.push(id);
        continue;
      }

      fs.writeFileSync(menuFile, JSON.stringify(menu));
      done++;

      const vendor = vendorMap.get(id);
      const name = vendor?.name || `ID ${id}`;
      console.log(`✅ ${done}. ${name.substring(0, 35).padEnd(35)} ${sections.length} cat, ${items} items`);

    } catch (err: any) {
      failed++;
      failedIds.push(id);
    }

    await sleep(1500 + Math.random() * 2000);
  }

  // Save final report
  const report = { done, closed, failed, closedIds, failedIds, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(OUTPUT_DIR, "scrape-progress.json"), JSON.stringify(report, null, 2));

  console.log(`\n📊 Scraped: ${done} | Closed: ${closed} | Failed: ${failed}`);
  if (closedIds.length > 0) {
    console.log(`\n⏸️  Closed restaurants (retry Friday 9pm): ${closedIds.length} IDs saved to scrape-progress.json`);
  }

  // Count total menus now
  const totalMenus = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith("menu-") && f.endsWith(".json")).length;
  console.log(`\n📁 Total menu files: ${totalMenus}`);
}

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
