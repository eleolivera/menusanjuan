// One-off: convert El Nono Luis MenuItems from OptionGroup "Peso" → PACKAGED,
// and Frutos Secos "X KG" items → BY_WEIGHT.
// Run: cd webapp && npx tsx --env-file=.env src/scripts/migrate-nono-luis-pricing.ts
//
// Idempotent — checks pricingMode before touching an item.

import { prisma } from "@/lib/prisma";

const DEALER_ID = "cmtendno6l3n3mhx";

// Extract weight amount (in kg) from a size label like "¼ kg", "500 gr", "1 kg".
function labelToAmount(label: string): number | null {
  const t = label.trim().toLowerCase();
  if (/^¼\s*kg/.test(t) || /^1\/4\s*kg/.test(t) || /^0[,.]?25\s*kg/.test(t)) return 0.25;
  if (/^½\s*kg/.test(t) || /^1\/2\s*kg/.test(t) || /^0[,.]?5\s*kg/.test(t)) return 0.5;
  if (/^1\s*kg/.test(t)) return 1.0;
  if (/^2\s*kg/.test(t)) return 2.0;
  if (/^10\s*kg/.test(t)) return 10.0;
  const grMatch = t.match(/^(\d+)\s*gr/);
  if (grMatch) return Number(grMatch[1]) / 1000;
  const lMatch = t.match(/^([\d.,]+)\s*l/);
  if (lMatch) return Number(lMatch[1].replace(",", ".")); // liters — keep as-is
  return null;
}

async function migratePackaged() {
  const items = await prisma.menuItem.findMany({
    where: {
      category: { dealerId: DEALER_ID },
      optionGroups: { some: { title: "Peso" } },
      pricingMode: "FIXED", // idempotent guard
    },
    include: {
      optionGroups: { include: { options: true } },
    },
  });
  console.log(`Found ${items.length} PACKAGED-candidate items (with Peso OptionGroup)`);

  let converted = 0;
  let skipped = 0;
  for (const item of items) {
    const pesoGroup = item.optionGroups.find((g) => g.title === "Peso");
    if (!pesoGroup) continue;
    const tiers: Array<{ label: string; amount: number; price: number }> = [];
    for (const opt of pesoGroup.options) {
      const amount = labelToAmount(opt.name);
      if (amount === null) {
        console.warn(`  ⚠ ${item.name}: could not parse "${opt.name}" → skipping item`);
        skipped++;
        continue;
      }
      tiers.push({ label: opt.name, amount, price: item.price + opt.priceDelta });
    }
    if (tiers.length < 2) {
      console.warn(`  ⚠ ${item.name}: only ${tiers.length} tier(s), needs 2+`);
      skipped++;
      continue;
    }
    tiers.sort((a, b) => a.amount - b.amount);

    await prisma.$transaction([
      prisma.menuItem.update({
        where: { id: item.id },
        data: {
          pricingMode: "PACKAGED",
          quantityTiers: tiers,
          price: tiers[0].price, // display anchor = smallest tier
        },
      }),
      // Drop the Peso OptionGroup — customer will pick via the tier chip picker
      prisma.optionGroup.deleteMany({ where: { id: pesoGroup.id } }),
    ]);
    converted++;
    console.log(`  ✓ ${item.name}: ${tiers.length} tiers`);
  }
  console.log(`PACKAGED: converted=${converted} skipped=${skipped}`);
}

async function migrateByWeight() {
  // Frutos secos: names end with "X KG" or "X 1 KG" — those are per-kg items.
  // Bulk SKUs ("X 10 KG", "X 2 KG") stay FIXED — wholesale, not fraccionado.
  const cat = await prisma.menuCategory.findFirst({
    where: { dealerId: DEALER_ID, name: { contains: "Frutos secos" } },
  });
  if (!cat) {
    console.log("Frutos secos category not found — skipping BY_WEIGHT migration");
    return;
  }
  const items = await prisma.menuItem.findMany({
    where: { categoryId: cat.id, pricingMode: "FIXED" },
  });
  console.log(`\nFound ${items.length} candidate items in Frutos secos`);

  let converted = 0;
  let bulkKept = 0;
  for (const item of items) {
    // Bulk detection: "X 10 KG", "X 2 KG", "BOLSON", "X 2000", "X 3000" — the
    // conservative rule is: if the name contains a plural-kg hint, keep as
    // FIXED wholesale. Everything else per-kg = BY_WEIGHT.
    const isBulk = /X\s*(\d{2,})\s*KG|BOLSON|BULTO/i.test(item.name);
    if (isBulk) {
      bulkKept++;
      continue;
    }
    // Only convert items that clearly are per-kg priced.
    const isPerKg = /\bX\s*KG\b/i.test(item.name) || /\bX\s*1\s*KG\b/i.test(item.name);
    if (!isPerKg) {
      continue;
    }
    // Clean the name: strip the "X KG" / "X 1 KG" suffix.
    const cleanName = item.name.replace(/\s*X\s*1?\s*KG\b/i, "").trim();
    await prisma.menuItem.update({
      where: { id: item.id },
      data: {
        pricingMode: "BY_WEIGHT",
        weightUnit: "kg",
        weightStep: 0.25,
        quantityTiers: [{ fromAmount: 0.25, pricePerUnit: item.price }],
        name: cleanName || item.name,
      },
    });
    converted++;
    console.log(`  ✓ ${cleanName} @ $${item.price}/kg`);
  }
  console.log(`BY_WEIGHT: converted=${converted} bulk-kept=${bulkKept}`);

  // Cereales: same "X KG" pattern in a separate category
  const cerCat = await prisma.menuCategory.findFirst({
    where: { dealerId: DEALER_ID, name: { contains: "Cereales" } },
  });
  if (cerCat) {
    const cerItems = await prisma.menuItem.findMany({
      where: { categoryId: cerCat.id, pricingMode: "FIXED" },
    });
    let cerConverted = 0;
    for (const item of cerItems) {
      const isBulk = /X\s*(\d{2,})\s*KG|BOLSON|BULTO/i.test(item.name);
      if (isBulk) continue;
      const isPerKg = /\bX\s*KG\b/i.test(item.name);
      if (!isPerKg) continue;
      const cleanName = item.name.replace(/\s*X\s*KG\b/i, "").trim();
      await prisma.menuItem.update({
        where: { id: item.id },
        data: {
          pricingMode: "BY_WEIGHT",
          weightUnit: "kg",
          weightStep: 0.25,
          quantityTiers: [{ fromAmount: 0.25, pricePerUnit: item.price }],
          name: cleanName || item.name,
        },
      });
      cerConverted++;
    }
    console.log(`Cereales BY_WEIGHT: converted=${cerConverted}`);
  }
}

async function main() {
  await migratePackaged();
  await migrateByWeight();

  // Invariant checks
  const [packaged, byWeight, fixed] = await Promise.all([
    prisma.menuItem.count({ where: { category: { dealerId: DEALER_ID }, pricingMode: "PACKAGED" } }),
    prisma.menuItem.count({ where: { category: { dealerId: DEALER_ID }, pricingMode: "BY_WEIGHT" } }),
    prisma.menuItem.count({ where: { category: { dealerId: DEALER_ID }, pricingMode: "FIXED" } }),
  ]);
  console.log(`\nFINAL COUNTS: FIXED=${fixed} PACKAGED=${packaged} BY_WEIGHT=${byWeight}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
