// Local sample: render the Layer-1 promo (creative PNG + caption + receta) for
// a resta without going through the authed route. Writes to the scratchpad so
// we can eyeball the output before shipping.
//
// Run: cd webapp && npx tsx --env-file=.env src/scripts/promo-sample.ts myg-fast-food cmswazqksmwxyhy4[,id2]
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import React from "react";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { PromoCard, PROMO_SIZE, loadPromoFonts } from "@/lib/promo-creative";
import { buildCaption, buildReceta } from "@/lib/promo-recipe";

const OUT = "/private/tmp/claude-501/-Users-eleolivera-Desktop-manu-san-juan/752f24b5-909a-48a1-b521-798e1f277897/scratchpad/promo";

async function main() {
  const [slug, idsArg] = process.argv.slice(2);
  if (!slug || !idsArg) throw new Error("usage: promo-sample.ts <slug> <itemId[,itemId]>");
  const ids = idsArg.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const dealer = await prisma.dealer.findUnique({ where: { slug } });
  if (!dealer) throw new Error(`dealer ${slug} not found`);
  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids }, category: { dealerId: dealer.id } },
    select: { id: true, name: true, price: true, imageUrl: true, badge: true, pricingMode: true, weightUnit: true },
  });
  const items = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  if (items.length === 0) throw new Error("no items matched");

  const promoDealer = {
    slug: dealer.slug, name: dealer.name, city: dealer.city, logoUrl: dealer.logoUrl,
    latitude: dealer.latitude, longitude: dealer.longitude,
    pickupHours: dealer.pickupHours, deliveryHours: dealer.deliveryHours, openHours: dealer.openHours,
    deliveryEnabled: dealer.deliveryEnabled, pickupEnabled: dealer.pickupEnabled,
    deliveryZones: dealer.deliveryZones, cuisineType: dealer.cuisineType,
  };

  const img = new ImageResponse(
    React.createElement(PromoCard, { dealer: promoDealer, items }),
    { ...PROMO_SIZE, fonts: loadPromoFonts() },
  );
  const png = Buffer.from(await img.arrayBuffer());

  mkdirSync(OUT, { recursive: true });
  const base = `${slug}-${items.length}items`;
  writeFileSync(path.join(OUT, `${base}.png`), png);
  const caption = buildCaption(promoDealer, items, { campaign: "sample" });
  const receta = buildReceta(promoDealer, items, { campaign: "sample" });
  writeFileSync(path.join(OUT, `${base}.caption.txt`), caption);
  writeFileSync(path.join(OUT, `${base}.receta.json`), JSON.stringify(receta, null, 2));

  console.log(`PNG: ${path.join(OUT, `${base}.png`)} (${png.length} bytes)`);
  console.log("\n=== CAPTION ===\n" + caption);
  console.log("\n=== RECETA ===");
  console.log(`radio ${receta.radioKm} km @ ${receta.pin ? `${receta.pin.lat},${receta.pin.lng}` : "(sin pin)"}`);
  console.log(`horario: ${receta.horario.resumen}`);
  console.log(`adset_schedule: ${JSON.stringify(receta.horario.adsetSchedule)}`);
  console.log(`presupuesto: ${receta.presupuesto.totalArs} ARS / ${receta.presupuesto.dias} días`);
  receta.pasos.forEach((p, i) => console.log(`${i + 1}. ${p}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
