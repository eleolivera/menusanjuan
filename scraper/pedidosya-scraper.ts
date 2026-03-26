/**
 * PedidosYa Scraper for MenuSanJuan
 *
 * How it works:
 * 1. Opens a REAL Chrome browser (not headless) so you can see everything
 * 2. You navigate to PedidosYa and log in / solve captchas if needed
 * 3. Press Enter in the terminal when ready
 * 4. The script takes over: navigates to San Juan restaurants, grabs all data
 * 5. Saves vendors + menus as JSON files
 *
 * Run: npx tsx scraper/pedidosya-scraper.ts
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const OUTPUT_DIR = "/Users/eleolivera/Downloads/pedidosya-data";
const SAN_JUAN_URL = "https://www.pedidosya.com.ar/restaurantes/san-juan";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("🍽️  PedidosYa Scraper para MenuSanJuan\n");
  console.log("Se va a abrir Chrome. Pasos:");
  console.log("  1. Navegá a pedidosya.com.ar");
  console.log("  2. Si te pide login o captcha, resolvelo");
  console.log("  3. Navegá a restaurantes de San Juan");
  console.log("  4. Volvé acá y presioná Enter\n");

  // Launch REAL browser (not headless)
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled", // Hide automation flag
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "es-AR",
  });

  // Intercept API responses
  const vendorResponses: any[] = [];
  const menuResponses: Map<string, any> = new Map();

  context.on("response", async (response) => {
    const url = response.url();

    // Capture vendor list responses
    if (url.includes("/v1/food-home/v1/vendors") || url.includes("/food-home") && url.includes("vendors")) {
      try {
        const json = await response.json();
        if (json.data && Array.isArray(json.data)) {
          vendorResponses.push(...json.data);
          console.log(`   📡 Capturados ${json.data.length} vendors (total: ${vendorResponses.length})`);
        }
      } catch {}
    }

    // Capture menu responses
    if (url.includes("/niles/partners/") && url.includes("/menus")) {
      try {
        const json = await response.json();
        const match = url.match(/partners\/(\d+)\/menus/);
        if (match && json.sections) {
          const partnerId = match[1];
          menuResponses.set(partnerId, json);
          console.log(`   📋 Menú capturado: partner ${partnerId} (${json.sections?.length || 0} secciones)`);
        }
      } catch {}
    }
  });

  const page = await context.newPage();
  await page.goto(SAN_JUAN_URL);

  await ask("\n👆 Navegá por PedidosYa y resolvé cualquier captcha.\nPresioná Enter cuando estés en la lista de restaurantes de San Juan...");

  // Phase 1: Scroll to load all restaurants
  console.log("\n📜 Scrolleando para cargar todos los restaurantes...");

  let previousCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 30;

  while (scrollAttempts < maxScrollAttempts) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    if (vendorResponses.length > previousCount) {
      previousCount = vendorResponses.length;
      scrollAttempts = 0; // Reset if we found new data
      console.log(`   Cargados: ${vendorResponses.length} restaurantes...`);
    } else {
      scrollAttempts++;
      if (scrollAttempts >= 5) break; // Stop after 5 scrolls with no new data
    }
  }

  console.log(`\n✅ Total vendors capturados: ${vendorResponses.length}`);

  // Save vendors
  const vendorsPath = path.join(OUTPUT_DIR, "vendors.json");
  fs.writeFileSync(vendorsPath, JSON.stringify({ data: vendorResponses }, null, 2));
  console.log(`   Guardado: ${vendorsPath}`);

  // Phase 2: Fetch menus for each restaurant
  const vendorIds = vendorResponses.map((v: any) => ({ id: v.id, name: v.name, link: v.link || v.url }));

  console.log(`\n🍽️  Obteniendo menús de ${vendorIds.length} restaurantes...\n`);

  let fetched = 0;
  let failed = 0;

  for (const vendor of vendorIds) {
    if (menuResponses.has(String(vendor.id))) {
      fetched++;
      continue; // Already captured from scroll
    }

    try {
      // Navigate to the restaurant page — this triggers the menu API call
      const url = vendor.link?.startsWith("http")
        ? vendor.link
        : `https://www.pedidosya.com.ar${vendor.link || `/restaurantes/san-juan/${vendor.id}`}`;

      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);

      fetched++;
      const pct = Math.round((fetched / vendorIds.length) * 100);
      process.stdout.write(`\r   Progreso: ${fetched}/${vendorIds.length} (${pct}%) — ${vendor.name}`);

    } catch (err) {
      failed++;
      // Continue on error
    }

    // Small delay to not hammer the server
    await page.waitForTimeout(500 + Math.random() * 1000);
  }

  console.log(`\n\n✅ Menús obtenidos: ${menuResponses.size}`);
  if (failed > 0) console.log(`   ⚠️  Fallidos: ${failed}`);

  // Save individual menus
  for (const [partnerId, menu] of menuResponses) {
    const menuPath = path.join(OUTPUT_DIR, `menu-${partnerId}.json`);
    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
  }
  console.log(`   Guardados en: ${OUTPUT_DIR}/`);

  // Save a combined summary
  const summary = vendorResponses.map((v: any) => ({
    id: v.id,
    name: v.name,
    address: v.address?.street,
    latitude: v.address?.latitude,
    longitude: v.address?.longitude,
    logoUrl: v.logo_url,
    coverUrl: v.header_url,
    link: v.link,
    hasMenu: menuResponses.has(String(v.id)),
    menuSections: menuResponses.get(String(v.id))?.sections?.length || 0,
    menuItems: menuResponses.get(String(v.id))?.sections?.reduce(
      (s: number, sec: any) => s + (sec.products?.length || 0), 0
    ) || 0,
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n📊 Resumen:`);
  console.log(`   Restaurantes: ${vendorResponses.length}`);
  console.log(`   Con menú: ${menuResponses.size}`);
  console.log(`   Items totales: ${summary.reduce((s, r) => s + r.menuItems, 0)}`);
  console.log(`\n📁 Archivos en: ${OUTPUT_DIR}/`);
  console.log(`   vendors.json — Lista completa de restaurantes`);
  console.log(`   menu-{id}.json — Menú de cada restaurante`);
  console.log(`   summary.json — Resumen con stats`);

  console.log("\n\n🎉 Listo! Ahora importá con:");
  console.log("   Dále a Cowork los archivos de pedidosya-data/ + PEDIDOSYA_SCRAPER_INSTRUCTIONS.md");

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
