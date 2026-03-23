"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const CUISINE_OPTIONS = [
  "Comida Rápida", "Parrilla", "Pizzería", "Cafetería", "Pastas",
  "Sushi", "Heladería", "Empanadas", "Comida Árabe", "Comida Mexicana",
  "Comida China", "Vegetariano", "Postres", "Rotisería", "General",
];

type UnclaimedRestaurant = {
  id: string;
  name: string;
  slug: string;
  cuisineType: string;
  address: string | null;
  coverUrl: string | null;
  description: string | null;
  itemCount: number;
  categoryCount: number;
};

export default function RegisterPage() {
  const router = useRouter();
  // step: 1=account, 1.5=choose(claim or new), 2=restaurant details, 3=images, 4=done
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"new" | "claim" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Unclaimed restaurants
  const [unclaimed, setUnclaimed] = useState<UnclaimedRestaurant[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<UnclaimedRestaurant | null>(null);
  const [claimSearch, setClaimSearch] = useState("");

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Restaurant details (new only)
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Step 3: Images (new only)
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // Result
  const [slug, setSlug] = useState("");
  const [resultName, setResultName] = useState("");

  // Fetch unclaimed restaurants
  useEffect(() => {
    fetch("/api/restaurante/unclaimed")
      .then((r) => r.json())
      .then((data) => setUnclaimed(data))
      .catch(() => {});
  }, []);

  const filteredUnclaimed = unclaimed.filter((r) =>
    claimSearch === "" ||
    r.name.toLowerCase().includes(claimSearch.toLowerCase()) ||
    r.cuisineType.toLowerCase().includes(claimSearch.toLowerCase()) ||
    (r.address || "").toLowerCase().includes(claimSearch.toLowerCase())
  );

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
    if (step === 1) {
      if (!validateStep1()) return;
      // If there are unclaimed restaurants, show the choice
      if (unclaimed.length > 0) {
        setStep(1.5);
      } else {
        setMode("new");
        setStep(2);
      }
      return;
    }
    if (step === 2 && !validateStep2()) return;
    if (step === 3) { handleSubmitNew(); return; }
    setStep(step + 1);
  }

  async function handleClaim() {
    if (!selectedClaim) { setError("Seleccioná un restaurante"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurante/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          dealerId: selectedClaim.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      setSlug(data.slug);
      setResultName(data.name);
      setMode("claim");
      setStep(4);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitNew() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurante/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, restaurantName, phone, address,
          latitude, longitude, cuisineType, description,
          logoUrl: logoUrl || null, coverUrl: coverUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      setSlug(data.slug);
      setResultName(restaurantName);
      setStep(4);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // Progress bar
  const totalSteps = mode === "claim" ? 2 : 4;
  const currentStep = step === 1.5 ? 2 : step <= 1 ? 1 : mode === "claim" ? 2 : step;

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
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@restaurante.com"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Confirmar contraseña</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí la contraseña"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
            </div>
          )}

          {/* Step 1.5: Choose — claim or create new */}
          {step === 1.5 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">🍽️</div>
                <h2 className="text-lg font-bold text-text">¿Tu restaurante ya está en MenuSanJuan?</h2>
                <p className="text-xs text-text-muted">Si lo ves en la lista, reclamalo. Si no, creá uno nuevo.</p>
              </div>

              {/* Search */}
              <input
                type="text"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />

              {/* Unclaimed list */}
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-border/50 p-2">
                {filteredUnclaimed.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedClaim(selectedClaim?.id === r.id ? null : r)}
                    className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                      selectedClaim?.id === r.id
                        ? "border-2 border-primary bg-primary/5"
                        : "border-2 border-transparent hover:bg-surface-hover"
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-amber-100">
                      {r.coverUrl ? (
                        <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-lg font-bold text-primary">
                          {r.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{r.name}</div>
                      <div className="text-xs text-text-muted">
                        {r.cuisineType} · {r.itemCount} items
                        {r.address && ` · ${r.address.split(",")[0]}`}
                      </div>
                    </div>
                    {selectedClaim?.id === r.id && (
                      <svg className="h-5 w-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
                {filteredUnclaimed.length === 0 && (
                  <p className="text-center text-xs text-text-muted py-4">No se encontraron restaurantes</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setMode("new"); setStep(2); setError(""); }}
                  className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  Crear uno nuevo
                </button>
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={!selectedClaim || loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Reclamando...
                    </span>
                  ) : (
                    "Reclamar este"
                  )}
                </button>
              </div>

              {selectedClaim && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 animate-fade-in">
                  <p className="text-xs text-text-secondary">
                    Vas a tomar control de <strong>{selectedClaim.name}</strong> con tu email <strong>{email}</strong>.
                    El menú ({selectedClaim.itemCount} items) y toda la configuración se mantienen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Restaurant Details (new only) */}
          {step === 2 && mode === "new" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">🍽️</div>
                <h2 className="text-lg font-bold text-text">Datos de tu restaurante</h2>
                <p className="text-xs text-text-muted">Esto es lo que van a ver tus clientes</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Nombre del restaurante</label>
                <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ej: Puerto Pachatas"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">WhatsApp del restaurante</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 2645551234"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                <p className="mt-1 text-[11px] text-text-muted">Acá van a llegar los pedidos de tus clientes</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Tipo de cocina</label>
                <div className="grid grid-cols-3 gap-2">
                  {CUISINE_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => setCuisineType(c)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                        cuisineType === c ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-text-secondary hover:border-primary/40"
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onCoordinates={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                label="Dirección del restaurante"
                placeholder="Escribí la dirección..."
                optional
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Descripción <span className="text-text-muted font-normal">(opcional)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contales a tus clientes qué hacés mejor..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
              </div>
            </div>
          )}

          {/* Step 3: Images + Live Preview (new only) */}
          {step === 3 && mode === "new" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">📸</div>
                <h2 className="text-lg font-bold text-text">Dale imagen a tu restaurante</h2>
                <p className="text-xs text-text-muted">Así van a ver tu restaurante los clientes</p>
              </div>

              {/* Live Preview Card */}
              <div className="rounded-2xl border border-border/60 bg-surface shadow-sm overflow-hidden">
                <div className="relative h-28 bg-gradient-to-br from-slate-900 via-orange-950 to-red-950">
                  {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-end gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white text-lg font-bold shadow-lg border-2 border-white/20 overflow-hidden">
                      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : restaurantName?.charAt(0) || "R"}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{restaurantName || "Tu Restaurante"}</div>
                      {cuisineType && <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">{cuisineType}</span>}
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-text-secondary line-clamp-2">{description || "Descripción..."}</p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Logo <span className="text-text-muted font-normal">(URL)</span></label>
                <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Foto de portada <span className="text-text-muted font-normal">(URL)</span></label>
                <input type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <div className="rounded-xl bg-surface-alt border border-border/50 p-4">
                <h3 className="text-xs font-bold text-text mb-2">💡 ¿No tenés imágenes todavía?</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  No pasa nada, podés saltear este paso. Se pueden agregar después desde tu panel.
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
                {mode === "claim" ? "¡Restaurante reclamado!" : "¡Tu restaurante está listo!"}
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                {mode === "claim"
                  ? `Ahora sos el dueño de ${resultName}. Todo el menú y la configuración se mantienen.`
                  : "Ya podés empezar a recibir pedidos."
                }
              </p>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-6">
                <span className="text-sm font-bold text-primary">
                  menusanjuan.com/{slug}
                </span>
              </div>

              <div className="rounded-xl bg-surface-alt border border-border/50 p-4 mb-6 text-left">
                <h3 className="text-sm font-bold text-text mb-3">Próximos pasos:</h3>
                <div className="space-y-2.5">
                  {mode === "claim" ? (
                    <>
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                        <span className="text-sm text-text-secondary">Revisá el menú y ajustá precios si hace falta</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                        <span className="text-sm text-text-secondary">Configurá horarios y métodos de pago</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                        <span className="text-sm text-text-secondary">Compartí tu link y empezá a recibir pedidos</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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

          {/* Navigation Buttons (steps 1, 2, 3) */}
          {(step === 1 || (step >= 2 && step <= 3 && mode === "new")) && (
            <div className="mt-6 flex gap-3">
              {step > 1 && (
                <button type="button"
                  onClick={() => { setStep(step === 2 ? (unclaimed.length > 0 ? 1.5 : 1) : step - 1); setError(""); }}
                  className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
              )}
              <button type="button" onClick={handleNext} disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creando...
                  </span>
                ) : step === 3 ? "Crear mi Restaurante" : "Siguiente"}
              </button>
            </div>
          )}

          {/* Login link */}
          {step < 4 && step !== 1.5 && (
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
