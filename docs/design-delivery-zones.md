# Delivery Zones -- Design Specification

Designer output for the Delivery Zones feature.
Covers two surfaces: Admin config (dark theme) and Customer order flow (light theme).

---

## 1. User Flows

### 1A. Admin: Configurar delivery (dark theme, `/admin/restaurants/[id]`)

**Precondition:** Restaurant owner is on the admin restaurant detail page, "info" tab.

| Step | Action | UI State |
|------|--------|----------|
| 1 | Owner scrolls to new "Delivery" section below existing fields | Sees toggle "Delivery habilitado" -- OFF by default |
| 2 | Owner toggles ON | Section expands with zone config fields (animate-fade-in) |
| 3 | Owner fills "Zona cercana": radio (km) + precio ($) | Two inline inputs per zone, pre-filled placeholders |
| 4 | Owner fills "Zona lejana": radio (km) + precio ($) | Same layout, visually grouped |
| 5 | Owner clicks "Guardar cambios" (existing save button) | Spinner, then success toast |
| 6 | Error: radius or price is 0 / negative | Inline red text: "El valor debe ser mayor a 0" |
| 7 | Error: far zone radius <= close zone radius | Inline: "La zona lejana debe ser mayor que la cercana" |

### 1B. Customer: Elegir metodo de entrega (light theme, OrderModal)

**Precondition:** Customer has items in cart, taps "Continuar" from cart step.

| Step | Action | UI State |
|------|--------|----------|
| 1 | Cart step -> "Continuar" | New step: "delivery-method" appears |
| 2 | Sees two large tap targets: "Delivery" and "Retiro en local" | Radio-card style, icon + label, 44px min height |
| 3a | Taps "Retiro en local" | Card highlights orange, fee line shows "$0", "Continuar" enables |
| 3b | Taps "Delivery" | Card highlights orange, LocationPicker appears below |
| 4 | Enters address in LocationPicker, confirms | System calculates distance to restaurant lat/lng |
| 5a | Distance <= close zone radius | Green badge: "Zona cercana -- Envio $X.XXX", fee set |
| 5b | Distance <= far zone radius | Amber badge: "Zona lejana -- Envio $X.XXX", fee set |
| 5c | Distance > far zone radius | Red alert: "Tu direccion esta fuera de la zona de delivery. Solo podes elegir Retiro en local." Delivery option disabled, pickup auto-selected |
| 6 | "Continuar" -> goes to "info" step (name, phone, notes) | Address already captured, LocationPicker hidden |
| 7 | "info" -> "confirm" step | Summary shows: Subtotal, Envio line, Total |
| 8 | WhatsApp message includes delivery method + fee | See copy below |

### 1C. Customer: Restaurant has NO delivery configured

| Step | Action | UI State |
|------|--------|----------|
| 1 | Cart -> "Continuar" | Skips delivery-method step entirely, goes straight to "info" |
| 2 | Info step shows LocationPicker as before (no delivery fee logic) | Backwards-compatible with current behavior |

---

## 2. Component Inventory

### New Components

| Component | File Path | Props Interface | Key Elements |
|-----------|-----------|----------------|--------------|
| `DeliveryMethodPicker` | `webapp/src/components/DeliveryMethodPicker.tsx` | `{ restaurantLat: number; restaurantLng: number; closeZoneRadius: number; closeZonePrice: number; farZoneRadius: number; farZonePrice: number; onMethodSelect: (method: "delivery" \| "pickup", fee: number, address?: string, lat?: number, lng?: number) => void }` | Two radio cards, LocationPicker embed, zone badge, out-of-range error |
| `DeliveryZoneConfig` | `webapp/src/components/admin/DeliveryZoneConfig.tsx` | `{ deliveryEnabled: boolean; closeZoneRadius: number; closeZonePrice: number; farZoneRadius: number; farZonePrice: number; onChange: (config: DeliveryConfig) => void }` | Toggle, two zone rows with km + $ inputs, validation errors |
| `DeliveryFeeSummary` | `webapp/src/components/DeliveryFeeSummary.tsx` | `{ subtotal: number; deliveryFee: number; deliveryMethod: "delivery" \| "pickup" \| null }` | Line items: Subtotal, Envio, Total with divider |
| `ZoneBadge` | `webapp/src/components/ZoneBadge.tsx` | `{ zone: "close" \| "far" \| "out-of-range"; price?: number }` | Colored rounded badge with icon |

### Modified Components

| Component | File Path | Changes |
|-----------|-----------|---------|
| `OrderModal` | `webapp/src/components/OrderModal.tsx` | Add "delivery-method" step between "cart" and "info". Pass delivery fee to confirm step. Update WhatsApp message. Conditionally skip step if restaurant has no delivery config. |
| `FloatingCart` | `webapp/src/components/FloatingCart.tsx` | No changes needed (shows subtotal only) |
| `LocationPicker` | `webapp/src/components/LocationPicker.tsx` | No changes -- reused as-is inside DeliveryMethodPicker |
| Admin restaurant detail | `webapp/src/app/admin/restaurants/[id]/page.tsx` | Add DeliveryZoneConfig section in "info" tab, after existing fields. Add new state vars. Include in save payload. |

---

## 3. UI Copy -- Argentina Spanish (vos form)

### Admin (dark theme)

```
Section title:     "Delivery"
Toggle label:      "Delivery habilitado"
Toggle helper:     "Activa para que tus clientes puedan pedir envio a domicilio"

Zone 1 title:      "Zona cercana"
Zone 1 radius:     label "Radio (km)" / placeholder "3"
Zone 1 price:      label "Precio envio ($)" / placeholder "500"

Zone 2 title:      "Zona lejana"
Zone 2 radius:     label "Radio (km)" / placeholder "7"
Zone 2 price:      label "Precio envio ($)" / placeholder "1.000"

Validation:
  - empty/zero:      "El valor debe ser mayor a 0"
  - far <= close:    "La zona lejana debe tener un radio mayor que la cercana"
  - price negative:  "El precio no puede ser negativo"
```

### Customer -- Delivery Method Step

```
Step title:         "Metodo de Entrega"

Card 1 - Delivery:
  Icon:             truck/moto icon
  Label:            "Delivery"
  Sublabel:         "Te lo llevamos a tu domicilio"

Card 2 - Pickup:
  Icon:             store/bag icon
  Label:            "Retiro en local"
  Sublabel:         "Retiras vos por el local"

Zone badges:
  Close zone:       "Zona cercana -- Envio $X.XXX"
  Far zone:         "Zona lejana -- Envio $X.XXX"
  Out of range:     "Tu direccion esta fuera de la zona de delivery"

Out of range detail: "Solo podes elegir Retiro en local. Si necesitas delivery, contacta al restaurante."

Buttons:
  Back:             "Volver"
  Continue:         "Continuar"
```

### Customer -- Confirm Step (updated)

```
Summary header:     "Resumen"
Line - Subtotal:    "Subtotal" / "$X.XXX"
Line - Delivery:    "Envio (zona cercana)" or "Envio (zona lejana)" or "Retiro en local" / "$X.XXX" or "$0"
Divider
Line - Total:       "Total" / "$X.XXX"

Delivery info:
  Label:            "Metodo"
  Value delivery:   "Delivery a domicilio"
  Value pickup:     "Retiro en local"
```

### WhatsApp Message (updated template)

```
[existing header]

[existing item lines]

[existing total line -- becomes subtotal]
Envio: $X.XXX (Zona cercana)     ← or "Retiro en local ($0)"
Total: $X.XXX

[existing customer info]
Metodo: Delivery a domicilio      ← or "Retiro en local"
Direccion: [address]              ← or "Retira en local"
[existing map link if delivery]
```

### Error States

```
Network error (distance calc):    "No pudimos calcular la distancia. Verifica tu conexion e intenta de nuevo."
Geolocation denied:               "Necesitamos tu ubicacion para calcular el envio. Podes escribir la direccion manualmente."
Restaurant has no lat/lng:        (skip delivery method step entirely, fallback to current flow)
API error saving config:          "Error al guardar la configuracion de delivery. Intenta de nuevo."
```

---

## 4. Database Schema Changes

### Dealer model (Prisma) -- add fields

```prisma
model Dealer {
  // ... existing fields ...

  // Delivery zone configuration
  deliveryEnabled    Boolean @default(false)
  closeZoneRadius    Float?                    // km
  closeZonePrice     Float?                    // ARS
  farZoneRadius      Float?                    // km
  farZonePrice       Float?                    // ARS
}
```

### Order model (Prisma) -- add fields

```prisma
model Order {
  // ... existing fields ...

  deliveryMethod   String?       // "delivery" | "pickup" | null (legacy)
  deliveryFee      Float?        // ARS, 0 for pickup
  deliveryZone     String?       // "close" | "far" | null
}
```

### Migration notes

- `deliveryEnabled` defaults to `false` -- all existing restaurants unaffected
- `deliveryFee` on Dealer is now DEPRECATED (single flat fee). Keep for backwards compat but stop reading it in new code.
- Order.deliveryMethod `null` means legacy order (before this feature)
- Order.total should remain the GRAND total (subtotal + deliveryFee) for backwards compat with reporting

---

## 5. State Management Plan

### OrderModal state (expanded)

```typescript
// Existing state
const [step, setStep] = useState<"cart" | "delivery-method" | "info" | "confirm" | "sent">("cart");

// New state
const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup" | null>(null);
const [deliveryFee, setDeliveryFee] = useState<number>(0);
const [deliveryZone, setDeliveryZone] = useState<"close" | "far" | null>(null);

// Derived
const grandTotal = total + deliveryFee;   // total = item subtotal (existing), grandTotal = what customer pays
```

**Where state lives:**

| State | Location | Why |
|-------|----------|-----|
| Cart items, subtotal | OrderModal (existing) | Local to checkout flow |
| deliveryMethod, deliveryFee, deliveryZone | OrderModal (new) | Local to checkout flow, passed to API on submit |
| Delivery config (enabled, zones) | Server props from Dealer record | Fetched once at page load, passed as props to OrderModal |
| Address, lat/lng | OrderModal (existing) | Set by LocationPicker callback, now also used for distance calc |
| Distance calculation | Computed inside DeliveryMethodPicker | Haversine formula, no API call needed |

### Data flow

```
[store]/page.tsx
  └── fetches Dealer record (includes delivery config)
      └── passes deliveryConfig as prop to OrderModal
          └── OrderModal renders DeliveryMethodPicker
              └── DeliveryMethodPicker uses LocationPicker
                  └── on address confirm: calculates haversine distance
                  └── determines zone + fee
                  └── calls onMethodSelect(method, fee, address, lat, lng)
          └── OrderModal updates deliveryMethod, deliveryFee, deliveryZone
          └── On confirm: sends to POST /api/orders with new fields
          └── WhatsApp message includes delivery info
```

### Distance calculation (client-side, no API)

```typescript
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

This avoids external API calls for distance. Haversine is accurate enough for city-scale delivery zones in San Juan's flat geography.

### Admin state (DeliveryZoneConfig)

```typescript
// Inside AdminRestaurantDetail, alongside existing editable fields:
const [deliveryEnabled, setDeliveryEnabled] = useState(false);
const [closeZoneRadius, setCloseZoneRadius] = useState("");
const [closeZonePrice, setCloseZonePrice] = useState("");
const [farZoneRadius, setFarZoneRadius] = useState("");
const [farZonePrice, setFarZonePrice] = useState("");
```

These get included in the existing `handleSave` PATCH request body, saved to Dealer record.

---

## 6. Responsive Behavior

### DeliveryMethodPicker (customer, light theme)

| Breakpoint | Layout |
|------------|--------|
| Mobile (375px default) | Two cards stacked vertically, full width. LocationPicker below when "Delivery" selected. Zone badge full width. |
| sm (640px+) | Two cards side by side in a grid (`grid grid-cols-2 gap-3`). LocationPicker spans full width below grid. |
| md+ | Same as sm, max-w-lg from parent modal constrains width. |

### DeliveryZoneConfig (admin, dark theme)

| Breakpoint | Layout |
|------------|--------|
| Mobile (375px) | Toggle full width. Each zone: title, then two inputs stacked vertically (radius on top, price below). |
| sm (640px+) | Each zone: title, then two inputs side by side (`grid grid-cols-2 gap-3`). |

### Confirm step fee summary

| Breakpoint | Layout |
|------------|--------|
| All | Single column. Line items with label left, price right (`flex justify-between`). No layout change needed -- inherits from existing confirm step. |

### Key mobile considerations

- Radio cards: min-h-[56px] for comfortable tap targets (44px content + padding)
- Zone badge: full width on mobile so text does not truncate
- Out-of-range error: prominent red card, not inline text (easy to miss on small screens)
- LocationPicker map height stays 250px (already responsive)
- All inputs use py-3 for 44px+ tap targets (existing pattern)

---

## 7. File Paths Summary

New files to create:
- `webapp/src/components/DeliveryMethodPicker.tsx`
- `webapp/src/components/admin/DeliveryZoneConfig.tsx`
- `webapp/src/components/DeliveryFeeSummary.tsx`
- `webapp/src/components/ZoneBadge.tsx`
- `webapp/src/lib/haversine.ts`
- `webapp/prisma/migrations/[timestamp]_add_delivery_zones/migration.sql`

Files to modify:
- `webapp/prisma/schema.prisma` (add fields to Dealer and Order)
- `webapp/src/components/OrderModal.tsx` (add delivery-method step, update confirm, update WhatsApp)
- `webapp/src/app/admin/restaurants/[id]/page.tsx` (add DeliveryZoneConfig section)
- `webapp/src/app/api/admin/restaurants/[id]/route.ts` (handle new fields in PATCH)
- `webapp/src/app/api/orders/route.ts` (accept and store new fields)
- `webapp/src/app/[store]/page.tsx` (pass delivery config props to OrderModal)
