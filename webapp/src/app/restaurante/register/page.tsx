"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const CUISINE_OPTIONS = [
  "Comida Rápida", "Parrilla", "Pizzería", "Cafetería", "Pastas",
  "Sushi", "Heladería", "Empanadas", "Comida Árabe", "Comida Mexicana",
  "Comida China", "Vegetariano", "Postres", "Rotisería", "General",
];

const STEPS = [
  { number: 1, label: "Tu Cuenta" },
  { number: 2, label: "Tu Restaurante" },
  { number: 3, label: "Tu Imagen" },
  { number: 4, label: "Listo" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Restaurant details
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 extra: coordinates from address autocomplete
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Step 3: Images
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // Step 4: Result
  const [slug, setSlug] = useState("");

  function validateStep1(): boolean {
    if (!email.includes("@")) { setError("Ingresá un email válido"); return false; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return false; }
    if (password !== confirmPassword) { setError("Las contraseñas no coinciden"); return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (!restaurantName.trim()) { setError("Ingresá el nombre de tu restaurante"); return false; }
    if (!phone.trim()) { setError("Ingresá tu número de WhatsApp"); return false; }
    if (!cuisineType) { setError("Seleccioná el tipo de cocina"); return false; }
    return true;
  }

  function handleNext() {
    setError("");
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      handleSubmit();
      return;
    }
    setStep(step + 1);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurante/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          restaurantName,
          phone,
          address,
          latitude,
          longitude,
          cuisineType,
          description,
          logoUrl: logoUrl || null,
          coverUrl: coverUrl || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar");
        setLoading(false);
        return;
      }

      setSlug(data.slug);
      setStep(4);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-xl shadow-md shadow-primary/25">
            M
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">
            Registrá tu Restaurante
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Empezá a recibir pedidos por WhatsApp en minutos
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step > s.number
                    ? "bg-success text-white"
                    : step === s.number
                      ? "bg-primary text-white shadow-md shadow-primary/25"
                      : "bg-surface-hover text-text-muted"
                }`}
              >
                {step > s.number ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
              <span className={`hidden sm:inline text-xs font-medium ${
                step >= s.number ? "text-text" : "text-text-muted"
              }`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.number ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm">
          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">📧</div>
                <h2 className="text-lg font-bold text-text">Creá tu cuenta</h2>
                <p className="text-xs text-text-muted">Con esto vas a iniciar sesión en tu panel</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@restaurante.com"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí la contraseña"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Step 2: Restaurant Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">🍽️</div>
                <h2 className="text-lg font-bold text-text">Datos de tu restaurante</h2>
                <p className="text-xs text-text-muted">Esto es lo que van a ver tus clientes</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Nombre del restaurante</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ej: Puerto Pachatas"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">WhatsApp del restaurante</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 2645551234"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <p className="mt-1 text-[11px] text-text-muted">Acá van a llegar los pedidos de tus clientes</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Tipo de cocina</label>
                <div className="grid grid-cols-3 gap-2">
                  {CUISINE_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCuisineType(c)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                        cuisineType === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-text-secondary hover:border-primary/40"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onCoordinates={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                label="Dirección del restaurante"
                placeholder="Escribí la dirección..."
                optional
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Descripción <span className="text-text-muted font-normal">(opcional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contales a tus clientes qué hacés mejor..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Images + Live Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">📸</div>
                <h2 className="text-lg font-bold text-text">Dale imagen a tu restaurante</h2>
                <p className="text-xs text-text-muted">Así van a ver tu restaurante los clientes</p>
              </div>

              {/* Live Preview Card */}
              <div className="rounded-2xl border border-border/60 bg-surface shadow-sm overflow-hidden">
                {/* Cover */}
                <div className="relative h-28 bg-gradient-to-br from-slate-900 via-orange-950 to-red-950">
                  {coverUrl && (
                    <img src={coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-end gap-3">
                    {/* Logo */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white text-lg font-bold shadow-lg border-2 border-white/20 overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        restaurantName?.charAt(0) || "R"
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{restaurantName || "Tu Restaurante"}</div>
                      <div className="flex items-center gap-2">
                        {cuisineType && (
                          <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">{cuisineType}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-text-secondary line-clamp-2">{description || "Descripción de tu restaurante..."}</p>
                  {address && <p className="text-[10px] text-text-muted mt-1">📍 {address}</p>}
                </div>
              </div>

              {/* Logo input */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  Logo <span className="text-text-muted font-normal">(URL de imagen)</span>
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://tu-logo.com/logo.png"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              {/* Cover input */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  Foto de portada <span className="text-text-muted font-normal">(URL de imagen)</span>
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://tu-restaurante.com/portada.jpg"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <p className="mt-1 text-[11px] text-text-muted">Una foto de tu local o tu mejor plato funciona perfecto</p>
              </div>

              <div className="rounded-xl bg-surface-alt border border-border/50 p-4">
                <h3 className="text-xs font-bold text-text mb-2">💡 ¿No tenés imágenes todavía?</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  No pasa nada, podés saltear este paso. Se va a usar la primera letra de tu restaurante como logo y un fondo por defecto. Podés cambiarlos después.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
                🎉
              </div>
              <h2 className="text-xl font-bold text-text mb-2">
                ¡Tu restaurante está listo!
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Ya podés empezar a recibir pedidos. Tu página es:
              </p>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-6">
                <span className="text-sm font-bold text-primary">
                  menusanjuan.com/{slug}
                </span>
              </div>

              <div className="rounded-xl bg-surface-alt border border-border/50 p-4 mb-6 text-left">
                <h3 className="text-sm font-bold text-text mb-3">Próximos pasos:</h3>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                    <span className="text-sm text-text-secondary">Agregá tu menú con categorías y precios</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                    <span className="text-sm text-text-secondary">Compartí tu link por WhatsApp y redes</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                    <span className="text-sm text-text-secondary">Gestioná pedidos desde tu panel de control</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/restaurante")}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  Ir a mi Panel
                </button>
                <Link
                  href={`/${slug}`}
                  className="flex-1 rounded-xl border border-border px-5 py-3 text-center text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  Ver mi Página
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-danger/20 bg-red-50 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Navigation Buttons (steps 1-3) */}
          {step < 4 && (
            <div className="mt-6 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => { setStep(step - 1); setError(""); }}
                  className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  Volver
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creando...
                  </span>
                ) : step === 3 ? (
                  "Crear mi Restaurante"
                ) : (
                  "Siguiente"
                )}
              </button>
            </div>
          )}

          {/* Login link */}
          {step < 4 && (
            <p className="mt-4 text-center text-xs text-text-muted">
              ¿Ya tenés cuenta?{" "}
              <Link href="/restaurante/login" className="font-medium text-primary hover:underline">
                Iniciá sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
