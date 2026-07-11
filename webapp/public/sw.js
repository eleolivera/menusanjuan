// MenuSanJuan driver PWA service worker
// Scope: '/' — serves web push notifications for delivery offers.
// Registered by /components/repartidor/PushRegistrar.tsx.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    return;
  }

  event.waitUntil((async () => {
    // Broadcast to open PWA tabs — foreground UI shows inline sheet instead of OS toast.
    const clientsList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const hasFocused = clientsList.some((c) => c.focused);
    for (const client of clientsList) {
      client.postMessage({ type: 'new-offer', payload });
    }

    // If a tab is already focused, skip OS notification (foreground handler owns it).
    if (hasFocused) return;

    const km =
      payload.distanceKm != null
        ? payload.distanceKm.toFixed(1) + ' km · '
        : '';
    const fee = '$' + Number(payload.deliveryFee || 0).toLocaleString('es-AR');

    await self.registration.showNotification(
      '🛵 ¡Nuevo pedido! — ' + payload.restauranteName,
      {
        body: km + fee + '  ·  ¡Tocá para aceptar!',
        tag: payload.offerId,
        renotify: true,
        requireInteraction: true,
        // Long, high-attention vibrate — 3 sharp pulses over ~3.5s.
        // Drivers routinely miss quick single buzzes when the phone is in a
        // pocket. FCM `urgency: 'high'` from lib/push.ts pairs with this to
        // trigger heads-up display + default sound on Android.
        vibrate: [500, 200, 500, 200, 500, 200, 500],
        silent: false,
        icon: '/icon-512.png',
        badge: '/icon-192.svg',
        data: payload,
        actions: [
          { action: 'accept', title: '✅ Aceptar' },
          { action: 'reject', title: '❌ Rechazar' },
        ],
      }
    );
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const offerId = data.offerId;
  const orderId = data.orderId;
  const action = event.action;

  event.waitUntil((async () => {
    if (action === 'accept' || action === 'reject') {
      try {
        const res = await fetch(
          '/api/network/driver/offers/' + offerId + '/' + action,
          {
            method: 'POST',
            credentials: 'include',
          }
        );
        if (action === 'accept' && res.ok && orderId) {
          await self.clients.openWindow('/repartidor/pedido/' + orderId);
        }
      } catch (err) {
        // Silent — offer will fall through to poll fallback.
      }
      return;
    }

    // Body tap → focus existing /repartidor tab or open a new one.
    const list = await self.clients.matchAll({ type: 'window' });
    const existing = list.find((c) => c.url.includes('/repartidor'));
    if (existing) {
      await existing.focus();
      return;
    }
    await self.clients.openWindow('/repartidor');
  })());
});
