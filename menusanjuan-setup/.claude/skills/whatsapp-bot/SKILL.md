---
name: whatsapp-bot
description: >
  WhatsApp and Twilio integration patterns for MenuSanJuan. Load when
  implementing order notifications, bot responses, or WhatsApp flows.
  Covers both outbound notifications and inbound bot handling.
---

# WhatsApp + Twilio Patterns — MenuSJ

## Setup (lib/twilio.ts)
```typescript
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`

export async function sendWhatsApp(to: string, body: string) {
  return client.messages.create({
    from: FROM,
    to: `whatsapp:${to}`,   // e.g. whatsapp:+5492645551234
    body,
  })
}
```

## Order notification to restaurant owner
```typescript
export async function notifyRestaurantNewOrder(order: Order, restaurant: Restaurant) {
  const items = order.items
    .map(i => `• ${i.quantity}x ${i.name} — ${formatPrice(i.subtotal)}`)
    .join('\n')

  const deliveryLine = order.deliveryType === 'pickup'
    ? '🛍️ *RETIRO en el local*'
    : `🛵 *DELIVERY* — ${order.deliveryAddress}\n💰 Envío: ${formatPrice(order.deliveryCost)}`

  const message = `🔔 *Nuevo pedido #${order.number}*\n\n${items}\n\n${deliveryLine}\n\n💳 Total: *${formatPrice(order.total)}*\n📱 Cliente: ${order.customerPhone}`

  await sendWhatsApp(restaurant.ownerPhone, message)
}
```

## Order confirmation to customer
```typescript
export async function confirmOrderToCustomer(order: Order, restaurant: Restaurant) {
  const pickupMsg = order.deliveryType === 'pickup'
    ? `Tu pedido estará listo para retirar en ${restaurant.address}.`
    : `Tu pedido será enviado a ${order.deliveryAddress}. Tiempo estimado: 30-45 min.`

  const message = `✅ *Pedido confirmado* en ${restaurant.name}!\n\nPedido #${order.number}\nTotal: ${formatPrice(order.total)}\n\n${pickupMsg}\n\n¿Consultas? Respondé este mensaje.`

  await sendWhatsApp(order.customerPhone, message)
}
```

## Inbound webhook (customer replies)
```typescript
// app/api/webhooks/twilio/route.ts
export async function POST(req: NextRequest) {
  const body = await req.formData()
  const from = body.get('From') as string      // whatsapp:+549...
  const text = body.get('Body') as string

  // Pass to Claude for AI response
  const reply = await getAIResponse(from, text)

  // Respond with TwiML
  return new Response(
    `<Response><Message>${reply}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
```

## Phone number format (Argentina)
```typescript
// San Juan, Argentina numbers: +5492645XXXXXXX
// Always store without WhatsApp prefix
// Add whatsapp: prefix only when calling Twilio
function toWhatsAppNumber(localNumber: string): string {
  // Strip everything non-numeric, then add Argentina prefix
  const digits = localNumber.replace(/\D/g, '')
  if (digits.startsWith('549')) return `+${digits}`
  if (digits.startsWith('54')) return `+549${digits.slice(2)}`
  return `+5492645${digits}`  // assume San Juan local
}
```

## Message character limits
- WhatsApp: 4096 chars max per message
- Keep order notifications under 500 chars for readability
- Use *bold* with asterisks for emphasis in WhatsApp
- Use emojis for quick scanning (🔔 new order, ✅ confirmed, ❌ cancelled)

## Delivery type in notifications
Always clearly distinguish pickup vs delivery in every message.
Restaurant owners need to know immediately whether to prepare for delivery.
