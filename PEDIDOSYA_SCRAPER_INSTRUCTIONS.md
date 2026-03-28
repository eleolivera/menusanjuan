# PedidosYa → MenuSanJuan — Knowledge Transfer

## Purpose

Extract restaurant data (names, menus, prices, images, locations) from PedidosYa for San Juan, Argentina and import it into MenuSanJuan's database. Restaurants are created as inactive with placeholder accounts — admin reviews and activates them.

**Current status:** 227 vendors scraped, 52 menus downloaded, 29 imported with full menus + images migrated to R2.

---

## How PedidosYa works (what we learned)

### Bot protection
PedidosYa uses **PerimeterX** (bot detection) + **Cloudflare** (WAF/challenge). This means:

- **Playwright/Puppeteer don't work** — PerimeterX fingerprints the browser and blocks automation. We tried stealth plugins, persistent contexts, real Chrome profiles — all detected.
- **Direct API calls don't work** — Cloudflare issues a JavaScript challenge that curl can't solve.
- **Cookie-based curl DOES work** — if you copy cookies from a real browser session. The key cookies are `cf_clearance` (Cloudflare challenge pass), `_px3` (PerimeterX token), and `__Secure-peya.sid` / `__Secure-peya.who` (PedidosYa session).

### Cookie lifetime
- `cf_clearance`: ~30 minutes
- `_px3`: ~30 minutes
- `__Secure-peya.who`: ~2 hours (JWT with `exp` field)
- **Practical limit:** ~30 minutes per cookie session before 403

### Best time to scrape
- **Friday/Saturday 9pm-12am** — most restaurants are open, so menus return full data
- Closed restaurants may return empty sections or 404

---

## The two APIs

### 1. Vendor list (who's on PedidosYa in San Juan)

**Endpoint:** `POST https://www.pedidosya.com.ar/v4/shoplist/vendors`

**Important:** This is a POST, not GET. The older v1 endpoint (`/v1/food-home/v1/vendors`) also works but returns less data.

**Request body:**
```json
{
  "filters": {},
  "businessTypes": ["RESTAURANT"],
  "countryId": 3,
  "point": {
    "latitude": -31.5364202,
    "longitude": -68.5159897
  },
  "sort": "RELEVANCE",
  "offer": false,
  "size": 30,
  "page": 0
}
```

- Increment `page` for pagination (0, 1, 2... until empty response)
- `point` is San Juan coordinates — changing this changes which restaurants appear
- `size: 30` is the max per page

**Response structure (v4):**
```json
{
  "data": {
    "items": [
      {
        "id": 550595,
        "name": "Agape Comidas",
        "link": "agape-comidas-xxx",
        "logo": "logo-uuid.jpg",
        "location": { "latitude": -31.51658, "longitude": -68.58411 },
        "mainFoodCategories": [{ "name": "Hamburguesas" }]
      }
    ]
  }
}
```

Key fields per vendor:
| Field | Description |
|-------|-------------|
| `id` | PedidosYa vendor ID — used to fetch menu |
| `name` | Restaurant display name (may have location suffix like "- Rivadavia") |
| `link` | URL slug on PedidosYa |
| `logo` | UUID for logo image: `https://pedidosya.dhmedia.io/image/pedidosya/restaurants/{logo}` |
| `location.latitude/longitude` | GPS coordinates |
| `mainFoodCategories[0].name` | Primary cuisine type |

**We saved this as:** `vendors-full.json` — a flat array of all vendor objects (227 total).

### 2. Menu for each restaurant

**Endpoint:** `GET https://www.pedidosya.com.ar/v2/niles/partners/{vendorId}/menus?occasion=DELIVERY`

**Response structure:**
```json
{
  "sections": [
    {
      "name": "Milanesas",
      "products": [
        {
          "name": "Milanesa napolitana",
          "description": "Con salsa de tomate y queso.",
          "price": { "finalPrice": 17500.00 },
          "images": { "urls": ["b5fdc630-xxxx.jpeg"] },
          "tags": { "isMostOrdered": true },
          "enabled": true
        }
      ]
    }
  ]
}
```

Key fields per product:
| Field | Use |
|-------|-----|
| `name` | Item name |
| `description` | Optional description |
| `price.finalPrice` | Price in ARS |
| `images.urls[0]` | Image UUID → `https://pedidosya.dhmedia.io/image/pedidosya/products/{uuid}.jpg?quality=90&width=400` |
| `tags.isMostOrdered` | If `true`, we set `badge: "Popular"` |
| `enabled` | If `false`, skip this item |

**We saved each as:** `menu-{vendorId}.json`

---

## How to get the data (for Cowork / manual)

### Method: Browser + DevTools (recommended)

This is the safest approach — no bot detection because you're using a real browser.

#### Step 1: Get the vendor list

1. Open Chrome, go to `pedidosya.com.ar`
2. Log in with a real account
3. Navigate to **Restaurantes** in San Juan
4. Open DevTools (`Cmd+Option+I`) → **Network** tab → filter by `Fetch/XHR`
5. Look for the request to `/v4/shoplist/vendors` or `/v1/food-home/v1/vendors`
6. **Scroll down** to load more restaurants — each scroll triggers a new page request
7. For each response: right-click → **Copy response**
8. Save all vendor data into a single file: `vendors-full.json` (flat array of all vendor objects)

**Alternative (single page):** If using the v1 endpoint, it paginates with `offset` param. Copy each page's `data` array and merge them.

#### Step 2: Get each restaurant's menu

For each vendor ID from step 1:

1. Navigate to the restaurant's page on PedidosYa: `pedidosya.com.ar/restaurantes/san-juan/{link}-menu`
2. In DevTools Network tab, filter by `menus`
3. Find the request to `/v2/niles/partners/{id}/menus?occasion=DELIVERY`
4. Right-click the response → **Copy response**
5. Save as `menu-{id}.json`

**This is the slow part.** Each restaurant requires navigating to its page. With 200+ restaurants, this takes time. Tips:
- Do it in batches of 20-30
- Best done Friday/Saturday evening when restaurants are open
- Closed restaurants may return empty `sections: []`
- You can skip those and retry when they're open

#### Step 3: Get cookies for the automated scraper (optional)

If you want to use the automated scraper instead of copying each menu manually:

1. On any restaurant page in PedidosYa, open DevTools → Network
2. Find any `/v2/niles/partners/` request that returned **200**
3. Right-click → **Copy as cURL**
4. Extract the `cookie:` header value
5. Paste into `scraper/cookies.txt` (single line, no newlines)
6. Run: `cd /path/to/manu-san-juan && npx tsx scraper/pedidosya-scraper.ts`
7. When cookies expire (~30 min), get fresh ones and run again — it resumes automatically

---

## Cookie format

The `scraper/cookies.txt` file should be a **single line** with all cookies separated by `;`. Example:

```
_pxhd=xxx; dhhPerseusSessionId=xxx; __Secure-peya.sid=xxx; __Secure-peya.who=xxx; cf_clearance=xxx; _px3=xxx; dhhPerseusHitId=xxx
```

**Critical cookies:**
| Cookie | Purpose | Expires |
|--------|---------|---------|
| `cf_clearance` | Cloudflare challenge pass | ~30 min |
| `_px3` | PerimeterX bot check token | ~30 min |
| `__Secure-peya.sid` | PedidosYa session ID | ~2 hours |
| `__Secure-peya.who` | JWT with user identity | ~2 hours |
| `_pxhd` | PerimeterX device fingerprint | Long-lived |
| `dhhPerseusHitId` | Analytics tracking | Per-session |

If you get `403`, the cookies expired. Get fresh ones.

---

## Required headers

When making curl requests, these headers are required to avoid detection:

```
user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36
accept: application/json, text/plain, */*
referer: https://www.pedidosya.com.ar/restaurantes/san-juan/{restaurant-link}-menu
sec-ch-ua-mobile: ?1
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-platform: "Android"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin
```

The `referer` should match the restaurant page you're fetching the menu for. The mobile user-agent matches what DevTools device emulation sends.

---

## Field mapping: PedidosYa → MenuSanJuan

### Vendor → Dealer (Restaurant)

| PedidosYa | MenuSanJuan field | Notes |
|-----------|-------------------|-------|
| `id` | `sourceProfileId` | Store as string |
| — | `sourceSite` | Always `"pedidosya"` |
| `name` | `name` | Strip location suffixes (e.g., "- San Juan", "- Rivadavia") |
| `location.latitude` | `latitude` | Direct |
| `location.longitude` | `longitude` | Direct |
| `logo` | `logoUrl` | Build URL: `https://pedidosya.dhmedia.io/image/pedidosya/restaurants/{logo}` |
| — | `coverUrl` | Not available from PedidosYa. Use Google Places photo instead. |
| — | `phone` | Not available. Use placeholder `"0000000000"` |
| — | `address` | Not available from v4 API (v1 has it). Set null. |
| `mainFoodCategories[0].name` | `cuisineType` | Map to our types (see cuisine mapping below) |
| — | `isActive` | Always `false` — admin activates after review |
| — | `isVerified` | Always `false` — admin verifies when onboarding owner |

### Menu Section → MenuCategory

| PedidosYa | MenuSanJuan field | Notes |
|-----------|-------------------|-------|
| `sections[].name` | `name` | Direct |
| — | `emoji` | Auto-assign based on category name (see emoji table below) |
| array index | `sortOrder` | Preserve order from PedidosYa |

### Product → MenuItem

| PedidosYa | MenuSanJuan field | Notes |
|-----------|-------------------|-------|
| `products[].name` | `name` | Direct |
| `products[].description` | `description` | Can be null |
| `products[].price.finalPrice` | `price` | Number (ARS) |
| `products[].images.urls[0]` | `imageUrl` | Build URL: `https://pedidosya.dhmedia.io/image/pedidosya/products/{uuid}.jpg?quality=90&width=400`. **Must migrate to R2 ASAP — PedidosYa URLs expire.** |
| `products[].tags.isMostOrdered` | `badge` | If `true` → `"Popular"` |
| `products[].enabled` | — | Skip items with `enabled: false` |
| array index | `sortOrder` | Preserve order |

---

## Cuisine type mapping

```
PedidosYa category → MenuSanJuan cuisineType
─────────────────────────────────────────────
sushi, japon         → Sushi
pizza                → Pizzería
hambur, burger       → Comida Rápida
empanada             → Empanadas
helad, ice           → Heladería
café, cafe, coffee   → Cafetería
pasta, italian       → Pastas
parrilla, asado      → Parrilla
poke, salad, veg     → Vegetariano
postre, pastel       → Postres
árabe, arab          → Comida Árabe
mexic                → Comida Mexicana
china, chino, wok    → Comida China
(default)            → Comida Rápida
```

## Emoji mapping for categories

```
Category name contains → Emoji
───────────────────────────────
hambur, burger          → 🍔
pizza                   → 🍕
empanada                → 🥟
pasta, tallarin, ñoqui  → 🍝
sushi, roll             → 🍣
helad                   → 🍦
bebid, gaseosa, agua    → 🥤
postre, torta, cake     → 🍰
café, desayuno          → ☕
ensalad                 → 🥗
papa, guarnicion        → 🍟
pollo, milanes          → 🍗
carne, parrilla, asado  → 🥩
sandwich, lomito        → 🥖
combo, promo            → ⭐
churro                  → 🥐
wrap, burrito, piadina  → 🌯
poke, bowl              → 🥗
factura, medialuna      → 🥐
(default)               → 🍽️
```

---

## Image pipeline

PedidosYa image URLs **expire**. The pipeline is:

1. **During import**: store PedidosYa CDN URLs as `logoUrl` and `imageUrl`
2. **After import**: run `migrate-images-to-r2.ts` to download each image and upload to our R2 bucket
3. **For covers**: run `fetch-google-covers.ts` to get real photos from Google Places
4. **Result**: all images on `images.menusanjuan.com` — permanent, no expiry

### Image URLs

```
Logos:   https://pedidosya.dhmedia.io/image/pedidosya/restaurants/{uuid}
Items:   https://pedidosya.dhmedia.io/image/pedidosya/products/{uuid}.jpg?quality=90&width=400
Headers: https://pedidosya.dhmedia.io/image/pedidosya/profile-headers/{uuid}
```

Some UUIDs don't have extensions — append `.jpg` if missing.

---

## Import scripts

All scripts run from: `cd /path/to/manu-san-juan/webapp`

### 1. Bulk import: `import-pedidosya.ts`

Reads `vendors-full.json` + `menu-{id}.json` files, creates restaurants in DB.

```bash
npx tsx src/scripts/import-pedidosya.ts
```

For each vendor with a matching menu file:
- Creates a placeholder user (`slug@menusanjuan.com` / auto-generated password)
- Creates Account + Dealer (restaurant)
- Creates MenuCategory + MenuItem for each section/product
- Sets `isActive: false`, `sourceSite: "pedidosya"`, `sourceProfileId: vendorId`
- Skips if slug or sourceProfileId already exists

### 2. Migrate images: `migrate-images-to-r2.ts`

Downloads all PedidosYa CDN images and uploads to our R2 bucket.

```bash
npx tsx src/scripts/migrate-images-to-r2.ts
```

- Finds all dealers + items with `pedidosya.dhmedia.io` URLs
- Downloads each image, uploads to R2, updates DB with new URL
- Logos: `{slug}/logo.jpg`, Items: `{slug}/items/{itemId}.jpg`
- ~900 images takes ~15 minutes

### 3. Google Places covers: `fetch-google-covers.ts`

Fetches real restaurant photos from Google Places API for restaurants without covers.

```bash
npx tsx src/scripts/fetch-google-covers.ts
```

- Searches Google Places by `"{name} restaurante San Juan Argentina"`
- Downloads the first photo (800px wide)
- Uploads to R2 as `{slug}/cover-google.jpg`
- Updates dealer.coverUrl in DB

### 4. Activate restaurants

After import + image migration, activate all restaurants that have logos:

```sql
UPDATE "Dealer" SET "isActive" = true WHERE "sourceSite" = 'pedidosya' AND "logoUrl" LIKE '%images.menusanjuan.com%';
```

---

## Post-import: Owner onboarding

Once a restaurant is imported and activated:

1. **Admin panel** → Restaurant → Owner tab
2. Toggle **"Cuenta Habilitada"** ON — generates real login credentials
3. Editable **WhatsApp message** appears with:
   - Restaurant public page link
   - Login URL + email + password
   - Pitch about the free service
4. Click **"Enviar por WhatsApp"** to send to the restaurant owner
5. Owner logs in → can edit menu, prices, images, hours

When the account is enabled, the "Reclamalo" claim banner disappears from the public page.

---

## File locations

```
/path/to/manu-san-juan/
├── scraper/
│   ├── pedidosya-scraper.ts      # Automated menu scraper (cookie-based)
│   ├── scrape-batch.ts           # Batch scraper for specific vendor IDs
│   └── cookies.txt               # PedidosYa session cookies (DO NOT COMMIT)
├── webapp/src/scripts/
│   ├── import-pedidosya.ts       # Bulk import vendors + menus → DB
│   ├── migrate-images-to-r2.ts   # PedidosYa CDN → R2 migration
│   └── fetch-google-covers.ts    # Google Places → cover photos
└── /Downloads/pedidosya-data/    # Scraped data (local, not in repo)
    ├── vendors-full.json         # 227 vendor records
    ├── menu-{id}.json            # Menu data per vendor (52 files)
    └── scrape-progress.json      # Failed/remaining vendor IDs
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `403` on all requests | Cookies expired | Get fresh cookies from DevTools |
| Empty `sections: []` | Restaurant is closed | Retry during business hours (Fri/Sat 9pm) |
| `MaxClientsInSessionMode` | Too many DB connections | Wait 2 min, or kill idle connections in Supabase SQL Editor |
| Images not loading | PedidosYa CDN expired | Run `migrate-images-to-r2.ts` |
| Duplicate slug error | Restaurant already imported | Script skips automatically |
| Scraper stops after ~30 restaurants | Cookies expired mid-scrape | Get fresh cookies, run again — it resumes |

---

## What we tried that didn't work

1. **Playwright with stealth plugin** — PerimeterX detected within 2-3 requests
2. **Playwright with real Chrome profile** — detected after login page
3. **Persistent browser context** — detected
4. **Direct API calls without cookies** — Cloudflare JavaScript challenge (403)
5. **Old v1 vendor API with GET** — returned 0 results (need POST to v4)

**What works:** Real browser session → copy cookies → curl with proper headers. Simple, reliable, no detection.
