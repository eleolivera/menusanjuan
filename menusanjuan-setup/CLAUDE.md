# MenuSanJuan — Claude Project Context

## What this project is
MenuSanJuan is a multi-tenant SaaS restaurant ordering platform for San Juan, Argentina.
Think "Shopify for restaurants" — each restaurant gets its own branded ordering experience,
menu management, and order routing via WhatsApp.

## Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Next.js API routes
- **Database / CMS**: Airtable (menus, orders, restaurant config)
- **Payments**: Mercado Pago (Argentina)
- **Order routing**: Twilio → WhatsApp
- **AI**: Anthropic Claude API (bot, recommendations)
- **Hosting**: Vercel

## Project structure
```
/app               → Next.js App Router pages and layouts
/app/[restaurant]  → per-tenant storefront
/app/api           → API routes
/components        → shared UI components
/lib               → Airtable, Mercado Pago, Twilio helpers
/public            → static assets
```

## Coding conventions
- Components: PascalCase, one per file, in /components
- API routes: kebab-case, RESTful
- Airtable field names: Title Case with spaces (as they appear in Airtable)
- Tailwind only — no inline styles, no CSS modules
- All user-facing strings in Spanish (Argentina locale)
- Prices always in ARS, formatted as `$ XX.XXX`
- Always use `async/await`, never `.then()` chains

## Design system
→ See skill: sanjuan-design
Primary brand: warm orange/terracotta (#E8593C), dark backgrounds
Logo motif: letter in a square (M for MenuSJ)

## Environment variables
```
AIRTABLE_API_KEY
AIRTABLE_BASE_ID
MERCADOPAGO_ACCESS_TOKEN
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
ANTHROPIC_API_KEY
```

## Multi-tenant architecture
Each restaurant has a slug (e.g. `puerto-pachatas`).
All Airtable queries filter by restaurant slug.
Restaurant config lives in a `Restaurants` table.
Never expose one restaurant's data to another.

## Current active features
- Menu browsing by category
- Cart and checkout
- Mercado Pago payment flow
- WhatsApp order notification to restaurant owner
- Basic order tracking

## Agent routing rules
When given a feature brief, run this pipeline in order:
1. **Planner** — generate PRD with acceptance criteria and data model
2. **Designer** — UI flow, component list, Airtable schema changes
3. **Engineer** — implement using next-patterns and sanjuan-design skills
4. **QA** — edge cases, error states, mobile responsiveness

## Running locally
```bash
npm install
npm run dev
# Airtable: use .env.local with credentials above
```

## Key business context
- Customers are in San Juan, Argentina — Spanish UI always
- Restaurant owners are not technical — admin UI must be simple
- WhatsApp is the primary communication channel (not email)
- Mercado Pago is the only payment processor to use
- Delivery zones are San Juan city geography (barrios / distance from restaurant)
