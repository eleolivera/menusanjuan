#!/usr/bin/env npx tsx
/**
 * MenuSanJuan MCP Server
 *
 * Gives AI agents (Cowork, Claude Code) direct access to:
 * - Database: query/create/update restaurants, menus, users
 * - R2: upload images from URLs
 * - Google Places: fetch restaurant photos
 *
 * Run: npx tsx mcp/server.ts
 * Configure in Claude Code: settings → MCP servers
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname2 = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, ".env") });

// ── DB ──
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

async function query(sql: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res;
  } finally {
    client.release();
  }
}

// ── R2 ──
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});
const BUCKET = process.env.R2_BUCKET || "menusanjuan-images";
const R2_URL = process.env.R2_PUBLIC_URL || "https://images.menusanjuan.com";

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${R2_URL}/${key}`;
}

async function downloadAndUpload(imageUrl: string, key: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return uploadToR2(buffer, key, contentType);
}

// ── Helpers ──
function makeSlug(name: string): string {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

function cuid(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── MCP Server ──
const server = new McpServer({
  name: "menusanjuan",
  version: "1.0.0",
});

// ═══════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════

// ── List restaurants ──
server.tool(
  "list_restaurants",
  "List all restaurants in the database. Returns name, slug, cuisineType, isActive, isVerified, itemCount, rating.",
  { active_only: z.boolean().optional().describe("Only show active restaurants (default: false)"), limit: z.number().optional().describe("Max results (default: 50)") },
  async ({ active_only, limit }) => {
    const where = active_only ? 'WHERE d."isActive" = true' : "";
    const res = await query(`
      SELECT d.id, d.name, d.slug, d."cuisineType", d."isActive", d."isVerified", d.rating, d."logoUrl", d."coverUrl", d.phone, d.address,
        d."sourceProfileId", d."sourceSite",
        (SELECT count(*) FROM "MenuItem" mi JOIN "MenuCategory" mc ON mi."categoryId" = mc.id WHERE mc."dealerId" = d.id) as "itemCount"
      FROM "Dealer" d ${where}
      ORDER BY d.name ASC LIMIT $1
    `, [limit || 50]);
    return { content: [{ type: "text", text: JSON.stringify(res.rows, null, 2) }] };
  }
);

// ── Get restaurant details ──
server.tool(
  "get_restaurant",
  "Get full details of a restaurant by slug or ID, including menu categories and items.",
  { slug: z.string().optional(), id: z.string().optional() },
  async ({ slug, id }) => {
    const dealer = slug
      ? (await query('SELECT * FROM "Dealer" WHERE slug = $1', [slug])).rows[0]
      : (await query('SELECT * FROM "Dealer" WHERE id = $1', [id])).rows[0];
    if (!dealer) return { content: [{ type: "text", text: "Restaurant not found" }] };

    const categories = (await query(
      'SELECT * FROM "MenuCategory" WHERE "dealerId" = $1 ORDER BY "sortOrder"', [dealer.id]
    )).rows;

    for (const cat of categories) {
      cat.items = (await query(
        'SELECT * FROM "MenuItem" WHERE "categoryId" = $1 ORDER BY "sortOrder"', [cat.id]
      )).rows;
    }

    return { content: [{ type: "text", text: JSON.stringify({ ...dealer, categories }, null, 2) }] };
  }
);

// ── Create restaurant ──
server.tool(
  "create_restaurant",
  "Create a new restaurant with a placeholder owner account. Returns the created restaurant.",
  {
    name: z.string().describe("Restaurant name"),
    phone: z.string().optional().describe("WhatsApp number (default: 0000000000)"),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    cuisineType: z.string().optional().describe("e.g. Comida Rápida, Parrilla, Pizzería, Sushi"),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    coverUrl: z.string().optional(),
    sourceProfileId: z.string().optional().describe("ID from source (e.g. PedidosYa vendor ID)"),
    sourceSite: z.string().optional().describe("Source: pedidosya, google-maps, manual"),
    rating: z.number().optional().describe("Star rating 1.0-5.0"),
  },
  async (args) => {
    const slug = makeSlug(args.name);

    // Check exists
    const existing = (await query('SELECT id FROM "Dealer" WHERE slug = $1', [slug])).rows[0];
    if (existing) return { content: [{ type: "text", text: `Restaurant "${args.name}" already exists with slug /${slug}` }] };

    const userId = cuid();
    const accountId = cuid();
    const dealerId = cuid();
    const email = `${slug}@menusanjuan.com`;

    await query('INSERT INTO "User" (id, email, password, name, phone, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
      [userId, email, hashPassword("menusj2024"), args.name, args.phone || "0000000000"]);

    await query('INSERT INTO "Account" (id, "userId", type, "createdAt") VALUES ($1, $2, $3, NOW())',
      [accountId, userId, "dealer"]);

    await query(`INSERT INTO "Dealer" (id, "accountId", name, slug, phone, address, latitude, longitude, "cuisineType", description, "logoUrl", "coverUrl", "isActive", "sourceProfileId", "sourceSite", rating, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, $14, $15, NOW(), NOW())`,
      [dealerId, accountId, args.name, slug, args.phone || "0000000000", args.address || null,
       args.latitude || null, args.longitude || null, args.cuisineType || "General",
       args.description || null, args.logoUrl || null, args.coverUrl || null,
       args.sourceProfileId || null, args.sourceSite || null, args.rating || null]);

    return { content: [{ type: "text", text: JSON.stringify({ id: dealerId, slug, email, name: args.name, message: "Created (inactive). Activate via admin or set isActive=true." }, null, 2) }] };
  }
);

// ── Update restaurant ──
server.tool(
  "update_restaurant",
  "Update restaurant fields by slug or ID.",
  {
    slug: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    cuisineType: z.string().optional(),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    coverUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    rating: z.number().optional(),
    deliveryFee: z.number().optional(),
  },
  async (args) => {
    const { slug, id, ...fields } = args;
    const dealer = slug
      ? (await query('SELECT id FROM "Dealer" WHERE slug = $1', [slug])).rows[0]
      : (await query('SELECT id FROM "Dealer" WHERE id = $1', [id])).rows[0];
    if (!dealer) return { content: [{ type: "text", text: "Restaurant not found" }] };

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        const col = key === "cuisineType" ? '"cuisineType"' : key === "isActive" ? '"isActive"' : key === "isVerified" ? '"isVerified"' : key === "logoUrl" ? '"logoUrl"' : key === "coverUrl" ? '"coverUrl"' : key === "deliveryFee" ? '"deliveryFee"' : `"${key}"`;
        sets.push(`${col} = $${i}`);
        vals.push(val);
        i++;
      }
    }
    if (sets.length === 0) return { content: [{ type: "text", text: "No fields to update" }] };
    sets.push(`"updatedAt" = NOW()`);
    vals.push(dealer.id);

    await query(`UPDATE "Dealer" SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { content: [{ type: "text", text: `Updated restaurant ${slug || id}` }] };
  }
);

// ── Add menu category ──
server.tool(
  "add_menu_category",
  "Add a menu category to a restaurant.",
  {
    restaurant_slug: z.string().describe("Restaurant slug"),
    name: z.string().describe("Category name (e.g. Hamburguesas, Bebidas)"),
    emoji: z.string().optional().describe("Emoji icon (e.g. 🍔)"),
  },
  async ({ restaurant_slug, name, emoji }) => {
    const dealer = (await query('SELECT id FROM "Dealer" WHERE slug = $1', [restaurant_slug])).rows[0];
    if (!dealer) return { content: [{ type: "text", text: "Restaurant not found" }] };

    const maxSort = (await query('SELECT COALESCE(MAX("sortOrder"), -1) as max FROM "MenuCategory" WHERE "dealerId" = $1', [dealer.id])).rows[0];
    const catId = cuid();
    await query('INSERT INTO "MenuCategory" (id, "dealerId", name, emoji, "sortOrder") VALUES ($1, $2, $3, $4, $5)',
      [catId, dealer.id, name, emoji || null, (maxSort.max || 0) + 1]);

    return { content: [{ type: "text", text: JSON.stringify({ id: catId, name, emoji }, null, 2) }] };
  }
);

// ── Add menu item ──
server.tool(
  "add_menu_item",
  "Add a menu item to a category.",
  {
    category_id: z.string().describe("Category ID"),
    name: z.string().describe("Item name"),
    price: z.number().describe("Price in ARS"),
    description: z.string().optional(),
    image_url: z.string().optional().describe("Image URL (will be used as-is)"),
    badge: z.string().optional().describe("e.g. Popular, Nuevo"),
  },
  async ({ category_id, name, price, description, image_url, badge }) => {
    const maxSort = (await query('SELECT COALESCE(MAX("sortOrder"), -1) as max FROM "MenuItem" WHERE "categoryId" = $1', [category_id])).rows[0];
    const itemId = cuid();
    await query('INSERT INTO "MenuItem" (id, "categoryId", name, description, price, "imageUrl", badge, available, "sortOrder") VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)',
      [itemId, category_id, name, description || null, price, image_url || null, badge || null, (maxSort.max || 0) + 1]);

    return { content: [{ type: "text", text: JSON.stringify({ id: itemId, name, price }, null, 2) }] };
  }
);

// ── Upload image to R2 ──
server.tool(
  "upload_image_from_url",
  "Download an image from a URL and upload it to our R2 CDN. Returns the permanent images.menusanjuan.com URL.",
  {
    source_url: z.string().describe("URL to download the image from"),
    key: z.string().describe("R2 storage key, e.g. 'restaurant-slug/logo.jpg' or 'restaurant-slug/items/item-name.jpg'"),
  },
  async ({ source_url, key }) => {
    try {
      const url = await downloadAndUpload(source_url, key);
      return { content: [{ type: "text", text: `Uploaded: ${url}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Upload failed: ${err.message}` }] };
    }
  }
);

// ── Upload image and update restaurant ──
server.tool(
  "set_restaurant_image",
  "Download an image from URL, upload to R2, and set it as the restaurant's logo or cover.",
  {
    restaurant_slug: z.string(),
    type: z.enum(["logo", "cover"]).describe("logo or cover"),
    source_url: z.string().describe("Image URL to download"),
  },
  async ({ restaurant_slug, type, source_url }) => {
    try {
      const ext = source_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[1] || "jpg";
      const key = `${restaurant_slug}/${type}.${ext}`;
      const url = await downloadAndUpload(source_url, key);
      const col = type === "logo" ? '"logoUrl"' : '"coverUrl"';
      await query(`UPDATE "Dealer" SET ${col} = $1, "updatedAt" = NOW() WHERE slug = $2`, [url, restaurant_slug]);
      return { content: [{ type: "text", text: `Set ${type} for /${restaurant_slug}: ${url}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Failed: ${err.message}` }] };
    }
  }
);

// ── Run SQL query ──
server.tool(
  "run_sql",
  "Run a raw SQL query against the MenuSanJuan database. Use for complex queries, bulk updates, or anything the other tools don't cover. Be careful with mutations.",
  {
    sql: z.string().describe("SQL query to execute"),
    params: z.array(z.any()).optional().describe("Query parameters ($1, $2, etc.)"),
  },
  async ({ sql, params }) => {
    try {
      const res = await query(sql, params || []);
      return { content: [{ type: "text", text: JSON.stringify({ rowCount: res.rowCount, rows: res.rows?.slice(0, 100) }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `SQL error: ${err.message}` }] };
    }
  }
);

// ── Activate restaurant ──
server.tool(
  "activate_restaurant",
  "Set a restaurant as active (visible on the site) and optionally set its rating.",
  {
    slug: z.string(),
    rating: z.number().optional().describe("Star rating 1.0-5.0 (default: 4.7)"),
  },
  async ({ slug, rating }) => {
    const res = await query('UPDATE "Dealer" SET "isActive" = true, rating = $1, "updatedAt" = NOW() WHERE slug = $2 RETURNING name', [rating || 4.7, slug]);
    if (res.rowCount === 0) return { content: [{ type: "text", text: "Restaurant not found" }] };
    return { content: [{ type: "text", text: `Activated: ${res.rows[0].name} (/${slug}) with ${rating || 4.7} stars` }] };
  }
);

// ── Bulk import from PedidosYa JSON ──
server.tool(
  "import_pedidosya_menu",
  "Import a PedidosYa menu JSON (sections with products) into an existing restaurant. Pass the raw JSON from the /v2/niles/partners/{id}/menus endpoint.",
  {
    restaurant_slug: z.string().describe("Target restaurant slug"),
    menu_json: z.string().describe("Raw JSON string from PedidosYa menus endpoint"),
  },
  async ({ restaurant_slug, menu_json }) => {
    const dealer = (await query('SELECT id FROM "Dealer" WHERE slug = $1', [restaurant_slug])).rows[0];
    if (!dealer) return { content: [{ type: "text", text: "Restaurant not found" }] };

    const menu = JSON.parse(menu_json);
    const sections = menu.sections || [];
    let totalItems = 0;

    const emojiMap: Record<string, string> = {
      hambur: "🍔", burger: "🍔", pizza: "🍕", empanada: "🥟", pasta: "🍝", tallarin: "🍝",
      sushi: "🍣", roll: "🍣", helad: "🍦", bebid: "🥤", gaseosa: "🥤", postre: "🍰",
      torta: "🍰", café: "☕", cafe: "☕", ensalad: "🥗", papa: "🍟", pollo: "🍗",
      milanes: "🍗", carne: "🥩", parrilla: "🥩", sandwich: "🥖", lomito: "🥖",
      combo: "⭐", promo: "⭐", wrap: "🌯", poke: "🥗", bowl: "🥗",
    };

    function getEmoji(name: string): string {
      const n = name.toLowerCase();
      for (const [key, emoji] of Object.entries(emojiMap)) {
        if (n.includes(key)) return emoji;
      }
      return "🍽️";
    }

    for (let ci = 0; ci < sections.length; ci++) {
      const section = sections[ci];
      const products = (section.products || []).filter((p: any) => p.enabled !== false);
      if (products.length === 0) continue;

      const catId = cuid();
      await query('INSERT INTO "MenuCategory" (id, "dealerId", name, emoji, "sortOrder") VALUES ($1, $2, $3, $4, $5)',
        [catId, dealer.id, section.name, getEmoji(section.name), ci]);

      for (let pi = 0; pi < products.length; pi++) {
        const p = products[pi];
        const price = p.price?.finalPrice || 0;
        const imgUuid = p.images?.urls?.[0];
        const badge = p.tags?.isMostOrdered ? "Popular" : null;
        const itemId = cuid();

        // Download image to R2 instead of using PedidosYa CDN URL
        let imageUrl: string | null = null;
        if (imgUuid) {
          const peyaUrl = `https://pedidosya.dhmedia.io/image/pedidosya/products/${imgUuid}${imgUuid.includes('.') ? '' : '.jpg'}?quality=90&width=400`;
          try {
            const key = `${restaurant_slug}/items/${itemId}.jpg`;
            imageUrl = await downloadAndUpload(peyaUrl, key);
          } catch {
            imageUrl = peyaUrl; // Fallback to CDN URL if download fails
          }
        }

        await query('INSERT INTO "MenuItem" (id, "categoryId", name, description, price, "imageUrl", badge, available, "sortOrder") VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)',
          [itemId, catId, p.name, p.description || null, price, imageUrl, badge, pi]);
        totalItems++;
      }
    }

    return { content: [{ type: "text", text: `Imported ${sections.length} categories, ${totalItems} items into /${restaurant_slug}` }] };
  }
);

// ── Google Places photo ──
server.tool(
  "fetch_google_cover",
  "Search Google Places for a restaurant and set its photo as the cover image.",
  {
    restaurant_slug: z.string(),
    search_name: z.string().optional().describe("Search query (default: restaurant name + San Juan Argentina)"),
  },
  async ({ restaurant_slug, search_name }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { content: [{ type: "text", text: "GOOGLE_MAPS_API_KEY not set" }] };

    const dealer = (await query('SELECT id, name FROM "Dealer" WHERE slug = $1', [restaurant_slug])).rows[0];
    if (!dealer) return { content: [{ type: "text", text: "Restaurant not found" }] };

    const searchQuery = encodeURIComponent(search_name || `${dealer.name} restaurante San Juan Argentina`);
    const findRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=photos&key=${apiKey}`);
    const findData = await findRes.json();
    const photoRef = findData.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) return { content: [{ type: "text", text: "No Google Places photo found" }] };

    const photoRes = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`);
    if (!photoRes.ok) return { content: [{ type: "text", text: "Photo download failed" }] };

    const buffer = Buffer.from(await photoRes.arrayBuffer());
    const key = `${restaurant_slug}/cover-google.jpg`;
    const url = await uploadToR2(buffer, key, "image/jpeg");
    await query('UPDATE "Dealer" SET "coverUrl" = $1, "updatedAt" = NOW() WHERE slug = $2', [url, restaurant_slug]);

    return { content: [{ type: "text", text: `Set Google Places cover for /${restaurant_slug}: ${url}` }] };
  }
);

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
