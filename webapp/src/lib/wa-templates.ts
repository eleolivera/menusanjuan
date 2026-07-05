// Owner-driven WhatsApp message templates.
//
// Every message is composed client-side and opened via `wa.me/<phone>?text=…`,
// which hands off to WhatsApp Desktop on the owner's machine. Nothing here
// sends anything server-side — templates just assemble a string for the
// owner to review before hitting Send.

export type TemplateVars = {
  name?: string | null;
  restaurantName?: string;
  punches?: number;
  needed?: number;
  reward?: string;
  daysSinceLastOrder?: number | null;
  link?: string;
};

export type Template = {
  id: string;
  label: string;
  hint: string;
  requires?: Array<keyof TemplateVars>;
  render: (v: TemplateVars) => string;
};

const firstName = (v: TemplateVars): string => {
  if (!v.name) return "";
  return v.name.split(/\s+/)[0] || "";
};

export const TEMPLATES: Template[] = [
  {
    id: "near-reward",
    label: "Casi hay premio",
    hint: "Recordá al cliente cuántos pedidos le faltan.",
    requires: ["punches", "needed", "reward"],
    render: (v) => {
      const fn = firstName(v);
      const hola = fn ? `Hola ${fn}!` : "¡Hola!";
      const rest = v.restaurantName ? ` de ${v.restaurantName}` : "";
      const punches = v.punches ?? 0;
      const needed = v.needed ?? 10;
      const missing = Math.max(0, needed - punches);
      const reward = v.reward || "tu premio";
      if (missing === 0) {
        return `${hola} 🎉 Ya tenés todos los puntos${rest}. Cuando quieras te canjeamos ${reward} sin cargo. ¡Te esperamos!`;
      }
      const suffix = missing === 1 ? "pedido" : "pedidos";
      return `${hola} 🍟 Te faltan solo ${missing} ${suffix} para llevarte ${reward} de regalo${rest}. Vas ${punches}/${needed}. ¿Nos hacemos un pedidito?`;
    },
  },
  {
    id: "come-back",
    label: "Volvé pronto",
    hint: "Cliente inactivo — invitálo a volver.",
    render: (v) => {
      const fn = firstName(v);
      const hola = fn ? `Hola ${fn}!` : "¡Hola!";
      const rest = v.restaurantName ? ` de ${v.restaurantName}` : "";
      const d = v.daysSinceLastOrder;
      const gap = d != null && d > 0 ? ` Hace ${d} días que no pasás.` : "";
      return `${hola}${rest}${gap} Te extrañamos 🙌 ¿Te tiro el link del menú por si te tentás?`;
    },
  },
  {
    id: "daily-promo",
    label: "Promo del día",
    hint: "Contale una promo o novedad.",
    render: (v) => {
      const fn = firstName(v);
      const hola = fn ? `Hola ${fn}!` : "¡Hola!";
      const rest = v.restaurantName ? ` de ${v.restaurantName}` : "";
      const link = v.link ? `\n\n${v.link}` : "";
      return `${hola} 🔥 Hoy tenemos una promo especial${rest}. Escribí acá o pasá por el menú y armamos el pedido.${link}`;
    },
  },
  {
    id: "thanks",
    label: "Gracias por tu pedido",
    hint: "Agradecimiento post-entrega.",
    render: (v) => {
      const fn = firstName(v);
      const hola = fn ? `Hola ${fn}!` : "¡Hola!";
      const rest = v.restaurantName ? ` ${v.restaurantName}` : "";
      return `${hola} 🙌 Gracias por tu pedido${rest ? ` en${rest}` : ""}. Cualquier feedback nos lo tirás por acá. ¡Volvé cuando quieras!`;
    },
  },
  {
    id: "blank",
    label: "Escribir libre",
    hint: "Empezá desde cero.",
    render: (v) => {
      const fn = firstName(v);
      return fn ? `Hola ${fn}! ` : "";
    },
  },
];

const WA_MAX = 1900; // wa.me tolerates ≥2000 URL-encoded chars in practice; cap raw text just below.

/** Build a wa.me deep link. Strips leading '+' from E.164 as wa.me wants it that way. */
export function waHref(phoneE164: string, message: string): string {
  const cleaned = phoneE164.replace(/^\+/, "").replace(/\D/g, "");
  const truncated = message.length > WA_MAX ? message.slice(0, WA_MAX) : message;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(truncated)}`;
}

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
