"use client";

import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
            M
          </div>
          <span className="text-xl font-extrabold tracking-tight text-text">
            Menu<span className="gradient-text">SJ</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Inicio
          </Link>
          <Link
            href="/#restaurantes"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Restaurantes
          </Link>
          <Link
            href="/#como-funciona"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
          >
            Cómo Funciona
          </Link>
          <Link
            href="/restaurante/login"
            className="ml-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            Soy Restaurante
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-lg p-2 text-text-secondary hover:bg-primary/5 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 glass animate-slide-in-right">
          <nav className="flex flex-col gap-1 px-4 py-3">
            <Link
              href="/"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Inicio
            </Link>
            <Link
              href="/#restaurantes"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Restaurantes
            </Link>
            <Link
              href="/#como-funciona"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Cómo Funciona
            </Link>
            <Link
              href="/restaurante/login"
              className="mt-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Soy Restaurante
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
