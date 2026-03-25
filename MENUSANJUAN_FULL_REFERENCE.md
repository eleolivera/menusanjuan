# MenuSanJuan — Complete Technical Reference

> Full documentation of the codebase, architecture, admin functionality, and all features.
> Last updated: 2026-03-25

---

## 1. Project Overview

**MenuSanJuan** is a restaurant marketplace for San Juan, Argentina. Restaurant owners get a free page with a digital menu and WhatsApp-based ordering. The platform includes a Kanban order management system, analytics, QR receipt printing, and a multi-restaurant management dashboard.

**Live URL:** https://menusanjuan.com
**Repo:** https://github.com/eleolivera/menusanjuan
**Root directory:** `webapp/`

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.x |
| Language | TypeScript | 5.x |
| CSS | Tailwind CSS 4 (via `@theme` in globals.css) | 4.x |
| ORM | Prisma 7 with `@prisma/adapter-pg` | 7.5.x |
| Database | PostgreSQL (Supabase) | - |
| Image CDN | Cloudflare R2 → `images.menusanjuan.com` | - |
| Maps | Google Maps + Places API | - |
| Email | MailerSend (pending approval, dev mode fallback) | - |
| Hosting | Vercel | Pro |
| DNS | Cloudflare | - |

---

## 3. Database Schema (Prisma)

### Models

**User** — anyone with an account
```
id, email (unique), password (salted SHA256), name, phone
role: USER | BUSINESS | ADMIN
emailVerified: boolean
verifyCode, resetCode, resetExpires
→ has many: accounts[], sessions[], claimRequests[]
```

**Account** — links User to a business (one user can have many)
```
id, userId → User, type: "dealer"
→ has one: dealer?
```

**Dealer** — a restaurant (the business entity)
```
id, accountId → Account (unique), name, slug (unique URL)
phone, address, city, latitude, longitude
cuisineType, description, logoUrl, coverUrl
isActive, isVerified, claimedAt
sourceProfileId, sourceSite (for scraped data)
openHours (JSON), mercadoPagoAlias, mercadoPagoCvu, bankInfo
→ has many: categories[], orders[], claimRequests[]
```

**MenuCategory** — menu section (e.g., "Hamburguesas")
```
id, dealerId → Dealer, name, emoji, sortOrder
→ has many: items[]
```

**MenuItem** — individual menu item
```
id, categoryId → MenuCategory, name, description, price
imageUrl, badge, rating, available, sortOrder, stock, minStock
```

**Order** — customer order
```
id, orderNumber (unique, e.g. ORD-0325-001), restauranteSlug
dealerId? → Dealer, status: OrderStatus enum
customerName, customerPhone, customerAddress
latitude, longitude, items (JSON), total
paymentMethod, whatsappSent, notes
createdAt, updatedAt
```

**OrderStatus enum:** GENERATED → PAID → PROCESSING → DELIVERED | CANCELLED

**ClaimRequest** — request to claim ownership of a restaurant
```
id, dealerId → Dealer, userId → User
status: PENDING → CODE_SENT → APPROVED | REJECTED
code (6-char), notes, requestedAt, resolvedAt, resolvedBy
```

**Session** — auth sessions (currently using cookie-based, not this table)
```
id, userId → User, token (unique), expiresAt
```

---

## 4. Authentication System

### Session Model
Session = one User, not one restaurant. Stored as Base64 JSON in httpOnly cookie `menusj_session`.

```json
{ "userId": "cuid", "activeSlug": "restaurant-slug", "ts": timestamp }
```

One user can own **multiple restaurants**. The `activeSlug` tracks which restaurant's dashboard they're currently viewing.

### Key Auth Functions (`src/lib/restaurante-auth.ts`)

| Function | Purpose |
|----------|---------|
| `createSession(userId, activeSlug?)` | Set session cookie |
| `getSession()` | Read session → `{ userId, activeSlug }` |
| `getFullSession()` | Returns user + all their restaurants + pending claims |
| `getRestauranteFromSession()` | Returns active Dealer with Account+User (backward compat) |
| `switchActiveRestaurant(slug)` | Change active restaurant in session |
| `loginWithEmail(email, password)` | Verify credentials, create session |
| `hashPassword(password)` | Salt + SHA256 hash |
| `verifyPassword(password, stored)` | Verify against stored hash |
| `destroyRestauranteSession()` | Delete cookie |

### Admin Auth (`src/lib/admin-auth.ts`)
Separate cookie `menusj_admin`. Checks `role === "ADMIN"` on User model.

### Login Flow
1. User enters email + password at `/restaurante/login`
2. `POST /api/restaurante/login` → verifies password, creates session
3. Session stores userId + first restaurant's slug as activeSlug
4. All dashboard pages check session, redirect to login if missing

### Registration Flow
1. `/restaurante/register` — 4-step form:
   - Step 1: Email + password
   - Step 1.5: Choose — claim existing restaurant OR create new
   - Step 2: Restaurant details (name, phone, cuisine, address w/ Google autocomplete)
   - Step 3: Images (upload to R2 or paste URL)
   - Step 4: Success
2. If user is already logged in, skips email/password — adds new restaurant to their account
3. `POST /api/restaurante/register` handles both cases

---

## 5. Session API

### `GET /api/restaurante/session`
Returns full session data:
```json
{
  "authenticated": true,
  "user": { "id", "email", "name", "phone", "role" },
  "restaurants": [
    { "id", "name", "slug", "cuisineType", "logoUrl", "coverUrl", "isVerified", ... }
  ],
  "activeRestaurant": { ... },
  "pendingClaims": [
    { "id", "status", "dealer": { "id", "name", "slug" } }
  ],
  // Backward compat flat fields:
  "userId", "dealerId", "slug", "name", "email", ...
}
```

### `PATCH /api/restaurante/session`
Switch active restaurant: `{ "slug": "new-slug" }`

### `DELETE /api/restaurante/session`
Logout — deletes cookie.

---

## 6. Claim System

### How It Works

1. **Unclaimed restaurants** have placeholder emails (`slug@menusanjuan.com`)
2. **Anyone** visiting a restaurant page sees "¿Es tu restaurante?" (ClaimBanner component)
3. Not logged in → redirects to register
4. Logged in → submits claim: `POST /api/claim { action: "submit", dealerId }`
5. Creates ClaimRequest with status=PENDING
6. **Admin** goes to `/admin` → Claims tab → clicks "Generar Código"
7. Admin contacts business owner, shares 6-char code
8. **User** enters code on the restaurant page or sees "Ingresar código" in header dropdown
9. `POST /api/claim { action: "verify", claimId, code }` → ownership transfers

### Ownership Transfer Logic
- The Dealer's Account is re-linked to the claiming user (`account.userId = claimingUser.id`)
- Dealer marked `isVerified=true, claimedAt=now`
- Claiming user's role → BUSINESS
- Placeholder user deleted if orphaned
- Session updated with new restaurant
- **The Account moves**, so one user can accumulate multiple restaurants

### Claim Code Generation
Deterministic: `SHA256(dealerId + CLAIM_SECRET)[:6].toUpperCase()`

### APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/claim` | POST `action:"submit"` | Submit a claim request |
| `/api/claim` | POST `action:"verify"` | Verify code + transfer ownership |
| `/api/claim` | GET `?dealerId=x` | Check claims for a restaurant |
| `/api/claim` | GET `?mine=true` | Get current user's claims |
| `/api/restaurante/unclaimed` | GET | List unclaimed restaurants |

---

## 7. Admin Panel (`/admin`)

### Auth
- Login: email + password, verified against `role=ADMIN`
- Session: separate `menusj_admin` cookie
- Admin account: `admin@menusanjuan.com` / `admin-menusj-2024`

### Tabs

**Restaurantes** — all restaurants:
- Name, slug, cuisine type
- Owner email, placeholder status (unclaimed/registered/verified)
- Menu category count, order count

**Reclamos** — all claim requests:
- Status badge (PENDING/CODE_SENT/APPROVED/REJECTED)
- User info (name, email, phone)
- Restaurant info (name, slug, phone)
- "Generar Código" button → generates 6-char code, changes status to CODE_SENT
- "Rechazar" button with notes
- Code display with copy-to-clipboard

**Usuarios** — all users:
- Name, email, phone
- Role badge (USER/BUSINESS/ADMIN)
- Email verified status
- Business count, claim count
- Registration date

### Admin APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/login` | POST | Admin login |
| `/api/admin/restaurants` | GET | All restaurants with ownership info |
| `/api/admin/claims` | GET | All claim requests |
| `/api/admin/claims` | PATCH | Generate code or reject claim |
| `/api/admin/users` | GET | All users |

### Admin Guide (`/admin/guia`)
Internal page for the sales team with:
- Quick links to all pages
- 8-step onboarding instructions
- 3 WhatsApp message templates (invite, code, post-handoff)
- Daily operations guide
- Multi-restaurant management instructions

---

## 8. Restaurant Dashboard

### Pedidos (`/restaurante`)
- **Kanban board** with drag-and-drop: Generado → Pagado → En Cocina → Entregado
- **Date navigator**: back/forward arrows + date picker, shows any business day
- **Business day**: 8:00 AM to 5:59 AM next day (late night orders count as previous day)
- **Order numbers** reset daily: ORD-MMDD-001, ORD-MMDD-002...
- **Auto-polls** every 10 seconds for new orders (today only, no flicker)
- **Consumption totals** table: item aggregation across active orders
- **Status cards**: Nuevos, Pagados, En Cocina, Entregados with counts

### Order Cards (receipt-style)
- Compact view: status badge, order number, total, customer name, time
- Expanded: full receipt layout:
  - Restaurant name at top
  - Items with quantities, unit prices, line totals
  - TOTAL bold
  - Customer: name, phone, address, notes
  - **QR codes**: WhatsApp (contact customer) + Google Maps (delivery coordinates)
  - **menusanjuan.com** at bottom
- **Print button**: opens receipt in new window, sized for 80mm thermal printer
- **Action buttons**: Imprimir, WhatsApp, Maps, status transition, Cancel

### Menú (`/restaurante/menu`)
- Full CRUD for categories and items
- Create categories with emoji + name
- Add items: name, price, description, image, badge (Popular/Nuevo)
- Inline editing via modal
- Toggle item availability (eye icon)
- Delete categories (cascades items)
- Changes reflect instantly on public page

### Analíticas (`/restaurante/analytics`)
- **Period selector**: Hoy, Ayer, Fin de Semana, 7 días, 30 días
- **Summary cards**: Total revenue, order count, avg ticket, peak hour
- **Daily revenue chart**: horizontal bar chart per day
- **Hourly distribution**: 24-hour bar chart
- **Top products table**: ranked by quantity, with revenue, medal colors top 3
- **Status breakdown**: progress bars + delivery/cancellation rates
- **Print button**: clean print-friendly layout

### Mi Restaurante (`/restaurante/profile`)
- **Live preview card** at top (updates as you edit)
- Basic info: name, email (read-only), WhatsApp, cuisine type grid, description
- Location: Google Places autocomplete for address
- Images: logo (square) + cover (wide) with drag-and-drop upload to R2 or URL paste
- Hours of operation: per-day open/close times, toggle closed days
- Payment methods: Mercado Pago alias, CVU, bank info
- **Account section**: change email + change password (for handoff)
  - Placeholder accounts show yellow "Cuenta pendiente de entrega" banner
  - Placeholder accounts skip current password check

---

## 9. Public Pages

### Homepage (`/`)
- Hero section with animated gradient
- Restaurant grid (fetches from DB + demo data fallback)
- Search bar + cuisine type filter buttons
- "Cómo Funciona" 4-step section
- JSON-LD structured data (WebSite schema)

### Restaurant Page (`/{slug}`)
- Cover image header with restaurant logo, name, rating, status
- Info bar with description, address, item count
- **ClaimBanner**: "¿Es tu restaurante?" (visible to everyone)
- Sticky category nav
- Menu items with images, descriptions, prices, +/- quantity controls
- **Floating cart** appears when items added (count + total)
- **Order modal** (3-step):
  1. Cart review with item management
  2. Customer info: name, phone, **address with Google Places autocomplete**, **map with centered pin** (drag map to position, reverse geocodes), notes
  3. Confirm + send via WhatsApp
- Order saved to DB with order number before WhatsApp opens
- WhatsApp message includes: order number, items, total, customer info, Google Maps link

### Para Restaurantes (`/para-restaurantes`)
- Marketing landing page for restaurant owners
- 8 feature cards, 4-step how it works
- Comparison table vs delivery apps
- Device showcase (phone, tablet, desktop)
- CTA buttons to register

---

## 10. Image Upload System

### R2 Configuration
- Bucket: `menusanjuan-images`
- Public URL: `https://images.menusanjuan.com/{key}`
- S3 endpoint: `https://{accountId}.r2.cloudflarestorage.com`

### Upload API (`POST /api/upload`)
Two modes:
1. **File upload** (FormData): validates image type, max 5MB, uploads to R2
2. **URL resolve** (JSON `{ imageUrl, type }`): downloads image from URL (supports Instagram/Facebook CDN), stores in R2

Extension extracted from URL pathname (not query string) to handle CDN URLs.

Files stored as: `{restaurant-slug}/{type}-{timestamp}.{ext}`

### ImageUpload Component
- Click/drag to upload file
- "O pegá una URL" link for URL paste
- Live preview
- Remove button
- Two shapes: `logo` (square) and `cover` (wide)

---

## 11. Order System

### Order Flow
1. Customer browses `/{slug}`, adds items
2. Fills in name, phone, address (autocomplete + map)
3. Clicks "Enviar por WhatsApp"
4. `POST /api/orders` → order saved to DB with order number
5. WhatsApp opens with formatted message including order number
6. `PATCH /api/orders/{id}` marks whatsappSent=true
7. Restaurant sees order in Kanban dashboard
8. Moves through: GENERATED → PAID → PROCESSING → DELIVERED

### Business Day Logic (`src/lib/orders-store.ts`)
- Business day: 8:00 AM AR to 5:59 AM AR next day
- Orders after midnight until 6am count as previous business day
- Order numbers: `ORD-MMDD-SEQ` (e.g., ORD-0325-001), reset daily
- Dashboard shows today's business day by default
- Date navigator allows viewing any past day
- `getBusinessDayStart(date)` / `getBusinessDayEnd(date)` / `getDateRange(period)`

### Order APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders` | POST | Create order |
| `/api/orders` | GET `?restaurante=slug` | Today's orders |
| `/api/orders` | GET `?restaurante=slug&date=YYYY-MM-DD` | Specific day |
| `/api/orders` | GET `?restaurante=slug&all=true` | All orders |
| `/api/orders/{id}` | GET | Single order |
| `/api/orders/{id}` | PATCH `{ status }` | Update status |
| `/api/orders/{id}` | PATCH `{ whatsappSent: true }` | Mark WhatsApp sent |

---

## 12. Location Picker

### Centered Pin Pattern
- Orange pin is CSS-fixed at the center of the map div
- User drags the MAP underneath the pin (not the pin itself)
- `onIdle` callback reads map center as selected coordinates
- Reverse geocodes to get address text

### Dual Address System
- **Written address**: what the user typed/selected from autocomplete (goes on receipt)
- **Coordinates**: lat/lng from map center (goes in QR code)
- Autocomplete updates both; map drag only updates coordinates
- Confirm button locks both

### Google Maps Configuration
- Places API for autocomplete (restricted to Argentina, biased to San Juan)
- Map restricted to San Juan province bounds
- POIs hidden, zoom control only
- "Mi ubicación" button for GPS

---

## 13. Email System (`src/lib/email.ts`)

### Provider
MailerSend (Resend is used by AutoSanJuan's free slot).

### Functions
- `sendEmail({ to, subject, html })` → sends via MailerSend API
- `verificationEmailHtml(name, code)` → branded verification email template
- `resetPasswordEmailHtml(name, code)` → branded reset email template

### Dev Mode
If `MAILERSEND_API_KEY` is not set, emails are logged to console and codes are returned in API responses.

### APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/send-code` | POST `{ email }` | Send verification code |
| `/api/auth/verify-email` | POST `{ email, code }` | Verify email |
| `/api/auth/reset-password` | POST `action:"request"` | Send reset code (10min expiry) |
| `/api/auth/reset-password` | POST `action:"reset"` | Validate code + set new password |

---

## 14. SEO

- `robots.ts` → allows all, blocks `/restaurante/` and `/api/`
- `sitemap.ts` → homepage + all restaurant pages
- **JSON-LD** on homepage (WebSite schema with all restaurants)
- **JSON-LD** on store pages (Restaurant schema with full Menu)
- **OpenGraph + Twitter** meta tags with restaurant images
- **Keywords**: "restaurantes san juan", "delivery san juan", etc.

---

## 15. File Structure

```
webapp/
├── prisma/schema.prisma          # Database schema
├── prisma.config.ts              # Prisma 7 config
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (header + footer)
│   │   ├── page.tsx              # Homepage
│   │   ├── globals.css           # Tailwind @theme + animations
│   │   ├── robots.ts / sitemap.ts
│   │   ├── not-found.tsx
│   │   ├── para-restaurantes/    # Marketing landing page
│   │   ├── [store]/page.tsx      # Dynamic restaurant pages
│   │   ├── restaurante/          # Restaurant dashboard
│   │   │   ├── page.tsx          # Pedidos (Kanban)
│   │   │   ├── menu/             # Menu management
│   │   │   ├── analytics/        # Analytics dashboard
│   │   │   ├── profile/          # Restaurant profile editor
│   │   │   ├── login/            # Login page
│   │   │   ├── register/         # Registration (4-step + claim)
│   │   │   └── reset-password/   # Password reset
│   │   ├── admin/                # Admin panel
│   │   │   ├── page.tsx          # Main admin (3 tabs)
│   │   │   └── guia/             # Internal guide for sales team
│   │   └── api/                  # All API routes
│   │       ├── orders/           # Order CRUD
│   │       ├── claim/            # Claim submit + verify
│   │       ├── upload/           # Image upload (R2)
│   │       ├── analytics/        # Analytics data
│   │       ├── restaurants/      # Public restaurant list
│   │       ├── auth/             # Email verify + password reset
│   │       ├── restaurante/      # Restaurant auth + CRUD
│   │       └── admin/            # Admin APIs
│   ├── components/
│   │   ├── Header.tsx            # Session-aware header w/ restaurant switcher
│   │   ├── Footer.tsx
│   │   ├── ClaimBanner.tsx       # "¿Es tu restaurante?" on store pages
│   │   ├── ImageUpload.tsx       # File upload + URL resolve to R2
│   │   ├── LocationPicker.tsx    # Google Maps centered pin
│   │   ├── AddressAutocomplete.tsx
│   │   ├── OrderModal.tsx        # 3-step checkout
│   │   ├── FloatingCart.tsx
│   │   ├── RestaurantCard.tsx / RestaurantGrid.tsx
│   │   ├── StoreMenu.tsx / MenuItemCard.tsx / CategoryNav.tsx
│   │   ├── HeroSection.tsx / HowItWorks.tsx
│   │   ├── SearchBar.tsx / CuisineFilter.tsx
│   │   └── restaurante/          # Dashboard components
│   │       ├── KanbanBoard.tsx   # Drag-and-drop
│   │       ├── OrderCard.tsx     # Receipt-style with QR
│   │       ├── OrderTotals.tsx   # Stats + consumption table
│   │       └── RestauranteSidebar.tsx
│   ├── lib/
│   │   ├── restaurante-auth.ts   # Session, login, multi-restaurant
│   │   ├── admin-auth.ts         # Admin session
│   │   ├── orders-store.ts       # Order CRUD + business day logic
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── r2.ts                 # Cloudflare R2 upload
│   │   ├── email.ts              # MailerSend integration
│   │   ├── get-restaurant.ts     # Restaurant lookup (DB + demo fallback)
│   │   └── get-restaurant-menu.ts
│   ├── data/
│   │   ├── restaurants.ts        # Demo restaurant data (fallback)
│   │   └── menus.ts              # Demo menu data (fallback)
│   └── scripts/
│       ├── seed-restaurants.ts   # Import demo restaurants to DB
│       └── seed-orders.ts        # Generate demo order data
```

---

## 16. Environment Variables

```
DATABASE_URL                    # Supabase PostgreSQL connection string
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY # Google Maps + Places API
R2_ACCOUNT_ID                   # Cloudflare account
R2_ACCESS_KEY                   # R2 API key
R2_SECRET_KEY                   # R2 API secret
R2_BUCKET                       # menusanjuan-images
MAILERSEND_API_KEY              # Email sending (optional in dev)
CLAIM_SECRET                    # Used for deterministic claim codes
```

---

## 17. Current Database State

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 11 | 1 admin, 1 real owner, 9 placeholders |
| Restaurants | 10 | 9 unclaimed, 1 claimed (HC Café) |
| Menu categories | 30 | |
| Menu items | 95 | |
| Orders | 223 | Seeded demo data |
| Claim requests | 1 | HC Café (APPROVED) |

### Key Accounts
- **Admin**: `admin@menusanjuan.com` / `admin-menusj-2024`
- **Placeholder restaurants**: `{slug}@menusanjuan.com` / `menusj2024`
- **HC Café (claimed)**: `majoespin35@gmail.com` / `hccafe2024`

---

## 18. PedidosYa Scraper Data (In Progress)

### Discovered API Endpoints
- **Vendors list**: `https://www.pedidosya.com.ar/v1/food-home/v1/vendors`
  - Returns: id, name, address (lat/lng, street), logo_url, header_url, link, menu_id
- **Menu**: `https://www.pedidosya.com.ar/v2/niles/partners/{id}/menus?occasion=DELIVERY`
  - Returns: sections[] → products[] with name, description, price, images, tags (isMostOrdered, etc.)
- **Image CDN**: `https://pedidosya.dhmedia.io/image/pedidosya/restaurants/{filename}`

### Requires browser-based access (403 on direct fetch). Data obtained manually from Chrome DevTools.

---

## 19. Design System

### Colors (orange theme)
- Primary: `#f97316` (orange-500)
- Primary dark: `#ea580c` (orange-600)
- Primary light: `#fb923c` (orange-400)
- Gradients: orange → amber (buttons, logos)
- Hero: dark warm tones (slate-900 via orange-950 to red-950)

### Key UI Patterns
- Glass morphism header (`backdrop-blur`)
- Rounded-2xl cards with border-border/60
- Staggered fade-in animations
- Receipt-style order cards with dashed dividers
- Centered-pin map (CSS overlay, map moves underneath)
- Drag-and-drop Kanban columns

---

*End of reference document.*
