import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Para Restaurantes — MenuSanJuan",
  description: "Recibí pedidos por WhatsApp, gestioná tu menú y controlá tus ventas. Gratis, sin comisiones.",
};

const features = [
  {
    emoji: "📱",
    title: "Pedidos por WhatsApp",
    desc: "Tus clientes eligen del menú y el pedido llega directo a tu WhatsApp. Sin apps, sin intermediarios, sin comisiones.",
  },
  {
    emoji: "📋",
    title: "Kanban de Pedidos",
    desc: "Gestioná los pedidos con un tablero visual: Generado → Pagado → En Cocina → Entregado. Arrastrá y soltá desde tu celular o tablet.",
  },
  {
    emoji: "🧾",
    title: "Tickets con QR",
    desc: "Cada pedido genera un ticket estilo recibo con QR de WhatsApp y Google Maps. Imprimilo y pegalo en el pedido.",
  },
  {
    emoji: "🍽️",
    title: "Menú Digital",
    desc: "Creá tu menú con categorías, precios, fotos y descripciones. Marcá items como no disponibles. Los cambios se ven al instante.",
  },
  {
    emoji: "📊",
    title: "Analíticas de Ventas",
    desc: "Ventas del día, semana y mes. Productos más vendidos, hora pico, ticket promedio. Imprimí el reporte del fin de semana el lunes.",
  },
  {
    emoji: "📍",
    title: "Ubicación Exacta",
    desc: "Tus clientes marcan su ubicación exacta en el mapa. El QR del ticket lleva directo a Google Maps con las coordenadas.",
  },
  {
    emoji: "🕐",
    title: "Horarios de Atención",
    desc: "Configurá tus horarios día por día. El sistema sabe que los pedidos de madrugada son del día anterior.",
  },
  {
    emoji: "💰",
    title: "100% Gratis",
    desc: "Sin costos, sin comisiones por pedido, sin suscripción. Tu menú en internet y un sistema de pedidos profesional, totalmente gratis.",
  },
];

const steps = [
  { number: "1", title: "Registrate", desc: "Creá tu cuenta en 2 minutos con tu email y datos del restaurante." },
  { number: "2", title: "Armá tu menú", desc: "Agregá categorías y productos con precios y fotos." },
  { number: "3", title: "Compartí tu link", desc: "Tu página queda en menusanjuan.com/tu-restaurante. Compartilo en redes y con tus clientes." },
  { number: "4", title: "Recibí pedidos", desc: "Los pedidos llegan por WhatsApp. Gestionalos desde tu panel en el celular o tablet." },
];

export default function ParaRestaurantes() {
  return (
    <div className="mesh-gradient">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-orange-950 to-red-950 py-20 sm:py-28">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl animate-float" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl animate-float" style={{ animationDelay: "3s" }} />

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-amber-300 backdrop-blur-sm mb-6">
            100% Gratis — Sin comisiones
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent animate-gradient">
              Tu restaurante
            </span>
            <br />
            <span className="text-white">en internet en minutos</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed">
            Menú digital, pedidos por WhatsApp, gestión de cocina y analíticas de ventas. Todo lo que necesitás para recibir pedidos online, sin pagar comisiones.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/restaurante/register"
              className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Registrar mi Restaurante
            </Link>
            <a href="#como-funciona"
              className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-medium text-white hover:bg-white/5 transition-all">
              Cómo Funciona
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">
              Todo lo que necesitás
            </h2>
            <p className="mt-3 text-text-secondary max-w-lg mx-auto">
              Un sistema completo para tu restaurante, sin tener que instalar nada. Funciona desde el celular.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "backwards" }}>
                <div className="text-3xl mb-3">{f.emoji}</div>
                <h3 className="text-base font-bold text-text mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 bg-surface-alt">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">Cómo Funciona</h2>
            <p className="mt-3 text-text-secondary">En 4 pasos empezás a recibir pedidos</p>
          </div>

          <div className="space-y-8">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-5 items-start animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "backwards" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-xl font-bold shadow-md">
                  {s.number}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">{s.title}</h3>
                  <p className="mt-1 text-text-secondary">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visual showcase — real screenshots */}
      <section className="py-20 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">Mirá cómo se ve</h2>
            <p className="mt-3 text-text-secondary">Así ven tus clientes tu restaurante — y así gestionás tus pedidos</p>
          </div>

          {/* Phone + Tablet side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Customer view — phone */}
            <div className="text-center">
              <div className="inline-block relative">
                <div className="rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden w-[280px] mx-auto">
                  <img src="/showcase/restaurant.png" alt="Vista del cliente" className="w-full" />
                </div>
              </div>
              <h3 className="font-bold text-text mt-6 mb-1">Tus clientes</h3>
              <p className="text-sm text-text-secondary">Ven tu menú con fotos, eligen y piden por WhatsApp</p>
            </div>

            {/* Owner view — tablet */}
            <div className="text-center">
              <div className="inline-block relative">
                <div className="rounded-2xl border-[4px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden w-full max-w-[500px] mx-auto">
                  <img src="/showcase/pedidos.png" alt="Panel del dueño" className="w-full" />
                </div>
              </div>
              <h3 className="font-bold text-text mt-6 mb-1">Tu panel</h3>
              <p className="text-sm text-text-secondary">Gestioná pedidos con un Kanban visual desde tu celular o tablet</p>
            </div>
          </div>

          {/* More screenshots strip */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { src: "/showcase/menu.png", label: "Menú con fotos" },
              { src: "/showcase/menu-editor.png", label: "Editor de menú" },
              { src: "/showcase/profile.png", label: "Configuración" },
              { src: "/showcase/home.png", label: "Tu marca visible" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-surface overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <img src={s.src} alt={s.label} className="w-full aspect-[3/4] object-cover object-top" />
                <div className="px-3 py-2">
                  <span className="text-xs font-medium text-text-secondary">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PASO A PASO — full customer→owner→driver→analytics walkthrough. Uses
          a seeded 'demo-burger-bar' resta with fake data (no real customer
          names or phones) so screenshots reflect the actual UI without
          leaking anyone. Placeholders render until Elio drops the real
          screenshots into /public/showcase/demo/ and flips the `ready` flag. */}
      <section className="py-20 bg-gradient-to-b from-white to-amber-50/40 border-y border-border/50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
              📸 Recorrido guiado
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
              De la orden al reparto, paso a paso
            </h2>
            <p className="mt-3 text-text-secondary max-w-2xl mx-auto">
              Así funciona en la vida real. Cada pantalla es del sistema tal cual la vas a usar.
            </p>
          </div>

          <div className="space-y-16 sm:space-y-20">
            {DEMO_STEPS.map((step, i) => (
              <DemoStep key={step.num} step={step} reverse={i % 2 === 1} />
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/demo-burger-bar"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Probá el demo en vivo →
            </Link>
            <p className="mt-3 text-xs text-text-muted">
              Es un local ficticio con menú y pedidos de ejemplo, para que juegues sin miedo.
            </p>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-14 bg-surface-alt">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold gradient-text">90+</div>
              <div className="text-sm text-text-secondary mt-1">Restaurantes</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold gradient-text">250+</div>
              <div className="text-sm text-text-secondary mt-1">Pedidos realizados</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold gradient-text">$0</div>
              <div className="text-sm text-text-secondary mt-1">Comisiones</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-surface-alt">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">
              ¿Por qué MenuSanJuan?
            </h2>
          </div>

          <div className="rounded-2xl border border-border/50 bg-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-surface-alt">
                  <th className="px-5 py-3 text-left text-xs font-bold text-text-muted uppercase tracking-wider"></th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-primary uppercase tracking-wider">MenuSanJuan</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-text-muted uppercase tracking-wider">Apps de delivery</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["Costo", "Gratis", "20-30% comisión"],
                  ["Pedidos", "Directo a tu WhatsApp", "A través de la app"],
                  ["Tu menú", "Lo controlás vos", "Lo controla la app"],
                  ["Datos del cliente", "Tuyos (nombre, tel, dirección)", "No los ves"],
                  ["Pagos", "Directo a vos", "La app cobra y te paga después"],
                  ["Gestión de cocina", "Kanban + tickets QR", "No incluido"],
                  ["Analíticas", "Incluidas", "Básicas o pagas"],
                ].map(([label, us, them], i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-3 font-medium text-text">{label}</td>
                    <td className="px-5 py-3 text-center text-primary font-semibold">{us}</td>
                    <td className="px-5 py-3 text-center text-text-muted">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <h2 className="text-3xl font-extrabold text-text tracking-tight mb-4">
            Empezá hoy, es gratis
          </h2>
          <p className="text-text-secondary mb-8">
            Tu restaurante en internet en minutos. Sin comisiones, sin contratos, sin letra chica.
          </p>
          <Link href="/restaurante/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            Registrar mi Restaurante
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── DEMO WALKTHROUGH SECTION ────────────────────────────────────────────
// 8 steps rendered in alternating left/right rows. `ready: false` shows a
// placeholder card; flip to true once the corresponding file lands in
// /public/showcase/demo/. Filename convention: step-<n>-<label>.png (or .jpg
// for the ticket photo). See docs when the recipe ships.

type DemoStepData = {
  num: number;
  kicker: string;
  title: string;
  desc: string;
  imageSrc: string;
  frame: "phone" | "tablet" | "ticket";
  ready: boolean;
  highlight?: boolean;
};

const DEMO_STEPS: DemoStepData[] = [
  {
    num: 1,
    kicker: "El cliente",
    title: "Elige tu resta y arma el pedido",
    desc: "Entra al link de tu local desde WhatsApp, Instagram o Google. Ve el menú con fotos, precios y descripciones. No baja ninguna app.",
    imageSrc: "/showcase/demo/step-1-menu.png",
    frame: "phone",
    ready: false,
  },
  {
    num: 2,
    kicker: "El cliente",
    title: "Confirma dirección y modo de envío",
    desc: "Elige delivery o retiro en el local. Si es delivery, marca la dirección en el mapa y ve el costo del envío al instante — lo calcula por zona.",
    imageSrc: "/showcase/demo/step-2-checkout.png",
    frame: "phone",
    ready: false,
  },
  {
    num: 3,
    kicker: "En tu Kanban",
    title: "El pedido cae en 'Pendiente'",
    desc: "En segundos aparece una tarjeta en tu tablero: número de pedido, cliente, ítems, total, dirección. Todo ordenado, listo para confirmar.",
    imageSrc: "/showcase/demo/step-3-kanban.png",
    frame: "tablet",
    ready: false,
  },
  {
    num: 4,
    kicker: "En tu Kanban",
    title: "Lo pasás a 'En Cocina'",
    desc: "Un tap y el pedido pasa a preparación. La cocina lo ve en el mismo tablero. Cambios al menú (agotados, precios) se ven al instante.",
    imageSrc: "/showcase/demo/step-4-cocina.png",
    frame: "tablet",
    ready: false,
  },
  {
    num: 5,
    kicker: "En la impresora",
    title: "Sale el ticket con QR",
    desc: "Imprimís el ticket estilo comanda con el resumen del pedido y un QR único. Se lo pegás al pedido para tu repartidor.",
    imageSrc: "/showcase/demo/step-5-ticket.jpg",
    frame: "ticket",
    ready: false,
  },
  {
    num: 6,
    kicker: "En el celu del repartidor",
    title: "Escanea el QR y ve TODO",
    desc: "El repartidor escanea el QR con la cámara. Se abre una página con nombre del cliente, teléfono (tap para llamar), dirección con link directo a Google Maps con coordenadas, ítems del pedido y estado del pago. No tiene que llamarte para preguntar 'dónde va?'.",
    imageSrc: "/showcase/demo/step-6-driver.png",
    frame: "phone",
    ready: false,
    highlight: true,
  },
  {
    num: 7,
    kicker: "En tu panel",
    title: "Dashboard del día",
    desc: "Cuántos pedidos hoy, cuánto facturaste, qué ítems se vendieron más. Métricas en vivo, sin Excel ni cuentas manuales.",
    imageSrc: "/showcase/demo/step-7-dashboard.png",
    frame: "tablet",
    ready: false,
  },
  {
    num: 8,
    kicker: "En tu panel",
    title: "Tus clientes VIP",
    desc: "Ves quiénes son tus mejores clientes, cuánto gastaron, cuándo pidieron por última vez. Podés mimarlos con descuentos o mensajes personalizados.",
    imageSrc: "/showcase/demo/step-8-vip.png",
    frame: "tablet",
    ready: false,
  },
];

function DemoStep({ step, reverse }: { step: DemoStepData; reverse: boolean }) {
  const imageCol = (
    <div className="w-full flex justify-center">
      <StepImage src={step.imageSrc} num={step.num} frame={step.frame} ready={step.ready} />
    </div>
  );
  const textCol = (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-orange-600">
        {step.kicker}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-4xl sm:text-5xl font-extrabold text-slate-300 leading-none">
          {String(step.num).padStart(2, "0")}
        </span>
        <h3 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${step.highlight ? "text-orange-600" : "text-text"}`}>
          {step.title}
        </h3>
      </div>
      <p className="mt-3 text-text-secondary leading-relaxed">{step.desc}</p>
      {step.highlight && (
        <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-800">
          🎯 <strong>Este es el ahorro grande.</strong> Tu repartidor no te llama para preguntar dirección ni teléfono. Todo está en la pantalla.
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
      {reverse ? (
        <>
          {textCol}
          {imageCol}
        </>
      ) : (
        <>
          {imageCol}
          {textCol}
        </>
      )}
    </div>
  );
}

function StepImage({ src, num, frame, ready }: { src: string; num: number; frame: DemoStepData["frame"]; ready: boolean }) {
  const wrapperClass =
    frame === "phone"
      ? "max-w-[280px] w-full rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
      : frame === "tablet"
        ? "max-w-[560px] w-full rounded-2xl border-[4px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
        : "max-w-[240px] w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden";

  const placeholderAspect =
    frame === "phone" ? "aspect-[9/19]" : frame === "tablet" ? "aspect-[4/3]" : "aspect-[1/2.4]";

  if (!ready) {
    return (
      <div className={wrapperClass}>
        <div className={`w-full ${placeholderAspect} bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-500`}>
          <div className="text-3xl mb-2">📸</div>
          <div className="text-xs font-semibold">Screenshot pendiente</div>
          <div className="text-[10px] text-slate-400 mt-1">Paso {num}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <img src={src} alt={`Paso ${num}`} className="w-full" />
    </div>
  );
}
