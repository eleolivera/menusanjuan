# MenuSanJuan

**The restaurant marketplace for San Juan, Argentina.**

One person. One AI. 200+ restaurants. Zero commissions.

> **Live:** [menusanjuan.com](https://menusanjuan.com)

---

## What is this?

MenuSanJuan gives every restaurant in San Juan a free digital presence — menu, ordering via WhatsApp, kitchen management, and analytics. No app downloads, no contracts, no commissions.

Restaurants get discovered. Customers order easily. Nobody pays us (yet).

### The play

1. **Bulk-upload every restaurant** in San Juan from PedidosYa (scraped via AI + cookie-based curl)
2. **Onboard real owners** — they claim their restaurant, get instant access to their menu and dashboard
3. **Dominate the market** before anyone else builds it
4. **Monetize later** with subscriptions once we're the default

All of this built and operated by **one person + Claude Code**.

---

## What we built

### For customers
- Browse restaurants by cuisine, name, or location
- Full digital menus with images, prices, and descriptions
- Build an order and send it directly via WhatsApp — no app needed
- Works on any phone, any browser

### For restaurant owners
- **Free digital menu** — categories, items, images, videos, prices
- **WhatsApp ordering** — customers build orders online, sent to your WhatsApp
- **Kitchen Kanban** — drag orders through stages (Generado → Pagado → En Cocina → Entregado)
- **Analytics** — revenue, order counts, top products, hourly distribution
- **Profile management** — logo, cover photo, hours, location (Google Maps), payment methods
- **QR receipts** — print receipts with QR codes for order tracking

### For us (admin)
- **Bulk restaurant import** from PedidosYa (scraped 227 vendors, 29 imported with full menus)
- **Image migration** — PedidosYa CDN images downloaded to our R2 bucket (865 images migrated)
- **Google Places covers** — auto-fetch cover photos for restaurants without images
- **Owner activation** — toggle placeholder accounts on/off, generate credentials, send via WhatsApp
- **Claim system** — restaurants can be claimed by real owners through verification codes
- **User/restaurant management** — roles, assignments, deletions with orphan handling

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.2 (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 (`@theme` directive, orange color scheme) |
| **Database** | PostgreSQL on Supabase (us-west-2) |
| **ORM** | Prisma 7 with `@prisma/adapter-pg` |
| **Hosting** | Vercel (Pro) |
| **Images** | Cloudflare R2 (`images.menusanjuan.com`) |
| **Maps** | Google Maps + Places API |
| **Phone validation** | libphonenumber-js |
| **Email** | MailerSend |
| **QR Codes** | qrcode.react |

---

## Architecture

```
menusanjuan.com
├── / .......................... Homepage (restaurant grid, search, filters)
├── /para-restaurantes ......... Marketing page for restaurant owners
├── /[slug] .................... Public restaurant page (menu + ordering)
│
├── /restaurante/ .............. Restaurant dashboard
│   ├── /profile ............... Restaurant info, images, hours, location
│   ├── /dashboard ............. Analytics (revenue, orders, top products)
│   ├── /pedidos ............... Kanban order board
│   ├── /menu .................. Menu CRUD (categories + items)
│   ├── /login ................. Email/password login
│   └── /register .............. Claim existing or create new restaurant
│
├── /admin?login ............... Admin panel (hidden)
│   ├── Restaurants tab ........ Activate, edit, assign owners
│   ├── Claims tab ............. Review ownership claims
│   ├── Users tab .............. Role management
│   └── /restaurants/[id] ..... Full restaurant editor + owner onboarding
│
└── /api/ ...................... 28 API routes
    ├── /restaurants ........... Public listing
    ├── /orders ................ Order CRUD
    ├── /upload ................ Image/video upload to R2
    ├── /restaurante/* ......... Restaurant auth + management
    ├── /admin/* ............... Admin operations
    └── /claim ................. Ownership verification
```

### Database models

```
User ──┬── Account ──── Dealer ──┬── MenuCategory ── MenuItem
       │                         ├── Order
       │                         └── ClaimRequest
       └── Session
```

- **One user can own multiple restaurants** (via Account objects)
- **Placeholder users** (`slug@menusanjuan.com`) hold imported restaurants until claimed
- **Business day**: 8:00 AM to 5:59 AM next day (Argentina UTC-3)
- **Order numbers**: `ORD-MMDD-SEQ` (reset daily)

---

## The AI strategy

This project proves that one person with Claude Code can build, launch, and operate a full marketplace that would traditionally need a team of 5-10.

### How we use AI

| Task | Traditional team | Us |
|------|-----------------|-----|
| Full-stack development | 2-3 engineers | Claude Code writes the code |
| Data scraping | Data engineer | Claude Code built the PedidosYa scraper |
| Image processing | DevOps + scripts | Claude Code migrated 865 images to R2 |
| Content generation | Content team | Claude Code generates WhatsApp onboarding messages |
| Database management | DBA | Claude Code writes migrations, seeds, and scripts |
| QA / bug fixing | QA engineer | Claude Code debugs in real-time |
| Sales tools | Product manager | Claude Code built the admin playbook + onboarding flow |

### The workflow

1. **Describe what you want** in natural language
2. **Claude Code reads the codebase**, understands the architecture
3. **It writes the code**, runs tests, fixes errors
4. **You review and deploy** with `git push`

Average feature time: **10-30 minutes** from idea to production.

### What we've automated

- **Restaurant onboarding**: scrape PedidosYa → import to DB → migrate images to R2 → fetch Google Places covers → activate → generate credentials → send WhatsApp message. All scripted.
- **Owner activation**: one toggle in admin generates login credentials and a pre-written WhatsApp pitch
- **Image pipeline**: upload, download from URL, migrate between CDNs — all through one API
- **Menu management**: full CRUD with image/video upload for both admin and restaurant owners

---

## Database

### Connection

PostgreSQL on **Supabase** (project `hzokeqvgmbhfrnrkxxtd`, us-west-2). Uses Prisma 7 with `@prisma/adapter-pg` (driver adapter, not Prisma's built-in connection).

```
DATABASE_URL="postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

- **Pool mode:** Transaction (port 5432 via pooler)
- **Max connections per worker:** 3 (set in `webapp/src/lib/prisma.ts`)
- **Dashboard:** `supabase.com/dashboard/project/hzokeqvgmbhfrnrkxxtd`

### Schema

```
User ──┬── Account ──── Dealer ──┬── MenuCategory ── MenuItem
       │                         ├── Order
       │                         └── ClaimRequest
       └── Session
```

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **User** | email, password (salt:hash), name, phone, role (USER/BUSINESS/ADMIN) | Account holder |
| **Account** | userId, type ("dealer") | Links User to Dealer (1 user can have multiple) |
| **Dealer** | name, slug (unique URL), phone, address, lat/lng, cuisineType, logoUrl, coverUrl, isActive, isVerified, rating, deliveryFee, sourceProfileId, sourceSite, openHours (JSON) | Restaurant |
| **MenuCategory** | dealerId, name, emoji, sortOrder | Menu section (e.g., "Hamburguesas") |
| **MenuItem** | categoryId, name, description, price (ARS), imageUrl, badge, available, sortOrder | Individual menu item |
| **Order** | orderNumber (ORD-MMDD-SEQ), restauranteSlug, dealerId, status, customerName/Phone/Address, items (JSON), total | Customer order |
| **ClaimRequest** | dealerId, userId, status (PENDING→CODE_SENT→APPROVED/REJECTED), code | Ownership claim |
| **Session** | userId, token, expiresAt | Auth session |

**Important fields on Dealer:**
- `sourceProfileId` + `sourceSite`: tracks where the restaurant was imported from (e.g., `"pedidosya"`)
- `isActive`: admin toggle — inactive restaurants don't appear on the site
- `isVerified`: owner account is activated — claim banner disappears
- `pendingOwnerEmail`: if set, auto-links when that email registers
- `openHours`: JSON string with per-day hours `{ "lun": { "open": "08:00", "close": "23:00", "closed": false } }`

### Useful DB commands

```bash
# Push schema changes to DB
cd webapp && npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Run raw SQL via script
npx tsx -e "
import pg from 'pg';
async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT count(*) FROM \"Dealer\" WHERE \"isActive\" = true');
  console.log(res.rows[0]);
  await client.end();
}
main();
"
```

### Kill stuck connections (Supabase SQL Editor)

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND pid != pg_backend_pid();
```

---

## Image uploads (Cloudflare R2)

### Setup

- **Bucket:** `menusanjuan-images`
- **Public URL:** `https://images.menusanjuan.com/{key}`
- **R2 endpoint:** `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

### How it works

The upload API (`POST /api/upload`) accepts both **file uploads** and **URL downloads**:

**File upload (FormData):**
```bash
curl -X POST https://menusanjuan.com/api/upload \
  -H "Cookie: menusj_session=..." \
  -F "file=@photo.jpg" \
  -F "type=menu-item"
# Returns: { "url": "https://images.menusanjuan.com/slug/menu-item-1234.jpg", "key": "slug/menu-item-1234.jpg" }
```

**URL download (JSON):**
```bash
curl -X POST https://menusanjuan.com/api/upload \
  -H "Cookie: menusj_session=..." \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/photo.jpg", "type": "logo"}'
# Downloads the image, uploads to R2, returns our URL
```

- Accepts both **user session** and **admin session**
- Images max **5MB**, videos max **20MB**
- Supports: jpg, png, webp, gif, svg, mp4, mov, webm
- Files stored as: `{slug}/{type}-{timestamp}.{ext}`

### R2 environment variables

```
R2_ACCOUNT_ID=             # Cloudflare account ID (from dashboard)
R2_ACCESS_KEY=             # R2 API token access key
R2_SECRET_KEY=             # R2 API token secret key
R2_BUCKET=menusanjuan-images
```

### Image migration scripts

```bash
# Migrate PedidosYa CDN images to R2 (logos + 900 item images)
npx tsx src/scripts/migrate-images-to-r2.ts

# Fetch Google Places photos as restaurant covers
npx tsx src/scripts/fetch-google-covers.ts
```

---

## Scraping PedidosYa (with Cowork)

Full instructions in **[PEDIDOSYA_SCRAPER_INSTRUCTIONS.md](./PEDIDOSYA_SCRAPER_INSTRUCTIONS.md)** — covers APIs, cookie management, field mappings, what worked and what didn't.

### Quick summary for Cowork

1. **Log in** to pedidosya.com.ar in Chrome (real account)
2. **Navigate** to San Juan restaurants
3. **Capture vendor list** — DevTools → Network → filter `vendors` → Copy response → save as `vendors-full.json`
4. **For each restaurant** — click into it → Network → filter `menus` → Copy response → save as `menu-{id}.json`
5. **Run import**: `cd webapp && npx tsx src/scripts/import-pedidosya.ts`
6. **Migrate images**: `npx tsx src/scripts/migrate-images-to-r2.ts`
7. **Fetch covers**: `npx tsx src/scripts/fetch-google-covers.ts`
8. **Activate**: Admin panel → toggle restaurants active

**Key learnings:**
- PedidosYa blocks all automation (Playwright, Puppeteer, headless browsers)
- Cookie-based curl works but cookies expire every ~30 min
- Closed restaurants return empty menus — scrape Friday/Saturday 9pm+
- PedidosYa image URLs expire — always migrate to R2 after import

---

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL (or Supabase account)
- Cloudflare R2 bucket
- Google Maps API key

### Setup

```bash
cd webapp
cp .env.example .env  # Fill in your credentials
npm install
npx prisma db push
npx prisma generate
npm run dev
```

### All environment variables

```
# Database (Supabase PostgreSQL)
DATABASE_URL=              # postgresql://postgres.xxx:password@aws-0-us-west-2.pooler.supabase.com:5432/postgres

# Cloudflare R2 (image storage)
R2_ACCOUNT_ID=             # Cloudflare account ID
R2_ACCESS_KEY=             # R2 API token access key
R2_SECRET_KEY=             # R2 API token secret key
R2_BUCKET=menusanjuan-images

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Maps + Places API key

# Email
MAILERSEND_API_KEY=        # MailerSend transactional emails

# Auth
ADMIN_EMAIL=               # Admin login email
ADMIN_PASSWORD=            # Admin login password
CLAIM_SECRET=              # Secret for deterministic claim verification codes
```

### Scripts

```bash
# Import PedidosYa data
npx tsx src/scripts/import-pedidosya.ts

# Migrate images from external CDNs to R2
npx tsx src/scripts/migrate-images-to-r2.ts

# Fetch Google Places cover photos
npx tsx src/scripts/fetch-google-covers.ts

# Seed demo data
npx tsx src/scripts/seed-restaurants.ts
```

---

## Current status

- **29 restaurants** imported from PedidosYa with full menus
- **865 menu item images** migrated to our CDN
- **27 Google Places cover photos** fetched and uploaded
- **198 restaurants** pending (need fresh cookies to scrape menus)
- **Owner onboarding flow** ready — activate from admin, send WhatsApp with credentials
- **Claim system** working — real owners can take over their restaurant page

### What's next

- [ ] Scrape remaining 198 restaurant menus
- [ ] Download product images to R2 for new imports
- [ ] Onboard first 10 real restaurant owners via WhatsApp
- [ ] Add delivery fee display on public menu pages
- [ ] Push notification for new orders (browser + WhatsApp)
- [ ] Payment integration (MercadoPago)
- [ ] Customer accounts (order history, favorites)
- [ ] Mobile app wrapper (PWA)

---

## Project structure

```
manu-san-juan/
├── webapp/                    # Next.js application
│   ├── src/
│   │   ├── app/               # App Router pages + API routes
│   │   ├── components/        # React components
│   │   ├── lib/               # Auth, DB, utilities
│   │   ├── data/              # Type definitions
│   │   ├── generated/         # Prisma client
│   │   └── scripts/           # Import, migration, seed scripts
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── public/                # Static assets
├── scraper/                   # PedidosYa scraper
│   ├── pedidosya-scraper.ts   # Main scraper (cookie-based curl)
│   ├── scrape-batch.ts        # Batch helper
│   └── cookies.txt            # PedidosYa session cookies
└── README.md
```

---

## Why this matters

PedidosYa charges restaurants 25-30% commission on every order. Most small restaurants in San Juan can't afford that. We give them the same digital presence for free.

The moat isn't the technology — it's the data. By bulk-importing every restaurant before they even know we exist, we create the most complete restaurant directory in San Juan. When owners discover their restaurant is already listed with a full menu, the conversion is: "Do you want to control this? It's free."

Built with Claude Code. Operated by one person. Scaling to dominate San Juan's restaurant market.

---

*Built by [@eleolivera](https://github.com/eleolivera) with [Claude Code](https://claude.ai/claude-code)*
