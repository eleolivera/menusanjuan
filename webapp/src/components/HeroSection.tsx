export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-orange-950 to-red-950 py-16 sm:py-20 lg:py-28">
      {/* Floating blobs */}
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl animate-float" />
      <div
        className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl animate-float"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative mx-auto max-w-7xl px-4 text-center">
        <h1
          className="animate-slide-up text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight"
        >
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent animate-gradient">
            Los mejores menús
          </span>
          <br />
          <span className="text-white">de San Juan</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          Todos los restaurantes, todos los menús, un solo lugar. Elegí lo que querés, pedí directo por WhatsApp. Sin apps, sin comisiones.
        </p>

        {/* Stats */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12 animate-slide-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          {[
            { number: "50+", label: "Restaurantes" },
            { number: "1.200+", label: "Platos" },
            { number: "100%", label: "Gratis" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {stat.number}
              </div>
              <div className="mt-1 text-sm text-slate-400 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div
          className="mt-12 animate-slide-up"
          style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
        >
          <a
            href="#restaurantes"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            Ver Restaurantes
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
