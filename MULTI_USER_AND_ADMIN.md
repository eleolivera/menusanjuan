# MenuSanJuan — Multi-User & Admin Architecture
## Reference for AutoSanJuan alignment

> Generated from the MenuSanJuan codebase. AutoSanJuan should read this to align their implementation.

---

## Session Model

Session stores **userId** (not a business slug). One user can own multiple businesses.

### Cookie
- Name: `menusj_session`
- Content: Base64 JSON `{ userId, activeSlug, ts }`
- 30-day expiry, httpOnly, sameSite=lax

### Session API: `GET /api/restaurante/session`
Returns:
```json
{
  "authenticated": true,
  "user": { "id", "email", "name", "phone", "role" },
  "restaurants": [
    { "id", "name", "slug", "cuisineType", "logoUrl", ... },
    { "id", "name", "slug", "cuisineType", "logoUrl", ... }
  ],
  "activeRestaurant": { "id", "name", "slug", ... },
  "pendingClaims": [
    { "id", "status", "dealer": { "id", "name", "slug" } }
  ]
}
```

### Switch active business: `PATCH /api/restaurante/session`
```json
{ "slug": "new-active-slug" }
```

---

## Database Schema (key models)

### User
```
id, email, password, name, phone
role: USER | BUSINESS | ADMIN
emailVerified: boolean
verifyCode, resetCode, resetExpires
```

### Account (links User → Business)
```
id, userId, type: "dealer"
```
A User can have **multiple Accounts**, each with one Dealer (business).

### Dealer (the business entity — "restaurant" in MenuSJ, "dealership" in AutoSJ)
```
id, accountId (→ Account), name, slug (unique URL)
isVerified, claimedAt
sourceProfileId, sourceSite
... business-specific fields
```

### ClaimRequest
```
id, dealerId, userId
status: PENDING | CODE_SENT | APPROVED | REJECTED
code: 6-char (admin-generated, deterministic SHA256)
notes, requestedAt, resolvedAt, resolvedBy
```

---

## Claim Flow

### Public page (every business page shows this if unclaimed):
1. "¿Es tu negocio?" banner → `ClaimBanner` component
2. Not logged in → link to register page
3. Logged in → "Reclamar" → `POST /api/claim { action: "submit", dealerId }`
4. Creates ClaimRequest with status=PENDING

### Admin panel (`/admin`):
1. Admin sees pending claim in Claims tab
2. Clicks "Generar Código" → `PATCH /api/admin/claims { claimId, action: "generate_code" }`
3. Code generated (SHA256 deterministic), status→CODE_SENT
4. Admin contacts business owner via WhatsApp/phone, shares code

### User enters code:
1. On the business page, ClaimBanner shows code input field
2. User enters 6-char code → `POST /api/claim { action: "verify", claimId, code }`
3. Verification:
   - Account re-linked to claiming user (`account.userId = claimingUser.id`)
   - Dealer marked `isVerified=true, claimedAt=now`
   - User role → BUSINESS
   - Placeholder user deleted if orphaned
   - Session updated with new active business

### Key: ownership transfer re-links the Account, doesn't swap User records
This allows one user to own multiple businesses — each claim adds another Account→Dealer to their user.

---

## Header Dropdown (logged-in user)

```
┌─────────────────────────┐
│ user@email.com          │ ← user info
├─────────────────────────┤
│ MIS RESTAURANTES        │ ← switcher (if 2+)
│ ✓ Puerto Pachatas       │
│   La Estancia           │
├─────────────────────────┤
│ Puerto Pachatas         │ ← active business
│ /puerto-pachatas        │
│ 📋 Pedidos              │
│ 🍽️ Mi Menú              │
│ 📊 Analíticas           │
│ ⚙️ Mi Restaurante       │
│ 👁️ Ver Página Pública   │
├─────────────────────────┤
│ RECLAMOS PENDIENTES     │ ← if any
│ ⏳ Café del Centro      │
│    → Ingresar código    │
├─────────────────────────┤
│ 🚪 Cerrar Sesión        │
└─────────────────────────┘
```

On mobile: the business avatar/logo button is always visible next to the hamburger. Tap → same dropdown. Hamburger is only for page navigation links.

---

## Admin Panel (`/admin`)

### Auth
- Role-based: User must have `role=ADMIN`
- Session cookie `menusj_admin` (separate from business session)
- Login: email + password, verified against ADMIN role

### Tabs
1. **Restaurantes** — all businesses: name, slug, owner email, status (Disponible/Registrado/Verificado), menu count, order count
2. **Reclamos** — all claim requests: status, user info, business info, code display, generate/reject buttons
3. **Usuarios** — all users: email, role, email verified, business count, claim count, registration date

### APIs
- `GET /api/admin/restaurants` — all businesses with ownership status
- `GET /api/admin/claims` — all claim requests
- `PATCH /api/admin/claims` — generate code or reject
- `GET /api/admin/users` — all users
- `POST /api/admin/login` — admin login

---

## Registration Flow

### Step 1: Email + Password
### Step 1.5: Choose — Claim Existing or Create New
- Shows unclaimed businesses (placeholder `@menusanjuan.com` emails)
- Searchable list with cover images, cuisine type, item counts
- "Reclamar este" → instant claim (transfers ownership)
- "Crear uno nuevo" → continues to step 2

### Step 2: Business Details (new only)
- Name, WhatsApp, cuisine type, address (Google Places autocomplete), description

### Step 3: Images (new only)
- Logo + cover upload (R2) or URL paste
- Live preview card

### Step 4: Done
- Success page with business URL + next steps

---

## Key Files for AutoSanJuan to Reference

| File | Purpose |
|---|---|
| `src/lib/restaurante-auth.ts` | Session management, login, multi-business support |
| `src/app/api/restaurante/session/route.ts` | Session API (GET full session, PATCH switch, DELETE logout) |
| `src/app/api/claim/route.ts` | Claim submit + verify |
| `src/app/api/admin/claims/route.ts` | Admin claim management |
| `src/components/Header.tsx` | Header with business switcher + pending claims |
| `src/components/ClaimBanner.tsx` | "Es tu negocio?" on public pages |
| `src/app/restaurante/register/page.tsx` | Registration with claim-or-create flow |
| `src/app/admin/page.tsx` | Admin panel (3 tabs) |
| `prisma/schema.prisma` | Full database schema |

---

## For AutoSanJuan: What to Adapt

1. **Session**: Store userId, not dealerId. Return all dealerships + active one.
2. **Header**: Add dealership switcher dropdown. Show pending claims.
3. **Claim flow**: Use ClaimRequest model. Admin generates code, user enters it.
4. **Admin panel**: 3 tabs (Concesionarias, Reclamos, Usuarios). Role-based auth.
5. **Registration**: Add "claim existing" option alongside "create new".
6. **Account model**: One user → many Accounts → each with one Dealer. Re-link Account on claim approval.

The UI terminology differs (restaurante vs concesionaria) but the data model and flows are identical.
