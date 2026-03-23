const steps = [
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

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
            Cómo Funciona
          </h2>
          <p className="mt-3 text-text-secondary">
            De tu antojo a tu mesa en 4 pasos
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
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
      </div>
    </section>
  );
}
