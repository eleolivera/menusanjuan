#!/bin/bash

# ============================================================
# MenuSanJuan — Claude Code Ecosystem Setup
# Run from the ROOT of your manu-san-juan repo:
#   bash setup-claude.sh
# ============================================================

set -e
REPO_ROOT="$(pwd)"

echo ""
echo "🧠 Setting up MenuSanJuan Claude Code ecosystem..."
echo "   Working in: $REPO_ROOT"
echo ""

# ── 1. Create folder structure ────────────────────────────
mkdir -p .claude/skills/sanjuan-design
mkdir -p .claude/skills/next-patterns
mkdir -p .claude/skills/mercadopago
mkdir -p .claude/skills/whatsapp-bot
mkdir -p .claude/agents

echo "✓ Folder structure created"

# ── 2. Write CLAUDE.md ────────────────────────────────────
cat > CLAUDE.md << 'CLAUDEMD'
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
Logo motif: letter "M" inside a rounded square

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
```

## Key business context
- Customers are in San Juan, Argentina — Spanish UI always
- Restaurant owners are not technical — admin UI must be simple
- WhatsApp is the primary communication channel (not email)
- Mercado Pago is the only payment processor
- Delivery zones are San Juan city geography (barrios / distance)
CLAUDEMD

echo "✓ CLAUDE.md written"

# ── 3. Write Skills ───────────────────────────────────────

cat > .claude/skills/sanjuan-design/SKILL.md << 'SKILL'
---
name: sanjuan-design
description: >
  MenuSanJuan visual design system. Load when working on UI components,
  pages, layouts, or any user-facing styling. Covers colors, typography,
  spacing, component patterns, and brand rules.
---

# San Juan Design System — MenuSJ

## Brand identity
- Product: MenuSanJuan (MenuSJ)
- Logo: letter "M" inside a rounded square, terracotta on dark
- Voice: warm, local, approachable

## Color palette
Primary:     #E8593C  (terracotta)
Background:  #1A1A1A  (near-black)
Surface:     #242424  (cards)
Surface 2:   #2E2E2E  (hover, inputs)
Text:        #F5F0EB  (warm white)
Muted:       #9E9A94
Border:      #3A3A3A

## Core component patterns

### Card
<div className="bg-[#242424] rounded-xl border border-[#3A3A3A] p-4 hover:border-[#E8593C]/40 transition-colors">

### Primary button
<button className="bg-[#E8593C] hover:bg-[#C04828] text-white font-semibold px-6 py-3 rounded-lg transition-colors">

### Input field
<input className="w-full bg-[#2E2E2E] border border-[#3A3A3A] focus:border-[#E8593C] rounded-lg px-4 py-3 text-[#F5F0EB] outline-none transition-colors" />

### Price display
<span className="font-bold tabular-nums text-[#E8593C]">$ {price.toLocaleString('es-AR')}</span>

## Rules
- Dark-mode-first (no light mode unless requested)
- Mobile-first: 375px breakpoint
- Tap targets: 44px minimum height
- Icons: lucide-react, stroke-width 1.5, 20px default
- Tailwind only — no inline styles
SKILL

cat > .claude/skills/next-patterns/SKILL.md << 'SKILL'
---
name: next-patterns
description: >
  Next.js and Airtable coding patterns for MenuSanJuan. Load when implementing
  pages, API routes, data fetching, or Airtable queries.
---

# Next.js + Airtable Patterns — MenuSJ

## Airtable base helper (lib/airtable.ts)
```typescript
import Airtable from 'airtable'
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)

export async function getRecords(table: string, filter?: string) {
  const records = await base(table).select({ filterByFormula: filter || '' }).all()
  return records.map(r => ({ id: r.id, ...r.fields }))
}
export async function createRecord(table: string, fields: object) {
  const record = await base(table).create(fields as any)
  return { id: record.id, ...record.fields }
}
```

## Always filter by restaurant slug
```typescript
const menu = await getRecords('Menu Items', `{Restaurant Slug} = '${slug}'`)
```

## API route pattern
```typescript
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const data = await getRecords('Table Name', `{Restaurant Slug} = '${params.slug}'`)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[route-name]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

## Airtable tables
- Restaurants, Menu Items, Menu Categories, Orders, Order Items, Delivery Zones

## Rules
- Never call Airtable from client components — API routes only
- All field names: Title Case with spaces
- TypeScript strict, no `any`
- Server Components for initial data, useSWR for client refresh
SKILL

cat > .claude/skills/mercadopago/SKILL.md << 'SKILL'
---
name: mercadopago
description: >
  Mercado Pago integration patterns for MenuSanJuan. Load when implementing
  payment flows, checkout, or webhook handling. Argentina-specific.
---

# Mercado Pago Patterns — MenuSJ

## Preference creation (server-side)
```typescript
const preference = await preferenceClient.create({
  body: {
    items: [
      ...orderItems.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price, currency_id: 'ARS' })),
      ...(deliveryCost > 0 ? [{ id: 'delivery', title: `Envío (${zoneName})`, quantity: 1, unit_price: deliveryCost, currency_id: 'ARS' }] : []),
    ],
    back_urls: { success: `${BASE_URL}/${slug}/checkout/success`, failure: `${BASE_URL}/${slug}/checkout/failure` },
    auto_return: 'approved',
    notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    external_reference: orderId,
  }
})
```

## Delivery cost = separate line item, not bundled in product prices

## Webhook handler
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.type === 'payment') {
    const payment = await paymentClient.get({ id: body.data.id })
    if (payment.status === 'approved') {
      await updateOrderStatus(payment.external_reference, 'paid')
      await notifyRestaurantWhatsApp(payment.external_reference)
    }
  }
  return NextResponse.json({ received: true })
}
```

## Price format
export const formatPrice = (n: number) => `$ ${n.toLocaleString('es-AR')}`
SKILL

cat > .claude/skills/whatsapp-bot/SKILL.md << 'SKILL'
---
name: whatsapp-bot
description: >
  WhatsApp and Twilio integration patterns for MenuSanJuan. Load when
  implementing order notifications or bot responses.
---

# WhatsApp + Twilio Patterns — MenuSJ

## Send helper (lib/twilio.ts)
```typescript
const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
export const sendWhatsApp = (to: string, body: string) =>
  client.messages.create({ from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, to: `whatsapp:${to}`, body })
```

## Restaurant notification
```typescript
const deliveryLine = order.type === 'pickup'
  ? '🛍️ *RETIRO en el local*'
  : `🛵 *DELIVERY* — ${order.address}\n💰 Envío: ${formatPrice(order.deliveryCost)}`

await sendWhatsApp(restaurant.ownerPhone,
  `🔔 *Nuevo pedido #${order.number}*\n\n${itemsList}\n\n${deliveryLine}\n\n💳 Total: *${formatPrice(order.total)}*`)
```

## Rules
- Always distinguish pickup vs delivery clearly in every message
- Use *bold* for key info (WhatsApp markdown)
- Send notification AFTER payment confirmed, not before
- Argentina numbers: +5492645XXXXXXX format
SKILL

echo "✓ All 4 skills written"

# ── 4. Write Agent definitions ────────────────────────────

cat > .claude/agents/planner.md << 'AGENT'
---
name: planner
description: Feature planning agent. Produces PRD, acceptance criteria, data model, API routes, and task breakdown.
---
You are the product planner for MenuSanJuan. When given a feature brief, produce:
1. Feature summary (2-3 sentences)
2. Numbered acceptance criteria (each testable)
3. Airtable data model changes (table, field, type, example)
4. API routes needed (method + path + request/response shape)
5. UI screens and components needed
6. Ordered task breakdown (30-90 min each, flag dependencies)
7. Edge cases and risks (flag anything needing a business decision)

Ask clarifying questions BEFORE producing the plan if the brief is ambiguous.
AGENT

cat > .claude/agents/designer.md << 'AGENT'
---
name: designer
description: UI/UX design agent. Produces component specs, user flows, Airtable schema details, and Spanish UI copy.
---
You are the UI/UX designer for MenuSanJuan. Load sanjuan-design and next-patterns skills.
Given a Planner output, produce:
1. User flow (step-by-step, user perspective, Spanish UI copy)
2. Component inventory (name, file path, props interface, key elements)
3. All UI copy in Argentina Spanish
4. Detailed Airtable schema (exact field names, types, options)
5. State management plan (what lives where)

Mobile-first. Follow sanjuan-design exactly. Error states for everything.
AGENT

cat > .claude/agents/engineer.md << 'AGENT'
---
name: engineer
description: Full-stack implementation agent. Writes complete code for features following project conventions.
---
You are the full-stack engineer for MenuSanJuan. Load next-patterns, sanjuan-design, and relevant skills (mercadopago, whatsapp-bot) as needed.

Implementation order:
1. TypeScript interfaces for new data shapes
2. Airtable helper functions in /lib
3. API routes with full error handling
4. Server components (data fetching)
5. Client components (interactivity)
6. Integration wiring

Output full file contents (not snippets) for each file, prefixed with the file path.
End with a list of Airtable fields to manually add.
Never hardcode config — always from Airtable.
AGENT

cat > .claude/agents/qa.md << 'AGENT'
---
name: qa
description: QA review agent. Reviews implemented code for edge cases, error states, mobile behavior, and integration correctness.
---
You are the QA engineer for MenuSanJuan. Review implemented code and check:

Functional: happy path, all acceptance criteria met, error states, loading states
Data: multi-tenant isolation, correct Airtable field names, price accuracy, null checks
Mobile: 375px layout, 44px tap targets, no horizontal scroll
Delivery/pickup: zone detection edge cases, cost correctly added to Mercado Pago, WhatsApp notification clarity
Integration: payment before notification, order saved before redirect

Output: summary (ready / minor fixes / rework), issues (severity + location + fix), and what was done well.
AGENT

echo "✓ All 4 agents written"

# ── 5. Write settings.json ────────────────────────────────
cat > .claude/settings.json << 'SETTINGS'
{
  "defaultMode": "bypassPermissions",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": ""
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  },
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(npx *)", "Bash(git *)"]
  }
}
SETTINGS

echo "✓ settings.json written"

# ── 6. Install community plugins ─────────────────────────
echo ""
echo "📦 Installing plugins (requires Claude Code to be running)..."
echo "   Run these commands inside Claude Code:"
echo ""
echo "   /plugin install github.com/anthropics/claude-code-review"
echo ""
echo "   Or paste this first prompt to kick off the delivery feature:"
echo ""
echo "   ----------------------------------------"
echo "   I need to add a delivery system to MenuSanJuan."
echo "   Two requirements:"
echo "   1. Delivery cost with two tiers: 'Cerca' (within 3km) and 'Lejos' (3km+)"
echo "   2. Pickup option the customer can choose at checkout"
echo ""  
echo "   Run the full pipeline using our agents:"
echo "   First use the planner agent to create a PRD,"
echo "   then the designer agent for UI/component specs,"
echo "   then the engineer agent to implement it,"
echo "   then the qa agent to review."
echo "   ----------------------------------------"
echo ""

# ── Done ─────────────────────────────────────────────────
echo "✅ Setup complete! Files created:"
echo ""
find . -path './.git' -prune -o -path './node_modules' -prune -o \( -name 'CLAUDE.md' -o -path './.claude/*' \) -print | sort
echo ""
echo "⚠️  Before using the GitHub MCP server:"
echo "   Add your GitHub token to .claude/settings.json"
echo "   (replace the empty string next to GITHUB_PERSONAL_ACCESS_TOKEN)"
echo ""
echo "🚀 Open Claude Code in this directory and you're ready to go:"
echo "   claude"
echo ""
