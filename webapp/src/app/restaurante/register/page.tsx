"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneInput } from "@/components/PhoneInput";

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
  // Steps:
  // 1 = pick from list or "create new"
  // 2 = account (name, email, password)
  // 3 = restaurant details (new only: name, phone, cuisine)
  // 4 = done
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"new" | "claim" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // Unclaimed restaurants
  const [unclaimed, setUnclaimed] = useState<UnclaimedRestaurant[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<UnclaimedRestaurant | null>(null);
  const [claimSearch, setClaimSearch] = useState("");

  // Account fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Restaurant fields (new only)
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [cuisineType, setCuisineType] = useState("");

  // Result
  const [slug, setSlug] = useState("");
  const [resultName, setResultName] = useState("");

  // Init: check session + load unclaimed
  useEffect(() => {
    Promise.all([
      fetch("/api/restaurante/session").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/restaurante/unclaimed").then((r) => r.json()).catch(() => []),
    ]).then(([session, unclaimedData]) => {
      setUnclaimed(unclaimedData || []);
      if (session?.authenticated) {
        setIsLoggedIn(true);
        setEmail(session.user.email);
        setFirstName(session.user.name?.split(" ")[0] || "");
        setLastName(session.user.name?.split(" ").slice(1).join(" ") || "");
      }
      setInitLoading(false);
    });
  }, []);

  const filteredUnclaimed = unclaimed.filter((r) =>
    claimSearch === "" ||
    r.name.toLowerCase().includes(claimSearch.toLowerCase()) ||
    r.cuisineType.toLowerCase().includes(claimSearch.toLowerCase()) ||
    (r.address || "").toLowerCase().includes(claimSearch.toLowerCase())
  );

  // Step 1 → Step 2: user picked claim or new
  function handlePickClaim() {
    if (!selectedClaim) { setError("Seleccioná un restaurante"); return; }
    setMode("claim");
    setError("");
    if (isLoggedIn) {
      // Already logged in — claim directly
      doClaim();
    } else {
      setStep(2);
    }
  }

  function handlePickNew() {
    setMode("new");
    setSelectedClaim(null);
    setError("");
    if (isLoggedIn) {
      setStep(3); // skip account, go to restaurant details
    } else {
      setStep(2);
    }
  }

  // Step 2 → create account then proceed
  async function handleCreateAccount() {
    if (!firstName.trim() || !lastName.trim()) { setError("Ingresá tu nombre y apellido"); return; }
    if (!email.includes("@")) { setError("Ingresá un email válido"); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: `${firstName.trim()} ${lastName.trim()}` }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear cuenta");
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      // If claiming, do it now
      if (mode === "claim" && selectedClaim) {
        await doClaim();
        return;
      }

      // New restaurant — go to step 3
      setLoading(false);
      setStep(3);
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  }

  // Claim flow
  async function doClaim() {
    if (!selectedClaim) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurante/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerId: selectedClaim.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      setSlug(data.slug);
      setResultName(data.name);
      setStep(4);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // New restaurant flow
  async function handleCreateRestaurant() {
    if (!restaurantName.trim()) { setError("Ingresá el nombre de tu restaurante"); return; }
    if (!phone.trim()) { setError("Ingresá tu número de WhatsApp"); return; }
    if (!cuisineType) { setError("Seleccioná el tipo de cocina"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurante/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantName, phone, cuisineType }),
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

  if (initLoading) {
    return <div className="mesh-gradient flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
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
            {step === 1 ? "Registrar mi Restaurante" : step === 2 ? "Creá tu Cuenta" : step === 3 ? "Datos del Restaurante" : "¡Listo!"}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {step === 1 ? "¿Tu restaurante ya está en MenuSanJuan?" : step === 2 ? "Tus datos para iniciar sesión" : step === 3 ? "Info básica — podés completar después" : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-surface p-6 shadow-sm">

          {/* Step 1: Pick from list or create new */}
          {step === 1 && (
            <div className="space-y-4">
              {unclaimed.length > 0 && (
                <>
                  <input
                    type="text"
                    value={claimSearch}
                    onChange={(e) => setClaimSearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />

                  <div className="max-h-72 overflow-y-auto space-y-2 rounded-xl border border-border/50 p-2">
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
                </>
              )}

              {selectedClaim && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 animate-fade-in">
                  <p className="text-xs text-text-secondary">
                    Vas a tomar control de <strong>{selectedClaim.name}</strong>.
                    El menú ({selectedClaim.itemCount} items) y toda la configuración se mantienen.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePickNew}
                  className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  {unclaimed.length > 0 ? "No está, crear uno nuevo" : "Crear mi restaurante"}
                </button>
                {unclaimed.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePickClaim}
                    disabled={!selectedClaim || loading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </span>
                    ) : "Es este, reclamarlo"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Create account */}
          {step === 2 && (
            <div className="space-y-4">
              {selectedClaim && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-2">
                  <p className="text-xs text-text-secondary">
                    Reclamando: <strong>{selectedClaim.name}</strong>
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">Nombre</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">Apellido</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="Pérez"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
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

          {/* Step 3: Restaurant details (new only) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Nombre del restaurante</label>
                <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ej: Puerto Pachatas"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
              </div>
              <PhoneInput value={phone} onChange={setPhone} label="WhatsApp del restaurante" placeholder="264 555 1234" required />
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
                  ? `Ahora sos el dueño de ${resultName}. El menú y la configuración se mantienen.`
                  : "Completá tu perfil, subí tu menú y empezá a recibir pedidos."}
              </p>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-6">
                <span className="text-sm font-bold text-primary">menusanjuan.com/{slug}</span>
              </div>
              <button
                onClick={() => { window.location.href = "/restaurante/profile"; }}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Configurar mi Restaurante
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-danger/20 bg-red-50 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          {step === 2 && (
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setStep(1); setError(""); }}
                className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                Volver
              </button>
              <button type="button" onClick={handleCreateAccount} disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creando...
                  </span>
                ) : "Crear Cuenta"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setStep(isLoggedIn ? 1 : 2); setError(""); }}
                className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                Volver
              </button>
              <button type="button" onClick={handleCreateRestaurant} disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creando...
                  </span>
                ) : "Crear mi Restaurante"}
              </button>
            </div>
          )}

          {/* Login link */}
          {step <= 2 && step !== 4 && (
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
