# MenuSanJuan — Claude Project Context

## What this project is
MenuSanJuan is a multi-tenant SaaS restaurant ordering platform for San Juan, Argentina.
Think "Shopify for restaurants" — each restaurant gets its own branded ordering experience,
menu management, and order routing via WhatsApp.

## Stack
- **Frontend**: Next.js 16.2 (App Router, Turbopack), Tailwind CSS 4
- **Backend**: Next.js API routes
- **Database**: PostgreSQL on Supabase via Prisma 7 (`@prisma/adapter-pg`)
- **Images**: Cloudflare R2 (`images.menusanjuan.com`)
- **Payments**: Mercado Pago (Argentina)
- **Order routing**: WhatsApp (direct links, future: Twilio)
- **Maps**: Google Maps + Places API
- **Phone validation**: libphonenumber-js
- **Email**: MailerSend
- **MCP**: Custom MCP server for AI agents (`mcp/server.ts`)
- **Hosting**: Vercel (Pro)

## Project structure
```
webapp/
├── src/
│   ├── app/                    # App Router pages + API routes
│   │   ├── [store]/            # Public restaurant page
│   │   ├── restaurante/        # Restaurant owner dashboard
│   │   ├── admin/              # Admin panel (hidden)
│   │   ├── para-restaurantes/  # Marketing landing
│   │   └── api/                # 28 API routes
│   ├── components/             # Shared UI components
│   ├── lib/                    # Auth, DB, utilities
│   ├── data/                   # Type definitions
│   ├── generated/              # Prisma client (gitignored)
│   └── scripts/                # Import, migration, seed scripts
├── prisma/
│   └── schema.prisma           # Database schema
└── public/                     # Static assets
mcp/                            # MCP server for AI agents
scraper/                        # PedidosYa scraper
```

## Database
- **Connection**: PostgreSQL via Supabase pooler (transaction mode, port 5432)
- **Pool limit**: max 3 per worker (prevents exhaustion)
- **Schema**: User → Account → Dealer → MenuCategory → MenuItem, plus Order, ClaimRequest, Session
- **Key fields on Dealer**: slug (unique URL), isActive, isVerified, sourceProfileId, sourceSite, rating, deliveryFee

## Coding conventions
- Components: PascalCase, one per file, in /components
- API routes: kebab-case, RESTful
- Prisma field names: camelCase in code, maps to DB columns
- Tailwind only — no inline styles, no CSS modules
- All user-facing strings in Spanish (Argentina locale)
- Prices always in ARS, formatted with `toLocaleString("es-AR")` as `$ XX.XXX`
- Always use `async/await`, never `.then()` chains
- Images: always upload to R2 via `/api/upload`, never store external CDN URLs permanently
- Phone numbers: use `PhoneInput` component with `libphonenumber-js` validation
- Git commits: NEVER include `Co-Authored-By` trailers — they break the commit hook
- Before committing: ALWAYS run `npx next build` and verify it passes. Never push broken builds.

## Design system
→ See skill: sanjuan-design
Primary brand: orange (#f97316), dark dashboard backgrounds, light public pages
Logo motif: letter "M" inside a rounded square with gradient

## Environment variables
```
DATABASE_URL                    # Supabase PostgreSQL connection
R2_ACCOUNT_ID                   # Cloudflare account
R2_ACCESS_KEY / R2_SECRET_KEY   # R2 API token
R2_BUCKET                       # menusanjuan-images
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY # Maps + Places
MAILERSEND_API_KEY              # Transactional email
ADMIN_EMAIL / ADMIN_PASSWORD    # Admin panel credentials
CLAIM_SECRET                    # Deterministic claim codes
```

## Multi-tenant architecture
Each restaurant has a slug (e.g. `il-pilonte`).
All DB queries filter by dealerId or slug.
Restaurant config lives in the `Dealer` model.
Never expose one restaurant's data to another.
Session cookie `menusj_session` stores `{ userId, activeSlug, ts }`.
One user can own multiple restaurants (via Account objects).

## Agent routing rules
When given a feature brief, run this pipeline in order:
1. **Planner** — generate PRD with acceptance criteria and data model
2. **Designer** — UI flow, component list, Prisma schema changes
3. **Engineer** — implement using next-patterns and sanjuan-design skills
4. **QA** — edge cases, error states, mobile responsiveness

## Running locally
```bash
cd webapp
npm install
npx prisma generate
npm run dev
```

## Key business context
- Customers are in San Juan, Argentina — Spanish UI always
- Restaurant owners are not technical — admin UI must be simple
- WhatsApp is the primary communication channel (not email)
- Mercado Pago is the only payment processor
- Delivery zones are San Juan city geography (barrios / distance)
- Restaurants imported from PedidosYa have placeholder accounts (`slug@menusanjuan.com`)
- Admin activates owners via toggle → generates credentials → sends WhatsApp message
- MCP server (`mcp/server.ts`) gives AI agents direct DB + R2 + Google Places access
