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

### Environment variables

```
DATABASE_URL=              # Supabase PostgreSQL connection string
R2_ACCOUNT_ID=             # Cloudflare account ID
R2_ACCESS_KEY=             # R2 API token access key
R2_SECRET_KEY=             # R2 API token secret key
R2_BUCKET=                 # R2 bucket name (menusanjuan-images)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Google Maps + Places API key
MAILERSEND_API_KEY=        # MailerSend for transactional emails
ADMIN_EMAIL=               # Admin login email
ADMIN_PASSWORD=            # Admin login password
CLAIM_SECRET=              # Secret for deterministic claim codes
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

### Scraping PedidosYa

```bash
# 1. Get fresh cookies from pedidosya.com.ar (DevTools → Network → Copy as cURL)
# 2. Paste cookie string into scraper/cookies.txt
# 3. Run the scraper
npx tsx scraper/pedidosya-scraper.ts

# 4. Import scraped data
cd webapp && npx tsx src/scripts/import-pedidosya.ts
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
