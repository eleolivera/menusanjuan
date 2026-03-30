# Client Login Flow — Design Document

## Overview

Phone-based OTP login for customers. Login is **never required** — it's a convenience that unlocks saved addresses, auto-fill at checkout, and order history. Uses the existing unused `USER` role.

## User Flow

```
Anonymous → Taps "Ingresa" (header) → Bottom sheet opens
  → Step 1: Enter phone (reuses PhoneInput)
  → Step 2: Enter 6-digit OTP
  → Step 3: "Como te llamas?" (new accounts only)
  → Logged in → Cookie set (90 days)

Checkout (logged in):
  → Name + phone auto-filled
  → Saved addresses selectable via AddressPicker
  → After order: "Guardar esta direccion?" prompt

Mi Cuenta (/mi-cuenta):
  → Profile (name editable, phone read-only)
  → Saved addresses (add/edit/delete, max 5)
  → Order history (paginated, expandable)
```

---

## Schema Changes (Prisma)

### New: Customer

```prisma
model Customer {
  id        String   @id @default(cuid())
  userId    String   @unique
  phone     String   @unique              // E.164 format: +5492645551234
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  addresses     CustomerAddress[]
  orders        Order[]
  verifications PhoneVerification[]

  @@index([phone])
}
```

### New: CustomerAddress

```prisma
model CustomerAddress {
  id         String   @id @default(cuid())
  customerId String
  label      String   @default("Casa")   // "Casa", "Trabajo", custom
  address    String
  latitude   Float?
  longitude  Float?
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
}
```

### New: PhoneVerification

```prisma
model PhoneVerification {
  id         String   @id @default(cuid())
  phone      String                       // E.164 format
  code       String                       // 6-digit code
  expiresAt  DateTime                     // 5 min from creation
  attempts   Int      @default(0)         // Max 5 attempts
  verified   Boolean  @default(false)
  customerId String?
  createdAt  DateTime @default(now())

  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([phone, code])
  @@index([phone, createdAt])
}
```

### Modified: Order

```prisma
model Order {
  // ... existing fields ...
  customerId  String?    // Optional FK to Customer (logged-in orders)

  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([customerId, createdAt])
}
```

### Modified: User

```prisma
model User {
  // ... existing fields ...
  customer  Customer?
}
```

---

## API Routes

All under `/api/client/...`

### POST /api/client/send-code

Send 6-digit OTP to phone via SMS (Twilio for MVP).

- Request: `{ "phone": "+5492641234567" }`
- Response: `{ "success": true, "expiresIn": 300 }`
- Rate limit: 3 codes per phone per 10-minute window
- **Always return `{ success: true }` to prevent phone enumeration**

### POST /api/client/verify-code

Verify OTP, create/find Customer + User, set `menusj_client` cookie.

- Request: `{ "phone": "+5492641234567", "code": "482913" }`
- Response: `{ "success": true, "customer": {...}, "isNewAccount": true }`
- Max 5 attempts per code, 5-minute expiry, 15-minute lockout after failures
- On new account: create User (role USER) + Customer
- Retroactively link orders by matching `customerPhone`

### GET /api/client/me

Return customer profile + saved addresses.

- Response: `{ "customer": { "id", "name", "phone", "addresses": [...] } }`
- 401 if no valid session

### PATCH /api/client/me

Update customer name.

- Request: `{ "name": "Juan Perez" }`

### POST /api/client/addresses

Save a new address (max 5 enforced server-side).

- Request: `{ "label": "Trabajo", "address": "...", "latitude": ..., "longitude": ... }`

### DELETE /api/client/addresses/[id]

Delete a saved address (verify ownership).

### GET /api/client/orders

Paginated order history.

- Query: `?page=1&limit=20`
- Response: `{ "orders": [...], "total": 47, "page": 1, "pages": 3 }`

### POST /api/client/logout

Clear `menusj_client` cookie.

---

## Session: `menusj_client` Cookie

- **HMAC-signed** with server secret (NOT plain base64 like existing cookies)
- Payload: `{ customerId, phone, ts }`
- 90-day expiry, HttpOnly, Secure (production), SameSite=lax
- Independent from `menusj_session` (restaurant owners) and `menusj_admin`
- Never cleared by restaurant/admin login flows

---

## New Components

### ClientLoginModal

Bottom sheet (mobile) / centered modal (desktop). Three steps:

1. **Phone entry**: Reuses `PhoneInput`, CTA "Enviame el codigo"
2. **OTP entry**: 6 individual digit inputs (48x48px), auto-focus-next, auto-submit on 6th digit, "Reenviar codigo" with 60s countdown
3. **Name prompt** (new accounts only): "Como te llamas?" with text input

### ClientLoginButton

Header button positioned top-right of store cover image.

- **Anonymous**: Circle icon button (user outline), "Ingresa" label on sm+
- **Logged in**: Circle with initial letter, dropdown with "Mi cuenta" + "Cerrar sesion"

### AddressPicker

Radio-style list of saved addresses in checkout. Each card shows label badge + address text. Last option: "Otra direccion" (dashed border, plus icon). When saved address selected, LocationPicker is hidden.

### SaveAddressPrompt

Appears in OrderModal's "sent" step when a new address was used. Label chips: "Casa", "Trabajo", "Otro" (custom input). Buttons: "Guardar" / "No, gracias".

### OrderHistoryList

Self-fetching paginated list. Each order card: restaurant name, order number, date, item summary, total, status badge. Expandable for full details. "Cargar mas" button (not page numbers).

---

## New Pages

### /mi-cuenta

Customer account page. Single column, `max-w-2xl`. Three sections:

1. **Mi Perfil**: Name (editable inline), phone (read-only with flag)
2. **Mis Direcciones**: List with add/delete, max 5, LocationPicker for new
3. **Mis Pedidos**: OrderHistoryList component

Redirects to `/` if not authenticated.

---

## Modified Files

| File | Changes |
|------|---------|
| `[store]/page.tsx` | Add `ClientLoginButton` to header cover area |
| `StoreMenu.tsx` | Fetch client session, pass customer data to OrderModal |
| `OrderModal.tsx` | Auto-fill name/phone, AddressPicker integration, SaveAddressPrompt in sent step, attach `customerId` to order |
| `schema.prisma` | New models + Order.customerId |

---

## UI Copy (Argentine Spanish, vos form)

### Login Modal

| Key | Text |
|-----|------|
| title_phone | "Ingresa a tu cuenta" |
| subtitle_phone | "Ingresa tu numero de telefono para continuar" |
| btn_send | "Enviame el codigo" |
| title_otp | "Ingresa el codigo" |
| subtitle_otp | "Te enviamos un codigo de 6 digitos al {phone}" |
| error_invalid | "El codigo es incorrecto. Revisa e intenta de nuevo." |
| error_expired | "El codigo expiro. Solicita uno nuevo." |
| error_rate_limit | "Demasiados intentos. Espera {minutes} minutos." |
| link_resend | "Reenviar codigo" |
| link_resend_countdown | "Reenviar en {seconds}s" |
| title_name | "Como te llamas?" |
| subtitle_name | "Asi te identificamos en tus pedidos" |
| btn_save_name | "Listo" |

### Header Button

| Key | Text |
|-----|------|
| anonymous | "Ingresa" |
| greeting | "Hola, {name}" |
| mi_cuenta | "Mi cuenta" |
| logout | "Cerrar sesion" |

### Address Picker

| Key | Text |
|-----|------|
| heading | "Direccion de entrega" |
| saved_label | "Tus direcciones guardadas" |
| option_new | "Usar otra direccion" |

### Save Address Prompt

| Key | Text |
|-----|------|
| heading | "Guardar esta direccion?" |
| subtitle | "Asi la proxima vez no tenes que volver a cargarla" |
| label_casa | "Casa" |
| label_trabajo | "Trabajo" |
| label_otro | "Otro" |
| btn_save | "Guardar" |
| btn_dismiss | "No, gracias" |

### Order History

| Key | Text |
|-----|------|
| empty_title | "Todavia no hiciste ningun pedido" |
| empty_subtitle | "Cuando hagas tu primer pedido, va a aparecer aca" |
| load_more | "Cargar mas" |
| status_generated | "Generado" |
| status_paid | "Pagado" |
| status_processing | "En preparacion" |
| status_delivered | "Entregado" |
| status_cancelled | "Cancelado" |

### Mi Cuenta Page

| Key | Text |
|-----|------|
| page_title | "Mi Cuenta" |
| section_profile | "Mi Perfil" |
| section_addresses | "Mis Direcciones" |
| section_orders | "Mis Pedidos" |
| btn_add_address | "Agregar" |
| delete_confirm | "Seguro que queres eliminar esta direccion?" |
| address_empty | "No tenes direcciones guardadas." |
| not_logged_in | "Ingresa para ver tu cuenta" |

---

## Status Badges (Tailwind)

| Status | Classes |
|--------|---------|
| GENERATED | `bg-blue-100 text-blue-700` |
| PAID | `bg-emerald-100 text-emerald-700` |
| PROCESSING | `bg-amber-100 text-amber-700` |
| DELIVERED | `bg-slate-100 text-slate-700` |
| CANCELLED | `bg-red-100 text-red-700` |

---

## QA Critical Findings

### Critical

1. **Sign the cookie**: `menusj_client` must be HMAC-SHA256 signed with a server secret. Existing cookies are plain base64 (forgeable) — do not repeat this pattern.
2. **Rate limit OTP**: Max 5 attempts/code, 3 codes/phone/10min, 5-min expiry, 15-min lockout after failures.
3. **Prevent phone enumeration**: Always return `{ success: true }` from send-code regardless of phone existence.

### High

4. **Phone normalization**: Normalize `customerPhone` to E.164 at order creation + migration for historical data.
5. **Dual role support**: Allow restaurant owners to also be customers — Customer record is role-independent.
6. **Auth guards on existing `/api/orders`**: Add authentication to existing order endpoints.

### Medium

7. **Address limit enforcement**: Server-side max 5 addresses check in POST handler.
8. **OTP delivery**: Use SMS via Twilio for MVP (WhatsApp Business API requires Meta approval).
9. **Cache client session**: Check cookie existence client-side before calling `/api/client/me` to avoid unnecessary API calls for anonymous users.

---

## Task Breakdown

1. Schema + migrations (45 min)
2. Client auth library with HMAC-signed cookies (60 min)
3. Auth API routes — send-code, verify-code, session (60 min)
4. ClientAuthProvider + LoginButton (60 min)
5. ClientLoginModal — phone + OTP + name steps (60 min)
6. Checkout integration — auto-fill, AddressPicker, SaveAddressPrompt (90 min)
7. Customer profile API routes (45 min)
8. Mi Cuenta page (90 min)
9. Retroactive order linking + phone normalization (30 min)
10. QA + edge case testing (60 min)
