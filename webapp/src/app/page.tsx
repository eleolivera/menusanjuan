import Link from "next/link";
import Image from "next/image";
import { Smartphone, MessageCircle, UtensilsCrossed, ArrowRight, MapPin, Sparkles, Users, MessageSquare, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";

// Marketing landing page at the apex / route. Replaces the previous bot entry
// (the bot moved to /bot, hidden + noindex). Goal: explain what MenuSanJuan is
// to two audiences — customers + resta owners — and route them to /explorar or
// /para-restaurantes respectively. Friendly Argentine voice, mobile-first.

export const revalidate = 3600; // active resta list reflects new sign-ups within the hour

export default async function HomePage() {
  // Pull active restas live so the social-proof strip always shows real ones.
  const restas = await prisma.dealer.findMany({
    where: { isActive: true },
    select: { slug: true, name: true, logoUrl: true, cuisineType: true, rating: true },
    orderBy: { rating: "desc" },
    take: 8,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MenuSanJuan",
    url: "https://menusanjuan.com",
    description: "El menú de tu resta favorito en San Juan. Pedís por WhatsApp, sin app que bajar.",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
        {/* Top nav — brand on left, sign-in on right. Kept minimal so it
            doesn't compete with the hero's primary CTAs. */}
        <header className="relative z-20">
          <div className="max-w-5xl mx-auto px-5 pt-5 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white font-extrabold shadow-sm">M</span>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">MenuSanJuan</span>
            </Link>
            <Link
              href="/restaurante/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 backdrop-blur px-4 py-2 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 transition-colors"
            >
              Iniciar sesión
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-300/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute top-40 -left-32 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />

          <div className="relative max-w-5xl mx-auto px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
              San Juan, Argentina
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.05]">
              El menú de tu resta favorito en{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                San Juan
              </span>
              , ordenadito.
            </h1>

            <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
              Pedís todo por WhatsApp sin caos. Sin app que bajar. Sin hacer cola en la pizza del barrio.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/explorar"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Ver restaurantes
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="/para-restaurantes"
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                Soy resta, lo quiero usar
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              {restas.length} restaurantes activos · sumando más cada semana
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — 3 steps */}
        <section id="como-funciona" className="py-16 sm:py-20 bg-white border-y border-slate-100">
          <div className="max-w-5xl mx-auto px-5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center">
              Cómo funciona
            </h2>
            <p className="mt-2 text-center text-slate-500">Tres pasos. Treinta segundos.</p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Step
                num={1}
                Icon={UtensilsCrossed}
                title="Elegís tu resta"
                desc="Entrás al link del local, ves el menú con fotos y precios, sin descargar nada."
              />
              <Step
                num={2}
                Icon={Smartphone}
                title="Armás tu pedido"
                desc="Tocás lo que querés, sumás opciones, ponés tu dirección. Te calcula el envío solito."
              />
              <Step
                num={3}
                Icon={MessageCircle}
                title="Llega por WhatsApp"
                desc="El resta recibe tu pedido ordenadito, con todo el detalle y el total. Se pierde cero."
              />
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        {restas.length > 0 && (
          <section id="restaurantes" className="py-16 sm:py-20">
            <div className="max-w-5xl mx-auto px-5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center">
                Algunos lugares que ya lo usan
              </h2>
              <p className="mt-2 text-center text-slate-500">
                Tocá un local para ver el menú y pedir
              </p>

              <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {restas.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/${r.slug}`}
                    className="group rounded-2xl bg-white border border-slate-200 p-4 hover:border-orange-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    {r.logoUrl ? (
                      <div className="relative h-16 w-16 mx-auto rounded-2xl overflow-hidden bg-slate-100">
                        <Image
                          src={r.logoUrl}
                          alt={r.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-200 to-amber-200 flex items-center justify-center text-2xl">
                        🍴
                      </div>
                    )}
                    <div className="mt-3 text-center text-sm font-bold text-slate-900 leading-tight line-clamp-2">
                      {r.name}
                    </div>
                    <div className="mt-1 text-center text-[11px] text-slate-500 truncate">
                      {r.cuisineType}
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link
                  href="/explorar"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Ver todos
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* REFERRAL PROGRAM — aimed at teammates / vendedores, NOT resta owners.
            Kept off /para-restaurantes on purpose so a resta signing up there
            isn't tempted to also self-refer for the reward. Anti-self-referral
            copy at the bottom nudges owners to the right page. */}
        <section id="referir" className="py-16 sm:py-20 bg-gradient-to-b from-white to-amber-50/50 border-y border-slate-100">
          <div className="max-w-5xl mx-auto px-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
                <Users className="h-3.5 w-3.5" strokeWidth={2.5} />
                Ayudanos a crecer
              </div>
              <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                Referí un local, cobrás{" "}
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  $25.000
                </span>
              </h2>
              <p className="mt-3 max-w-2xl mx-auto text-base text-slate-600 leading-relaxed">
                Conocés un resta en San Juan que podría estar acá? Pasanos sus
                datos. Si se suma y recibe su primer pedido, te pagamos <strong className="text-slate-900">$25.000</strong> por Mercado Pago.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Step
                num={1}
                Icon={MessageSquare}
                title="Nos pasás los datos"
                desc="Nombre, contacto, unas fotos del menú. Te toma 3 minutos."
              />
              <Step
                num={2}
                Icon={Sparkles}
                title="Nosotros hablamos con el resta"
                desc="Armamos un kit de venta personalizado y se lo mostramos al dueño."
              />
              <Step
                num={3}
                Icon={Wallet}
                title="Cobrás $25.000"
                desc="Cuando el resta se sume y reciba su primer pedido, te transferimos por MP."
              />
            </div>

            {/* Payout callout — gradient border card */}
            <div className="mt-10 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-[2px] shadow-lg shadow-orange-500/20 max-w-xl mx-auto">
              <div className="rounded-2xl bg-white px-6 py-6 sm:px-8 sm:py-7 text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  $25.000 <span className="text-lg font-bold text-slate-500">ARS</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  por cada resta que traigas · sin límite de referidos
                </div>
              </div>
            </div>

            {/* CTA + anti-self-referral framing */}
            <div className="mt-8 text-center">
              <Link
                href="/referidos/nuevo"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Cargar un referido
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <p className="mt-4 max-w-xl mx-auto text-xs text-slate-500 leading-relaxed">
                Este programa es para amigos y vendedores que quieran ayudarnos
                a crecer. Si sos dueño de un local,{" "}
                <Link href="/para-restaurantes" className="text-orange-600 font-semibold hover:text-orange-700 underline underline-offset-2">
                  entrá acá
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* FOR RESTAURANTS — mini section */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="max-w-4xl mx-auto px-5">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Para restaurantes
                </div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold leading-tight">
                  ¿Tenés un local en San Juan?
                </h2>
                <p className="mt-3 text-slate-300 leading-relaxed">
                  Subí tu menú una vez, compartí el link y empezá a recibir los pedidos
                  ordenaditos por WhatsApp. Gratis. Sin comisiones. Sin contratos.
                </p>
                <Link
                  href="/para-restaurantes"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-amber-50 transition-colors"
                >
                  Conocé cómo
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>

              <div className="space-y-3">
                <BulletPoint text="Recibí pedidos en tu WhatsApp existente" />
                <BulletPoint text="Manejá la cocina con un tablero visual" />
                <BulletPoint text="Imprimí tickets con QR para envío" />
                <BulletPoint text="Cambios al menú en vivo, sin esperar a nadie" />
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-10 bg-slate-50 border-t border-slate-100">
          <div className="max-w-5xl mx-auto px-5 text-center text-xs text-slate-500 space-y-2">
            <div className="font-bold text-slate-700">MenuSanJuan</div>
            <div>San Juan, Argentina · Hecho con cariño 🧡</div>
            <div className="flex justify-center gap-4 pt-2">
              <Link href="/explorar" className="hover:text-orange-600 transition-colors">
                Restaurantes
              </Link>
              <Link href="/para-restaurantes" className="hover:text-orange-600 transition-colors">
                Para restas
              </Link>
              <Link href="/referidos/nuevo" className="hover:text-orange-600 transition-colors">
                Referir un local
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

function Step({
  num,
  Icon,
  title,
  desc,
}: {
  num: number;
  Icon: typeof Smartphone;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-slate-100 p-6 hover:border-orange-200 hover:shadow-md transition-all">
      <div className="absolute -top-3 -left-3 h-9 w-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
        {num}
      </div>
      <Icon className="h-7 w-7 text-orange-500" strokeWidth={2} />
      <h3 className="mt-3 text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function BulletPoint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-200">
      <span className="text-amber-300 mt-0.5">✓</span>
      <span>{text}</span>
    </div>
  );
}
