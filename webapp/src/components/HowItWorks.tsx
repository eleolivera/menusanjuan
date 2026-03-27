"use client";

import { useState, useEffect } from "react";

const customerSteps = [
  {
    number: "1",
    emoji: "🔍",
    title: "Elegí un restaurante",
    description: "Buscá por tipo de comida, zona o nombre. Todos los restaurantes de San Juan en un solo lugar.",
  },
  {
    number: "2",
    emoji: "📋",
    title: "Armá tu pedido",
    description: "Mirá el menú completo con precios, elegí lo que querés y ajustá cantidades.",
  },
  {
    number: "3",
    emoji: "📱",
    title: "Pedí por WhatsApp",
    description: "Tu pedido va directo al restaurante por WhatsApp. Sin descargar nada, sin comisiones.",
  },
  {
    number: "4",
    emoji: "🛵",
    title: "Recibí tu comida",
    description: "El restaurante prepara tu pedido y te lo lleva. Seguí el estado desde el chat.",
  },
];

const restaurantSteps = [
  {
    number: "1",
    emoji: "🍽️",
    title: "Tu menú digital gratis",
    description: "Cargá tu menú con categorías, precios, imágenes y descripciones. Tu página lista en minutos.",
  },
  {
    number: "2",
    emoji: "📲",
    title: "Pedidos por WhatsApp",
    description: "Tus clientes arman el pedido online y lo mandan directo a tu WhatsApp. Sin apps, sin comisiones.",
  },
  {
    number: "3",
    emoji: "📊",
    title: "Panel de gestión",
    description: "Controlá pedidos con tablero Kanban, ajustá disponibilidad, precios y horarios en tiempo real.",
  },
  {
    number: "4",
    emoji: "🚀",
    title: "Crecé tu negocio",
    description: "Analíticas de pedidos, QR para imprimir, link para compartir. Todo lo que necesitás para vender más.",
  },
];

export function HowItWorks() {
  const [mode, setMode] = useState<"customer" | "restaurant">("customer");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Default to restaurant view if logged in
  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated && data.restaurants?.length > 0) {
          setMode("restaurant");
          setIsLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  const steps = mode === "customer" ? customerSteps : restaurantSteps;

  return (
    <section id="como-funciona" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
            Cómo Funciona
          </h2>
          <p className="mt-3 text-text-secondary">
            {mode === "customer"
              ? "De tu antojo a tu mesa en 4 pasos"
              : "Todo lo que necesitás para gestionar tu restaurante"}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-xl border border-border/60 bg-surface p-1 shadow-sm">
            <button
              onClick={() => setMode("customer")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                mode === "customer"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Quiero Pedir
            </button>
            <button
              onClick={() => setMode("restaurant")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                mode === "restaurant"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Soy Restaurante
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={`${mode}-${step.number}`}
              className="relative rounded-2xl border border-border/50 bg-surface p-6 text-center shadow-sm animate-fade-in"
              style={{
                animationDelay: `${i * 0.05}s`,
                animationFillMode: "backwards",
              }}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/5 to-orange-50 text-2xl">
                {step.emoji}
              </div>
              <div className="mb-2 text-xs font-bold text-primary uppercase tracking-wider">
                Paso {step.number}
              </div>
              <h3 className="text-base font-bold text-text mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Restaurant owner CTA */}
        {(
          <div className="mt-14 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-orange-50 p-8 text-center">
            <div className="text-3xl mb-3">🍽️</div>
            <h3 className="text-xl font-extrabold text-text tracking-tight mb-2">
              ¿Tenés un restaurante?
            </h3>
            <p className="text-sm text-text-secondary mb-5 max-w-md mx-auto">
              Tu menú online, pedidos por WhatsApp, gestión de cocina y analíticas. Todo gratis, sin comisiones.
            </p>
            <a
              href="/para-restaurantes"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              Conocé más
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
