// Seed script: npx tsx webapp/src/scripts/seed-orders.ts (run from repo root)
// Generates 2 weeks of realistic orders for Puerto Pachatas

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const SLUG = "puerto-pachatas";

const CUSTOMERS = [
  { name: "Juan Pérez", phone: "2645551001", address: "Av. Libertador 1200, Capital" },
  { name: "María García", phone: "2645551002", address: "Calle Mendoza 450, Rivadavia" },
  { name: "Carlos López", phone: "2645551003", address: "Av. San Martín 890, Capital" },
  { name: "Ana Rodríguez", phone: "2645551004", address: "Peatonal Tucumán 123, Capital" },
  { name: "Diego Fernández", phone: "2645551005", address: "Calle España 320, Chimbas" },
  { name: "Lucía Martínez", phone: "2645551006", address: "Av. Rawson 1500, Rawson" },
  { name: "Pablo Sánchez", phone: "2645551007", address: "Calle 9 de Julio 500, Capital" },
  { name: "Valentina Torres", phone: "2645551008", address: "Av. Ignacio de la Roza 800" },
  { name: "Matías Ruiz", phone: "2645551009", address: "Calle Aberastain 600, Capital" },
  { name: "Camila Díaz", phone: "2645551010", address: "Ruta 40 km 5, Pocito" },
  { name: "Federico Morales", phone: "2645551011", address: "Calle Laprida 234, Capital" },
  { name: "Sofía Romero", phone: "2645551012", address: "Av. Alem 678, Santa Lucía" },
  { name: "Tomás Acosta", phone: "2645551013", address: "Calle Sarmiento 901, Capital" },
  { name: "Florencia Vega", phone: "2645551014", address: "Av. Córdoba 345, Rivadavia" },
  { name: "Nicolás Herrera", phone: "2645551015", address: "Calle Entre Ríos 567, Capital" },
];

const MENU_ITEMS = [
  { id: "item-1", name: "Lomito Completo", price: 5500 },
  { id: "item-2", name: "Lomito Simple", price: 4200 },
  { id: "item-3", name: "Lomito Especial de la Casa", price: 6800 },
  { id: "item-4", name: "Pachata Clásica", price: 4500 },
  { id: "item-5", name: "Pachata Criolla", price: 5200 },
  { id: "item-6", name: "Hamburguesa Clásica", price: 4800 },
  { id: "item-7", name: "Doble Smash Burger", price: 6200 },
  { id: "item-8", name: "Papas Fritas", price: 2200 },
  { id: "item-9", name: "Aros de Cebolla", price: 2500 },
  { id: "item-10", name: "Coca-Cola 500ml", price: 1200 },
  { id: "item-11", name: "Agua Mineral 500ml", price: 800 },
  { id: "item-12", name: "Cerveza Artesanal 500ml", price: 2800 },
];

const STATUSES = ["GENERATED", "PAID", "PROCESSING", "DELIVERED", "CANCELLED"] as const;
const NOTES = [
  "",
  "",
  "",
  "Sin cebolla",
  "Extra salsa",
  "Bien cocido",
  "Sin mayonesa",
  "Con extra queso",
  "",
  "Puerta negra",
  "Tocar timbre 2B",
  "",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateOrderItems() {
  const numItems = randInt(1, 4);
  const items: any[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < numItems; i++) {
    let item;
    do {
      item = pick(MENU_ITEMS);
    } while (usedIds.has(item.id));
    usedIds.add(item.id);

    const qty = item.price > 4000 ? randInt(1, 2) : randInt(1, 3);
    items.push({
      menuItemId: item.id,
      name: item.name,
      quantity: qty,
      unitPrice: item.price,
      total: item.price * qty,
    });
  }

  // 60% chance to add a drink
  if (Math.random() < 0.6 && !usedIds.has("item-10") && !usedIds.has("item-12")) {
    const drink = Math.random() < 0.5 ? MENU_ITEMS[9] : MENU_ITEMS[11];
    const qty = randInt(1, 3);
    items.push({
      menuItemId: drink.id,
      name: drink.name,
      quantity: qty,
      unitPrice: drink.price,
      total: drink.price * qty,
    });
  }

  // 40% chance to add papas
  if (Math.random() < 0.4 && !usedIds.has("item-8")) {
    items.push({
      menuItemId: "item-8",
      name: "Papas Fritas",
      quantity: 1,
      unitPrice: 2200,
      total: 2200,
    });
  }

  return items;
}

// Status distribution: most orders should be DELIVERED for past days
function getStatusForDate(daysAgo: number): typeof STATUSES[number] {
  if (daysAgo === 0) {
    // Today: mix of all statuses
    const r = Math.random();
    if (r < 0.15) return "GENERATED";
    if (r < 0.3) return "PAID";
    if (r < 0.45) return "PROCESSING";
    if (r < 0.92) return "DELIVERED";
    return "CANCELLED";
  }
  // Past days: mostly delivered
  const r = Math.random();
  if (r < 0.85) return "DELIVERED";
  if (r < 0.95) return "CANCELLED";
  return "PAID"; // some stragglers
}

// Generate realistic order times (lunch rush 12-14, dinner rush 20-23)
function getOrderHour(): number {
  const r = Math.random();
  if (r < 0.05) return randInt(10, 11);   // late morning
  if (r < 0.35) return randInt(12, 14);   // lunch rush
  if (r < 0.45) return randInt(15, 18);   // afternoon
  if (r < 0.85) return randInt(20, 23);   // dinner rush
  if (r < 0.95) return randInt(19, 19);   // early dinner
  return randInt(0, 2);                    // late night (counts as prev day)
}

// Orders per day varies: weekends are busier
function getOrderCount(dayOfWeek: number): number {
  // 0=Sun, 5=Fri, 6=Sat
  if (dayOfWeek === 5) return randInt(18, 28);  // Friday
  if (dayOfWeek === 6) return randInt(22, 35);  // Saturday
  if (dayOfWeek === 0) return randInt(15, 22);  // Sunday
  return randInt(8, 18);                         // Weekday
}

async function seed() {
  console.log("🌱 Seeding orders for Puerto Pachatas...\n");

  // Clear existing orders for this restaurant
  const deleted = await prisma.order.deleteMany({
    where: { restauranteSlug: SLUG },
  });
  console.log(`   Cleared ${deleted.count} existing orders\n`);

  const now = new Date();
  let totalOrders = 0;
  let totalRevenue = 0;

  // Generate 14 days of data
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const dayDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dayOfWeek = dayDate.getDay();
    const numOrders = getOrderCount(dayOfWeek);

    const dayLabel = dayDate.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    let dayRevenue = 0;

    for (let i = 0; i < numOrders; i++) {
      const customer = pick(CUSTOMERS);
      const items = generateOrderItems();
      const total = items.reduce((s: number, it: any) => s + it.total, 0);
      const status = getStatusForDate(daysAgo);
      const hour = getOrderHour();
      const minute = randInt(0, 59);

      // Create timestamp
      const orderDate = new Date(dayDate);
      // Set to AR time then convert to UTC
      orderDate.setUTCHours(hour + 3, minute, randInt(0, 59), 0);

      // If late night (0-2am), this was actually placed on this calendar day
      // but belongs to previous business day — the query logic handles this

      const lat = -31.5375 + (Math.random() - 0.5) * 0.05;
      const lng = -68.5364 + (Math.random() - 0.5) * 0.05;

      const mm = String(dayDate.getMonth() + 1).padStart(2, "0");
      const dd = String(dayDate.getDate()).padStart(2, "0");
      const seq = String(i + 1).padStart(3, "0");
      const orderNumber = `ORD-${mm}${dd}-${seq}`;

      await prisma.order.create({
        data: {
          orderNumber,
          restauranteSlug: SLUG,
          status: status as any,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          latitude: lat,
          longitude: lng,
          items: items as any,
          total,
          notes: pick(NOTES) || null,
          whatsappSent: status !== "GENERATED",
          createdAt: orderDate,
          updatedAt: orderDate,
        },
      });

      dayRevenue += total;
      totalOrders++;
    }

    totalRevenue += dayRevenue;
    console.log(`   ${dayLabel}: ${numOrders} pedidos — $${dayRevenue.toLocaleString("es-AR")}`);
  }

  console.log(`\n✅ Seeded ${totalOrders} orders — $${totalRevenue.toLocaleString("es-AR")} total revenue`);
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
