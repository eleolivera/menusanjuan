---
name: next-patterns
description: >
  MenuSanJuan Next.js and Airtable coding patterns. Load when implementing
  new pages, API routes, data fetching, or Airtable queries.
  Enforces the project's architecture and naming conventions.
---

# Next.js + Airtable Patterns — MenuSJ

## App Router structure
```
/app
  /[restaurant]           → tenant storefront (layout.tsx + page.tsx)
  /[restaurant]/menu      → menu page
  /[restaurant]/cart      → cart page
  /[restaurant]/checkout  → checkout page
  /api
    /restaurants/[slug]   → get restaurant config
    /menu/[slug]          → get menu for restaurant
    /orders               → POST new order
    /delivery-zones/[slug]→ get delivery zones for restaurant
```

## Airtable patterns

### Base query helper (lib/airtable.ts)
```typescript
import Airtable from 'airtable'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!)

export async function getRecords(table: string, filter?: string) {
  const records = await base(table)
    .select({ filterByFormula: filter || '' })
    .all()
  return records.map(r => ({ id: r.id, ...r.fields }))
}

export async function createRecord(table: string, fields: object) {
  const record = await base(table).create(fields as any)
  return { id: record.id, ...record.fields }
}
```

### Always filter by restaurant slug
```typescript
// CORRECT
const menu = await getRecords('Menu Items', `{Restaurant Slug} = '${slug}'`)

// WRONG — never fetch all records without filtering
const allItems = await getRecords('Menu Items')
```

## API route pattern
```typescript
// app/api/delivery-zones/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getRecords } from '@/lib/airtable'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const zones = await getRecords(
      'Delivery Zones',
      `{Restaurant Slug} = '${params.slug}'`
    )
    return NextResponse.json(zones)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 })
  }
}
```

## Data fetching in components
- Use React Server Components for initial data (no loading state needed)
- Use `useSWR` for client-side data that needs to refresh
- Never call Airtable directly from client components — always go through API routes

## Airtable table names (exact, with spaces)
```
Restaurants          → restaurant config per tenant
Menu Items           → items with category, price, availability
Menu Categories      → ordered categories per restaurant
Orders               → all orders
Order Items          → line items per order
Delivery Zones       → close/far zones per restaurant
```

## Airtable field naming convention
Fields use Title Case with spaces. Map them in TypeScript interfaces:
```typescript
interface DeliveryZone {
  id: string
  'Restaurant Slug': string
  'Zone Name': string        // e.g. "Cerca" or "Lejos"
  'Max Distance KM': number
  'Delivery Cost': number
  'Is Active': boolean
}
```

## Environment variable access
Only in server-side code (API routes, Server Components, lib/).
Never import env vars in client components.

## Error handling
Always wrap Airtable calls in try/catch.
Return `{ error: string }` with appropriate status codes.
Log errors with `console.error('[route-name]', error)`.

## TypeScript
Strict mode. Always type API responses and component props.
Use `interface` for data shapes, `type` for unions/intersections.
