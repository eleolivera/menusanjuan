import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/50 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg shadow-md shadow-primary/25">
                M
              </div>
              <span className="text-xl font-extrabold tracking-tight text-text">
                Menu<span className="gradient-text">SJ</span>
              </span>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed">
              Todos los menús de San Juan en un solo lugar. Elegí, pedí por WhatsApp y listo.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-5">
              Explorar
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href="/#restaurantes" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Restaurantes
                </Link>
              </li>
              <li>
                <Link href="/#como-funciona" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Cómo Funciona
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-5">
              Para Restaurantes
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/para-restaurantes" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Cómo Funciona
                </Link>
              </li>
              <li>
                <Link href="/restaurante/register" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Registrar mi Restaurante
                </Link>
              </li>
              <li>
                <Link href="/restaurante/login" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Iniciar Sesión
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-5">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li className="text-sm text-text-secondary">
                San Juan, Argentina
              </li>
              <li>
                <a
                  href="https://wa.me/5492645710889"
                  className="text-sm text-text-secondary hover:text-primary transition-colors"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-border/50 pt-6 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} MenuSanJuan. Todos los derechos
            reservados.
          </p>
          <Link href="/admin?login" className="text-[10px] text-text-muted/30 hover:text-text-muted transition-colors py-2 px-2">
            admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
