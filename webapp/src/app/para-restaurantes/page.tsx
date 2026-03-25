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

      {/* Tablet/Phone showcase */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">Funciona en todo</h2>
            <p className="mt-3 text-text-secondary">Celular, tablet o computadora — el mismo sistema, en cualquier pantalla</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/50 bg-surface p-6 text-center">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="font-bold text-text mb-1">Celular</h3>
              <p className="text-sm text-text-secondary">Gestioná pedidos mientras estás en la cocina. Todo el control desde tu bolsillo.</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center shadow-md">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-bold text-text mb-1">Tablet</h3>
              <p className="text-sm text-text-secondary">Ideal para la caja. Kanban completo, tickets imprimibles, todo de un vistazo.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-surface p-6 text-center">
              <div className="text-4xl mb-3">💻</div>
              <h3 className="font-bold text-text mb-1">Computadora</h3>
              <p className="text-sm text-text-secondary">Analíticas detalladas, gestión del menú, reportes de ventas semanales.</p>
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
