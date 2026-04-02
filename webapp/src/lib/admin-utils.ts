// ─── Shared admin utilities ───

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export function buildOnboardingWhatsAppMsg(dealer: { name: string; slug: string; ownerEmail: string }, code?: string | null): string {
  const email = dealer.ownerEmail;
  const codeStr = code || "(sin generar)";
  return `Hola! Soy de MenuSanJuan.com

Te creamos una pagina gratuita para *${dealer.name}* donde tus clientes pueden ver el menu completo con precios y hacer pedidos directo por WhatsApp. Sin intermediarios, sin comisiones — a diferencia de otras apps que se quedan con un porcentaje de cada venta, con nosotros todo lo que vendes es tuyo.

Ya esta armada con tu menu cargado:
${dealer.name}: menusanjuan.com/${dealer.slug}

Para entrar a tu panel y gestionar todo:
menusanjuan.com/restaurante/login
Email: ${email}
Codigo de acceso: ${codeStr}

La primera vez que entres te va a pedir que elijas tu propia contraseña.

Si tenes la carta actualizada con los precios de hoy, mandamela asi la actualizamos rapido.

Cualquier duda te ayudamos por aca, por llamada, o podemos pasar por el local. Estamos para hacerte las cosas faciles!`;
}
