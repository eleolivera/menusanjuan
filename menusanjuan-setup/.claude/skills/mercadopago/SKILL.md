---
name: mercadopago
description: >
  Mercado Pago integration patterns for MenuSanJuan. Load when implementing
  payment flows, checkout, order processing, or webhook handling.
  Argentina-specific configuration.
---

# Mercado Pago Patterns — MenuSJ

## SDK setup (lib/mercadopago.ts)
```typescript
import MercadoPagoConfig, { Payment, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
})

export const preferenceClient = new Preference(client)
export const paymentClient = new Payment(client)
```

## Creating a checkout preference (server-side)
```typescript
const preference = await preferenceClient.create({
  body: {
    items: orderItems.map(item => ({
      id: item.id,
      title: item.name,
      quantity: item.quantity,
      unit_price: item.price,  // ARS, no decimals for round prices
      currency_id: 'ARS',
    })),
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_URL}/${restaurantSlug}/checkout/success`,
      failure: `${process.env.NEXT_PUBLIC_URL}/${restaurantSlug}/checkout/failure`,
      pending: `${process.env.NEXT_PUBLIC_URL}/${restaurantSlug}/checkout/pending`,
    },
    auto_return: 'approved',
    notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhooks/mercadopago`,
    external_reference: orderId,  // your internal order ID
    statement_descriptor: 'MENUSANJUAN',
  }
})

// Redirect user to preference.init_point
```

## Delivery cost as a line item
```typescript
// Always add delivery as a separate line item, not bundled into product prices
if (deliveryZone && deliveryZone.cost > 0) {
  items.push({
    id: 'delivery',
    title: `Envío (${deliveryZone.name})`,
    quantity: 1,
    unit_price: deliveryZone.cost,
    currency_id: 'ARS',
  })
}
```

## Webhook handler pattern
```typescript
// app/api/webhooks/mercadopago/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.type === 'payment') {
    const payment = await paymentClient.get({ id: body.data.id })

    if (payment.status === 'approved') {
      const orderId = payment.external_reference
      await updateOrderStatus(orderId, 'paid')
      await notifyRestaurantWhatsApp(orderId)
    }
  }

  return NextResponse.json({ received: true })
}
```

## Price formatting (Argentina)
```typescript
// Always use this for display
export function formatPrice(amount: number): string {
  return `$ ${amount.toLocaleString('es-AR')}`
}
```

## Important Argentina-specific notes
- Currency: ARS only
- Installments (cuotas): can be enabled via `installments` in preference
- Test credentials: use test access token for development
- Production: requires approved Mercado Pago account
- Webhook signature verification: check `x-signature` header in production
