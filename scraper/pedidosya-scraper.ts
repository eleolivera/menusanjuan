/**
 * PedidosYa Full Scraper — Cookie-based (no browser, no bot detection)
 *
 * Uses your real Chrome cookies. Fetches all vendors + menus.
 * Resumes from where it left off (skips already-scraped restaurants).
 *
 * Run: cd /Users/eleolivera/Desktop/manu-san-juan && npx tsx scraper/pedidosya-scraper.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const OUTPUT_DIR = "/Users/eleolivera/Downloads/pedidosya-data";
const COOKIE_FILE = "/Users/eleolivera/Desktop/manu-san-juan/scraper/cookies.txt";
const BASE_URL = "https://www.pedidosya.com.ar";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function curlFetch(url: string, referer?: string): { status: number; body: string } {
  const cookies = fs.readFileSync(COOKIE_FILE, "utf-8").trim().replace(/\n/g, "");
  const ref = referer || `${BASE_URL}/restaurantes/san-juan`;
  try {
    const result = execSync(`curl -s -w "\\n%{http_code}" \
      -H "cookie: ${cookies}" \
      -H "user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36" \
      -H "accept: application/json, text/plain, */*" \
      -H "referer: ${ref}" \
      -H "sec-ch-ua-mobile: ?1" \
      -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \
      -H 'sec-ch-ua-platform: "Android"' \
      -H "sec-fetch-dest: empty" \
      -H "sec-fetch-mode: cors" \
      -H "sec-fetch-site: same-origin" \
      "${url}"`, { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }).toString();
    const lines = result.trim().split("\n");
    const status = parseInt(lines[lines.length - 1]);
    const body = lines.slice(0, -1).join("\n");
    return { status, body };
  } catch {
    return { status: 0, body: "" };
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("🍽️  PedidosYa Menu Scraper\n");

  // Load vendors from vendors-full.json (v4 API data)
  const vendorsFile = path.join(OUTPUT_DIR, "vendors-full.json");
  if (!fs.existsSync(vendorsFile)) {
    console.log("❌ vendors-full.json not found in", OUTPUT_DIR);
    return;
  }
  const allVendors: any[] = JSON.parse(fs.readFileSync(vendorsFile, "utf-8"));
  console.log(`📋 ${allVendors.length} vendors loaded\n`);

  // Find which ones still need menus
  const needMenu: any[] = [];
  for (const v of allVendors) {
    const menuFile = path.join(OUTPUT_DIR, `menu-${v.id}.json`);
    if (!fs.existsSync(menuFile)) needMenu.push(v);
  }
  console.log(`📁 Already have: ${allVendors.length - needMenu.length} menus`);
  console.log(`🔍 Need to scrape: ${needMenu.length} menus\n`);

  if (needMenu.length === 0) {
    console.log("✅ All menus already scraped!");
    return;
  }

  // Test cookies
  const testRes = curlFetch(`${BASE_URL}/v2/niles/partners/${needMenu[0].id}/menus?occasion=DELIVERY`);
  if (testRes.status !== 200) {
    console.log(`❌ Cookies expired or invalid (status ${testRes.status}). Update scraper/cookies.txt`);
    return;
  }
  console.log("✅ Cookies OK\n");

  let done = 0, failed = 0;
  const failedVendors: { id: number; name: string; status: number }[] = [];

  for (let i = 0; i < needMenu.length; i++) {
    const v = needMenu[i];
    const menuFile = path.join(OUTPUT_DIR, `menu-${v.id}.json`);

    try {
      const link = v.link || v.name?.toLowerCase().replace(/[^a-z0-9]/g, "-") || `id-${v.id}`;
      const referer = `${BASE_URL}/restaurantes/san-juan/${link}-menu`;
      const res = curlFetch(`${BASE_URL}/v2/niles/partners/${v.id}/menus?occasion=DELIVERY`, referer);

      if (res.status === 403) {
        console.log(`\n\n⚠️  403 — cookies expired after ${done} new menus.`);
        console.log(`   Update scraper/cookies.txt and run again to continue.\n`);
        // Save remaining + failed for later
        const remaining = needMenu.slice(i).map(v => v.id);
        const report = { failedVendors, remainingIds: remaining, scrapedSoFar: done, timestamp: new Date().toISOString() };
        fs.writeFileSync(path.join(OUTPUT_DIR, "scrape-progress.json"), JSON.stringify(report, null, 2));
        console.log(`   Progress saved to scrape-progress.json`);
        break;
      }

      if (res.status !== 200) {
        failed++;
        failedVendors.push({ id: v.id, name: v.name || "?", status: res.status });
        console.log(`   ❌ ${v.id} ${(v.name || "?").substring(0, 30)} — HTTP ${res.status}`);
        continue;
      }

      const menu = JSON.parse(res.body);
      const items = (menu.sections || []).reduce((s: number, sec: any) => s + (sec.products?.length || 0), 0);

      fs.writeFileSync(menuFile, JSON.stringify(menu));

      done++;
      const pct = Math.round(((i + 1) / needMenu.length) * 100);
      process.stdout.write(`\r   ${i + 1}/${needMenu.length} (${pct}%) ✅ ${(v.name || "").substring(0, 35).padEnd(35)} ${items} items`);

    } catch {
      failed++;
      failedVendors.push({ id: v.id, name: v.name || "?", status: 0 });
    }

    await sleep(1500 + Math.random() * 2000);
  }

  // Save report
  const report = { failedVendors, scrapedNew: done, totalFailed: failed, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(OUTPUT_DIR, "scrape-progress.json"), JSON.stringify(report, null, 2));

  console.log(`\n\n📊 New: ${done} | Failed: ${failed} | Total menus: ${allVendors.length - needMenu.length + done}`);
  if (failedVendors.length > 0) {
    console.log(`\n❌ Failed vendors (retry Friday 9pm when open):`);
    for (const f of failedVendors) console.log(`   ${f.id}: ${f.name} (HTTP ${f.status})`);
  }
  console.log(`\n📁 ${OUTPUT_DIR}/`);
}

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
