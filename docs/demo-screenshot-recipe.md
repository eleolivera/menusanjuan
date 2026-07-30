# Screenshot recipe — the /para-restaurantes demo walkthrough

**Purpose:** the "De la orden al reparto, paso a paso" section on `/para-restaurantes` has 8 placeholder slots waiting for real screenshots. This doc tells you exactly what to capture, in what URL, what to name the file, and where to drop it.

Data source: a seeded **Demo Burger Bar** resta (slug `demo-burger-bar`) with a fake menu (3 burgers, 2 fries, 3 drinks), 3 fake customers (Juan Pérez, María Torres, Pedro López — all `+54 264 555-000X` numbers), and 10 fake orders across states. Nothing real, so no customer data leaks.

## Once you have a screenshot

1. Save it to `~/Downloads/` with the filename listed for each step below (e.g. `step-1-menu.png`)
2. Tell me which files are ready — I'll compress + move them into `webapp/public/showcase/demo/` and flip the `ready: false` flags to `true` in `webapp/src/app/para-restaurantes/page.tsx`

You can send them one at a time or all in one batch — the page shows placeholders for the ones not-yet-ready, real images for the ones that are.

---

## Step 1 — Cliente elige tu resta + arma pedido

- **URL to open** (on a phone, or Chrome DevTools "Toggle Device Toolbar" set to iPhone SE / Pixel 5): `https://www.menusanjuan.com/demo-burger-bar`
- **What to capture:** the menu page, scrolled to show at least the "Burgers" category with the 3 items visible (Cheeseburger Clásica has a "Popular" badge). Cover image + resta name at the top ideally in-frame.
- **Filename:** `step-1-menu.png`
- **Aspect:** portrait phone screenshot (9:19-ish)

## Step 2 — Cliente hace checkout

- **Same URL** `demo-burger-bar` on a phone
- Tap Cheeseburger Clásica → **Agregar** → the cart drawer will appear
- **What to capture:** the cart drawer OR the checkout form with the address input + delivery fee visible
- **Filename:** `step-2-checkout.png`
- **Aspect:** portrait phone

## Step 3 — Pedido cae en el Kanban

- Log into `/restaurante` as the Demo Burger Bar owner (email: `demo-burger-bar@menusanjuan.com`; you'll need to reset the password from `/admin` first)
- Go to `/restaurante/pedidos`
- **What to capture:** the Kanban board with the **ORD-DEMO-001** card visible in the "Pendiente" (or "Generado") column. Customer name "Juan Pérez", total, items visible.
- **Filename:** `step-3-kanban.png`
- **Aspect:** landscape tablet (4:3) — take on a tablet, iPad, or a wide desktop browser resized to ~1024px

## Step 4 — Pasás a "En Cocina"

- Same Kanban page
- Drag ORD-DEMO-001 (or another Pendiente card if you re-place one) to the "En Cocina" column
- **What to capture:** the Kanban with the ORD-DEMO-002 card visible in "En Cocina" (this one is already in that state and has ítem details + "Sin cebolla por favor" note)
- **Filename:** `step-4-cocina.png`
- **Aspect:** landscape tablet

## Step 5 — Ticket con QR sale de la impresora

- **This one's a physical photo, not a screenshot.**
- Open the ORD-DEMO-002 order in your Kanban → tap the print / ticket button (whatever the flow is on your device) → let it print
- Take a photo with your phone of the printed ticket on a clean surface. Make sure the QR code is visible + sharp.
- **Filename:** `step-5-ticket.jpg`
- **Aspect:** tall portrait (long thermal receipt shape ~1:2.4). Crop tight so it's just the ticket + a bit of background.

## Step 6 — Repartidor escanea el QR ⭐ (this is the big selling point)

- Open this URL on a phone: `https://www.menusanjuan.com/d/demo-order-processing?t=demo1234abcd`
- **What to capture:** the driver's order-detail page. Should show:
  - Order number ORD-DEMO-002
  - Customer name (María Torres) + phone (tap-to-call link)
  - Address (Sarmiento 890) with the blue "Maps →" button
  - Items list including the "Sin cebolla" note
  - Payment status (PAGADO ✓)
  - Big "Marcar entregado" button at the bottom
- **Filename:** `step-6-driver.png`
- **Aspect:** portrait phone. Take this one with real intent — it's the marquee shot.

## Step 7 — Dashboard del día

- In `/restaurante` (same session as steps 3-4), open `/restaurante/dashboard` (or wherever the today-view lives — the analytics tab)
- **What to capture:** today's orders count + revenue tiles + any performance charts. Should show at least 1 order today (ORD-DEMO-003 is a DELIVERED order from ~2h ago).
- **Filename:** `step-7-dashboard.png`
- **Aspect:** landscape tablet or desktop

## Step 8 — Clientes VIP

- Open `/restaurante/clientes` (customer list — Juan Pérez should be at the top with 6 delivered orders, $106,600 spent)
- **What to capture:** the customer list showing Juan Pérez as the VIP + at least 2 other rows
- **Filename:** `step-8-vip.png`
- **Aspect:** landscape tablet or desktop

---

## What to skip if you're short on time

If you only have time for 3-4 shots, prioritize:
1. **Step 6 (driver QR)** — this is the whole reason we started
2. **Step 3 (Kanban)** — sells the "hey, this is a real system" moment
3. **Step 8 (VIP clients)** — the "we know your business" moment
4. **Step 1 (menu)** — the customer-facing pitch

The rest are nice-to-have.

## Where the placeholders live

The unshipped placeholders in the page render as simple gray cards saying "📸 Screenshot pendiente · Paso N" inside a phone/tablet/ticket frame. Users on prod will see them until the real files land. They don't look broken — just clearly "coming soon".

## Anti-leak reminder

- Zero real customer names / phones in these screenshots — they're all seeded demo data (Juan Pérez / María Torres / Pedro López + `+54 264 555-000X` phones)
- The demo resta is public at `menusanjuan.com/demo-burger-bar` (isActive=true) so it appears in the resta grid on the homepage. If that bothers you, tell me and I'll add a `isDemo` flag + filter it out of the public list.
