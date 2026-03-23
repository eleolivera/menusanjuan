// Seed script: npx tsx webapp/src/scripts/seed-restaurants.ts
// Imports demo restaurants into the DB with placeholder accounts + menus

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

const RESTAURANTS = [
  {
    name: "Puerto Pachatas",
    slug: "puerto-pachatas",
    description: "Los mejores lomitos y pachatas de San Juan. Carne a la parrilla, piadinas y más.",
    phone: "+5492645745818",
    address: "Av. Libertador 1200, Capital",
    cuisineType: "Comida Rápida",
    coverUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop",
    menu: [
      {
        name: "Lomitos Tradicionales", emoji: "🥖", items: [
          { name: "Lomito Completo", description: "Lomo, jamón, queso, huevo, lechuga, tomate y papas fritas.", price: 5500, imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop", badge: "Popular" },
          { name: "Lomito Simple", description: "Lomo a la plancha con lechuga, tomate y mayonesa.", price: 4200, imageUrl: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop" },
          { name: "Lomito Especial de la Casa", description: "Lomo, panceta crocante, cheddar, cebolla caramelizada y salsa BBQ.", price: 6800, imageUrl: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400&h=300&fit=crop", badge: "Especial" },
        ],
      },
      {
        name: "Pachatas Especiales", emoji: "🥪", items: [
          { name: "Pachata Clásica", description: "Carne de lomo a la parrilla con jamón, queso y verduras frescas.", price: 4500, imageUrl: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&h=300&fit=crop", badge: "Popular" },
          { name: "Pachata Criolla", description: "Carne, chimichurri, provoleta derretida y cebolla grillada.", price: 5200, imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Hamburguesas", emoji: "🍔", items: [
          { name: "Hamburguesa Clásica", description: "Medallón 200g, cheddar, lechuga, tomate, cebolla y pepino.", price: 4800, imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop" },
          { name: "Doble Smash Burger", description: "Doble medallón smash, doble cheddar, cebolla crispy y salsa especial.", price: 6200, imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=300&fit=crop", badge: "Nuevo" },
        ],
      },
      {
        name: "Acompañamientos", emoji: "🍟", items: [
          { name: "Papas Fritas", description: "Porción grande de papas fritas crocantes.", price: 2200, imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop" },
          { name: "Aros de Cebolla", description: "Aros de cebolla rebozados y fritos.", price: 2500, imageUrl: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Bebidas", emoji: "🥤", items: [
          { name: "Coca-Cola 500ml", description: "Coca-Cola línea completa.", price: 1200, imageUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=300&fit=crop" },
          { name: "Agua Mineral 500ml", description: "Con o sin gas.", price: 800, imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop" },
          { name: "Cerveza Artesanal 500ml", description: "Cerveza artesanal sanjuanina.", price: 2800, imageUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop" },
        ],
      },
    ],
  },
  {
    name: "La Estancia",
    slug: "la-estancia",
    description: "Parrilla tradicional argentina. Asado, vacío, entraña y los mejores cortes al carbón.",
    phone: "+5492644123456",
    address: "Calle Mendoza 450, Rivadavia",
    cuisineType: "Parrilla",
    coverUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop",
    menu: [
      {
        name: "Cortes de Carne", emoji: "🥩", items: [
          { name: "Asado de Tira", description: "Asado de tira a las brasas, cocción lenta.", price: 8500, badge: "Popular" },
          { name: "Vacío", description: "Vacío jugoso a punto, con chimichurri.", price: 7800 },
          { name: "Entraña", description: "Entraña a la parrilla con sal gruesa.", price: 8200 },
          { name: "Bife de Chorizo", description: "Corte grueso, punto a elección.", price: 9000, badge: "Especial" },
        ],
      },
      {
        name: "Empanadas", emoji: "🥟", items: [
          { name: "Empanada de Carne (x1)", description: "Carne cortada a cuchillo.", price: 900 },
          { name: "Empanada de Jamón y Queso (x1)", description: "Jamón y queso derretido.", price: 800 },
          { name: "Docena Mixta", description: "12 empanadas surtidas.", price: 9500, badge: "Popular" },
        ],
      },
      {
        name: "Guarniciones", emoji: "🥗", items: [
          { name: "Ensalada Mixta", description: "Lechuga, tomate, cebolla.", price: 2500 },
          { name: "Papas Fritas", description: "Porción grande.", price: 2200 },
          { name: "Provoleta", description: "Provolone a la parrilla con orégano.", price: 3500 },
        ],
      },
      {
        name: "Bebidas", emoji: "🍷", items: [
          { name: "Vino Tinto (botella)", description: "Malbec sanjuanino.", price: 5500 },
          { name: "Gaseosa 1.5L", description: "Coca-Cola, Sprite o Fanta.", price: 2000 },
          { name: "Agua Mineral 1L", description: "Con o sin gas.", price: 1200 },
        ],
      },
    ],
  },
  {
    name: "Napoli Pizza",
    slug: "napoli-pizza",
    description: "Pizza artesanal al horno de leña. Masa madre, ingredientes frescos y sabor italiano.",
    phone: "+5492644789012",
    address: "Av. San Martín 890, Capital",
    cuisineType: "Pizzería",
    coverUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=400&fit=crop",
    menu: [
      {
        name: "Pizzas Clásicas", emoji: "🍕", items: [
          { name: "Muzzarella", description: "Muzzarella, salsa de tomate, orégano.", price: 5500, badge: "Popular" },
          { name: "Napolitana", description: "Tomate, muzzarella, rodajas de tomate, ajo.", price: 6000 },
          { name: "Fugazzeta", description: "Cebolla, muzzarella, aceitunas.", price: 6200 },
          { name: "Jamón y Morrones", description: "Jamón cocido, morrones asados.", price: 6500 },
        ],
      },
      {
        name: "Pizzas Especiales", emoji: "⭐", items: [
          { name: "Cuatro Quesos", description: "Muzzarella, provolone, roquefort, parmesano.", price: 7500, badge: "Especial" },
          { name: "Rúcula y Parmesano", description: "Rúcula fresca, parmesano, aceite de oliva.", price: 7000 },
          { name: "Calabresa", description: "Longaniza calabresa, muzzarella, aceitunas negras.", price: 6800 },
        ],
      },
      {
        name: "Empanadas", emoji: "🥟", items: [
          { name: "Empanada de Carne", price: 900 },
          { name: "Empanada de Jamón y Queso", price: 800 },
          { name: "Empanada de Humita", price: 850 },
        ],
      },
      {
        name: "Bebidas", emoji: "🥤", items: [
          { name: "Cerveza Tirada (pinta)", price: 2800 },
          { name: "Gaseosa 1.5L", price: 2000 },
          { name: "Agua saborizada", price: 1500 },
        ],
      },
    ],
  },
  { name: "Café del Centro", slug: "cafe-del-centro", description: "Café de especialidad, medialunas artesanales, desayunos y meriendas.", phone: "+5492644567890", address: "Peatonal Tucumán 123, Capital", cuisineType: "Cafetería", coverUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=400&fit=crop", menu: [
    { name: "Cafetería", emoji: "☕", items: [
      { name: "Café con Leche", price: 1800 }, { name: "Cortado", price: 1500 }, { name: "Cappuccino", price: 2200 }, { name: "Latte", price: 2500, badge: "Popular" },
    ]},
    { name: "Desayunos", emoji: "🥐", items: [
      { name: "Medialunas (x3)", description: "De manteca, tibias.", price: 2000 }, { name: "Tostado Jamón y Queso", price: 3200 }, { name: "Desayuno Completo", description: "Café + medialunas + jugo.", price: 4500, badge: "Popular" },
    ]},
    { name: "Pastelería", emoji: "🍰", items: [
      { name: "Torta de Chocolate", price: 3500 }, { name: "Cheesecake", price: 3800 }, { name: "Alfajor Artesanal", price: 1200 },
    ]},
  ]},
  { name: "Sushi San Juan", slug: "sushi-san-juan", description: "Rolls, nigiris y combinados. Fusión japonesa-argentina.", phone: "+5492644345678", address: "Calle Aberastain 600, Capital", cuisineType: "Sushi", coverUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=400&fit=crop", menu: [
    { name: "Rolls Clásicos", emoji: "🍣", items: [
      { name: "Philadelphia Roll (10u)", description: "Salmón, queso crema, palta.", price: 6500, badge: "Popular" }, { name: "California Roll (10u)", description: "Kanikama, palta, pepino.", price: 5500 }, { name: "Tempura Roll (10u)", description: "Langostino tempura, palta.", price: 7200 },
    ]},
    { name: "Rolls Especiales", emoji: "⭐", items: [
      { name: "Dragon Roll (10u)", description: "Langostino, palta, salsa teriyaki.", price: 8500, badge: "Especial" }, { name: "Salmón Skin Roll (10u)", description: "Piel de salmón crocante, queso.", price: 7000 },
    ]},
    { name: "Combinados", emoji: "🎌", items: [
      { name: "Combo 20 Piezas", description: "Mix de rolls a elección.", price: 11000 }, { name: "Combo 40 Piezas", description: "Para compartir.", price: 19500, badge: "Popular" },
    ]},
    { name: "Bebidas", emoji: "🍶", items: [
      { name: "Sake (copa)", price: 3500 }, { name: "Cerveza Japonesa", price: 3200 }, { name: "Limonada", price: 1800 },
    ]},
  ]},
  { name: "Don Raúl Empanadas", slug: "don-raul-empanadas", description: "Empanadas sanjuaninas de horno de barro. Carne, pollo, jamón y queso.", phone: "+5492644234567", address: "Av. Rawson 1500, Rawson", cuisineType: "Empanadas", coverUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=400&fit=crop", menu: [
    { name: "Empanadas", emoji: "🥟", items: [
      { name: "Carne (x1)", description: "Carne cortada a cuchillo, horno de barro.", price: 950, badge: "Popular" }, { name: "Pollo (x1)", price: 900 }, { name: "Jamón y Queso (x1)", price: 850 }, { name: "Humita (x1)", price: 850 }, { name: "Verdura (x1)", price: 800 }, { name: "Docena Surtida", description: "12 empanadas a elección.", price: 10000, badge: "Popular" },
    ]},
    { name: "Bebidas", emoji: "🥤", items: [
      { name: "Gaseosa 500ml", price: 1200 }, { name: "Agua", price: 800 },
    ]},
  ]},
  { name: "Mamma Pasta", slug: "mamma-pasta", description: "Pastas caseras: ravioles, ñoquis, tallarines y lasagna con salsas artesanales.", phone: "+5492644876543", address: "Calle España 320, Chimbas", cuisineType: "Pastas", coverUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=400&fit=crop", menu: [
    { name: "Pastas", emoji: "🍝", items: [
      { name: "Ravioles de Ricota", description: "Con salsa bolognesa o filetto.", price: 5500, badge: "Popular" }, { name: "Ñoquis", description: "De papa, con salsa a elección.", price: 4800 }, { name: "Tallarines", description: "Al huevo, frescos.", price: 4500 }, { name: "Lasagna", description: "Capas de pasta, carne, bechamel.", price: 6500, badge: "Especial" },
    ]},
    { name: "Salsas", emoji: "🫕", items: [
      { name: "Bolognesa", price: 0, description: "Incluida" }, { name: "Filetto", price: 0, description: "Incluida" }, { name: "Pesto", price: 500, description: "Adicional" }, { name: "Cuatro Quesos", price: 700, description: "Adicional" },
    ]},
    { name: "Bebidas", emoji: "🍷", items: [
      { name: "Vino de la casa (copa)", price: 2500 }, { name: "Gaseosa 1.5L", price: 2000 }, { name: "Agua", price: 1000 },
    ]},
  ]},
  { name: "Helados del Sol", slug: "helados-del-sol", description: "Helado artesanal con ingredientes naturales. Más de 30 sabores.", phone: "+5492644654321", address: "Av. Ignacio de la Roza 800, Capital", cuisineType: "Heladería", coverUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=800&h=400&fit=crop", menu: [
    { name: "Helados", emoji: "🍦", items: [
      { name: "1/4 kg", description: "2 gustos.", price: 3000 }, { name: "1/2 kg", description: "3 gustos.", price: 5200, badge: "Popular" }, { name: "1 kg", description: "4 gustos.", price: 9500 }, { name: "Cucurucho Simple", price: 2200 }, { name: "Cucurucho Doble", price: 3500 },
    ]},
    { name: "Postres", emoji: "🍨", items: [
      { name: "Banana Split", price: 5500, badge: "Especial" }, { name: "Sundae", description: "Helado + salsa + crema.", price: 4500 }, { name: "Milkshake", price: 4000 },
    ]},
  ]},
  { name: "El Fogón Criollo", slug: "el-fogon-criollo", description: "Comida criolla de San Juan. Locro, carbonada, humita y platos tradicionales.", phone: "+5492644111222", address: "Ruta 40 km 5, Pocito", cuisineType: "Parrilla", coverUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop", menu: [
    { name: "Platos Criollos", emoji: "🍲", items: [
      { name: "Locro", description: "Guiso tradicional con maíz, porotos, chorizo.", price: 5500, badge: "Popular" }, { name: "Carbonada", description: "Guiso con carne, zapallo, choclo.", price: 5200 }, { name: "Humita en Chala", description: "Choclo rallado cocido en chala.", price: 3500 }, { name: "Tamales (x2)", price: 3000 },
    ]},
    { name: "Parrilla", emoji: "🥩", items: [
      { name: "Asado con Cuero", description: "Cocción lenta al asador.", price: 9500, badge: "Especial" }, { name: "Chivito al Asador", description: "Chivito sanjuanino.", price: 11000 }, { name: "Costillar", price: 8500 },
    ]},
    { name: "Bebidas", emoji: "🧉", items: [
      { name: "Vino Patero", description: "Vino artesanal sanjuanino.", price: 4000 }, { name: "Gaseosa 1.5L", price: 2000 }, { name: "Jarra de Clericó", price: 5500 },
    ]},
  ]},
];

async function seed() {
  console.log("🍽️  Importing restaurants into database...\n");

  const defaultPassword = hashPassword("menusj2024");
  const defaultHours = JSON.stringify({
    lun: { open: "08:00", close: "23:00", closed: false },
    mar: { open: "08:00", close: "23:00", closed: false },
    mie: { open: "08:00", close: "23:00", closed: false },
    jue: { open: "08:00", close: "23:00", closed: false },
    vie: { open: "08:00", close: "01:00", closed: false },
    sab: { open: "10:00", close: "01:00", closed: false },
    dom: { open: "10:00", close: "23:00", closed: false },
  });

  for (const r of RESTAURANTS) {
    // Check if already exists
    const existing = await prisma.dealer.findUnique({ where: { slug: r.slug } });
    if (existing) {
      console.log(`   ⏭️  ${r.name} already exists, skipping`);
      continue;
    }

    // Create placeholder user
    const email = `${r.slug}@menusanjuan.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password: defaultPassword,
        name: r.name,
        phone: r.phone,
      },
    });

    const account = await prisma.account.create({
      data: { userId: user.id, type: "dealer" },
    });

    const dealer = await prisma.dealer.create({
      data: {
        accountId: account.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        phone: r.phone,
        address: r.address,
        cuisineType: r.cuisineType,
        coverUrl: r.coverUrl,
        openHours: defaultHours,
      },
    });

    // Create menu
    let totalItems = 0;
    if (r.menu) {
      for (let ci = 0; ci < r.menu.length; ci++) {
        const cat = r.menu[ci];
        const category = await prisma.menuCategory.create({
          data: {
            dealerId: dealer.id,
            name: cat.name,
            emoji: cat.emoji || null,
            sortOrder: ci,
          },
        });

        if (cat.items) {
          for (let ii = 0; ii < cat.items.length; ii++) {
            const item = cat.items[ii];
            await prisma.menuItem.create({
              data: {
                categoryId: category.id,
                name: item.name,
                description: (item as any).description || null,
                price: item.price,
                imageUrl: (item as any).imageUrl || null,
                badge: (item as any).badge || null,
                available: true,
                sortOrder: ii,
              },
            });
            totalItems++;
          }
        }
      }
    }

    console.log(`   ✅ ${r.name} — ${r.menu?.length || 0} categorías, ${totalItems} items (${email})`);
  }

  console.log("\n✅ All restaurants imported!");
  console.log("   Placeholder login: {slug}@menusanjuan.com / menusj2024");
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
