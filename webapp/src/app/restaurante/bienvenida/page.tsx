"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";
import { CuisineMultiSelect } from "@/components/CuisineMultiSelect";

// ─── Types ───

type DealerData = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  cuisineType: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  isActive: boolean;
  deliveryEnabled: boolean;
  deliveryCloseRadius: number | null;
  deliveryClosePrice: number | null;
  deliveryFarRadius: number | null;
  deliveryFarPrice: number | null;
};

type MenuSummary = {
  categories: number;
  items: number;
};

// ─── Constants ───

const STEPS = [
  { key: "info", label: "Tu Restaurante" },
  { key: "brand", label: "Tu Marca" },
  { key: "delivery", label: "Zona de Entrega" },
  { key: "menu", label: "Tu Menu" },
  { key: "activate", label: "Activar" },
];

// ─── Main Component ───

export default function BienvenidaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [dealer, setDealer] = useState<DealerData | null>(null);
  const [menuSummary, setMenuSummary] = useState<MenuSummary>({ categories: 0, items: 0 });
  const [saving, setSaving] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  // Step 1 fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cuisineType, setCuisineType] = useState("");

  // Step 2 fields
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // Step 3 fields
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [closeRadius, setCloseRadius] = useState<string>("3");
  const [closePrice, setClosePrice] = useState<string>("500");
  const [farRadius, setFarRadius] = useState<string>("7");
  const [farPrice, setFarPrice] = useState<string>("900");

  // Step 5 state
  const [activated, setActivated] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("/api/restaurante/profile").then((r) => {
        if (!r.ok) throw new Error("unauth");
        return r.json();
      }),
      fetch("/api/restaurante/menu").then((r) => {
        if (!r.ok) return [];
        return r.json();
      }),
    ])
      .then(([profileData, menuData]) => {
        setDealer(profileData);
        setName(profileData.name || "");
        setPhone(profileData.phone || "");
        setCuisineType(profileData.cuisineType || "");
        setLogoUrl(profileData.logoUrl || "");
        setCoverUrl(profileData.coverUrl || "");
        setDeliveryEnabled(profileData.deliveryEnabled ?? true);
        if (profileData.deliveryCloseRadius != null) setCloseRadius(String(profileData.deliveryCloseRadius));
        if (profileData.deliveryClosePrice != null) setClosePrice(String(profileData.deliveryClosePrice));
        if (profileData.deliveryFarRadius != null) setFarRadius(String(profileData.deliveryFarRadius));
        if (profileData.deliveryFarPrice != null) setFarPrice(String(profileData.deliveryFarPrice));

        // If already active, redirect to dashboard
        if (profileData.isActive) {
          router.replace("/restaurante/menu");
          return;
        }

        const cats = Array.isArray(menuData) ? menuData : [];
        const totalItems = cats.reduce(
          (sum: number, c: { items?: unknown[] }) => sum + (c.items?.length || 0),
          0,
        );
        setMenuSummary({ categories: cats.length, items: totalItems });
        setLoading(false);
      })
      .catch(() => {
        router.push("/restaurante/login");
      });
  }, [router]);

  // Save helper
  const saveProfile = useCallback(
    async (data: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/restaurante/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("save failed");
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Image upload
  async function handleImageUpload(file: File, type: string): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) return data.url;
      return null;
    } catch {
      return null;
    }
  }

  // Step navigation
  function goNext() {
    setFadeKey((k) => k + 1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setFadeKey((k) => k + 1);
    setStep((s) => Math.max(s - 1, 0));
  }

  // Step 1: Save basic info
  async function handleStep1Next() {
    if (!phone.trim()) return;
    const ok = await saveProfile({ name, phone, cuisineType });
    if (ok) goNext();
  }

  // Step 2: Save brand images
  async function handleStep2Next() {
    const ok = await saveProfile({ logoUrl, coverUrl });
    if (ok) goNext();
  }

  // Step 3: Save delivery config
  async function handleStep3Next() {
    const data: Record<string, unknown> = { deliveryEnabled };
    if (deliveryEnabled) {
      data.deliveryCloseRadius = parseFloat(closeRadius) || null;
      data.deliveryClosePrice = parseFloat(closePrice) || null;
      data.deliveryFarRadius = parseFloat(farRadius) || null;
      data.deliveryFarPrice = parseFloat(farPrice) || null;
    }
    const ok = await saveProfile(data);
    if (ok) {
      // Refresh menu summary for step 4
      try {
        const res = await fetch("/api/restaurante/menu");
        if (res.ok) {
          const cats = await res.json();
          const totalItems = cats.reduce(
            (sum: number, c: { items?: unknown[] }) => sum + (c.items?.length || 0),
            0,
          );
          setMenuSummary({ categories: cats.length, items: totalItems });
        }
      } catch { /* ignore */ }
      goNext();
    }
  }

  // Step 4: Menu check (informational)
  function handleStep4Next() {
    goNext();
  }

  // Step 5: Activate
  async function handleActivate() {
    const ok = await saveProfile({ isActive: true });
    if (ok) {
      setActivated(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }

  // Checklist for step 5
  const hasPhone = !!phone.trim();
  const hasLogo = !!logoUrl;
  const hasMenu = menuSummary.items > 0;
  const canActivate = hasPhone && hasMenu;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-sm px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold text-sm shadow-md shadow-orange-500/25">
              M
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">MenuSanJuan</h1>
              <p className="text-[10px] text-slate-500">Configuracion inicial</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/restaurante/menu")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Saltar por ahora
          </button>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="px-4 pt-6 pb-2">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <button
                  onClick={() => {
                    if (i < step) {
                      setFadeKey((k) => k + 1);
                      setStep(i);
                    }
                  }}
                  disabled={i > step}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    i < step
                      ? "bg-orange-500 text-white cursor-pointer hover:bg-orange-400"
                      : i === step
                        ? "bg-orange-500 text-white ring-4 ring-orange-500/20"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {i < step ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 sm:w-10 mx-1 rounded-full transition-colors duration-300 ${i < step ? "bg-orange-500" : "bg-slate-800"}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-1">
            Paso {step + 1} de {STEPS.length} — {STEPS[step].label}
          </p>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 py-6" key={fadeKey}>
        <div className="max-w-lg mx-auto animate-fade-in">

          {/* ─── Step 1: Tu Restaurante ─── */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-3xl mb-2">🏪</div>
                <h2 className="text-xl font-bold text-white">Tu Restaurante</h2>
                <p className="text-sm text-slate-400 mt-1">Confirma que la informacion basica sea correcta</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Nombre del restaurante
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>

                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  label="WhatsApp del Restaurante"
                  placeholder="264 555 1234"
                  required
                  darkMode
                />
                <p className="text-[11px] text-slate-500 -mt-2">
                  Los pedidos de tus clientes llegan a este numero
                </p>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Tipo de cocina
                  </label>
                  <CuisineMultiSelect
                    selected={cuisineType ? [cuisineType] : []}
                    onChange={(vals) => setCuisineType(vals[vals.length - 1] || "")}
                    darkMode
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStep1Next}
                  disabled={saving || !phone.trim()}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Guardando..." : "Siguiente"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Tu Marca ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-3xl mb-2">🎨</div>
                <h2 className="text-xl font-bold text-white">Tu Marca</h2>
                <p className="text-sm text-slate-400 mt-1">Subi tu logo y foto de portada para tu pagina</p>
              </div>

              {/* Mini preview */}
              <div className="rounded-2xl border border-white/5 overflow-hidden">
                {/* Cover */}
                <div
                  className="relative h-28 group cursor-pointer"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="h-6 w-6 text-slate-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        <span className="text-[11px] text-slate-500">Click para subir portada</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-black/60 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                      {coverUrl ? "Cambiar portada" : "Subir portada"}
                    </span>
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const url = await handleImageUpload(f, "cover");
                        if (url) setCoverUrl(url);
                      }
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Logo + name preview */}
                <div className="relative px-4 pb-4 -mt-8">
                  <div className="flex items-end gap-3">
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xl font-bold shadow-lg border-4 border-slate-950 overflow-hidden">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          name?.charAt(0) || "R"
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <svg className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const url = await handleImageUpload(f, "logo");
                            if (url) setLogoUrl(url);
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div className="pb-1">
                      <div className="text-sm font-bold text-white">{name || "Tu Restaurante"}</div>
                      {cuisineType && (
                        <span className="rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {cuisineType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-center text-[11px] text-slate-500">
                Asi se ve tu restaurante en menusanjuan.com/{dealer?.slug}
              </p>

              <div className="flex justify-between">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleStep2Next}
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Siguiente"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Zona de Entrega ─── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-3xl mb-2">🛵</div>
                <h2 className="text-xl font-bold text-white">Zona de Entrega</h2>
                <p className="text-sm text-slate-400 mt-1">Configura tu delivery o solo retiro en local</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-5">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setDeliveryEnabled(!deliveryEnabled)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    deliveryEnabled ? "border-orange-500/30 bg-orange-500/5" : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <div className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${deliveryEnabled ? "bg-orange-500" : "bg-slate-700"}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 mt-1 ${deliveryEnabled ? "translate-x-6 ml-0.5" : "translate-x-1"}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">{deliveryEnabled ? "Delivery activado" : "Delivery desactivado"}</p>
                    <p className="text-[10px] text-slate-500">{deliveryEnabled ? "Configura las zonas de entrega" : "Solo retiro en local"}</p>
                  </div>
                </button>

                {deliveryEnabled && (
                  <>
                    {/* Explanation */}
                    <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Definimos dos zonas: la <span className="text-orange-400 font-medium">zona cercana</span> (pedidos
                        dentro de cierto radio) y la <span className="text-orange-400 font-medium">zona lejana</span> (pedidos
                        mas lejos, con un costo mayor). Si el cliente esta fuera de ambas zonas, solo puede retirar.
                      </p>
                    </div>

                    {/* Close zone */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-400">1</span>
                        Zona Cercana
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Radio (km)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={closeRadius}
                            onChange={(e) => setCloseRadius(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Precio envio ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={closePrice}
                            onChange={(e) => setClosePrice(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Far zone */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-400">2</span>
                        Zona Lejana
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Radio (km)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={farRadius}
                            onChange={(e) => setFarRadius(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Precio envio ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={farPrice}
                            onChange={(e) => setFarPrice(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleStep3Next}
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Siguiente"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Tu Menu ─── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-3xl mb-2">🍽️</div>
                <h2 className="text-xl font-bold text-white">Tu Menu</h2>
                <p className="text-sm text-slate-400 mt-1">Necesitas al menos un plato para activar tu pagina</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                {menuSummary.items > 0 ? (
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{menuSummary.categories}</div>
                        <div className="text-[11px] text-slate-500">{menuSummary.categories === 1 ? "categoria" : "categorias"}</div>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{menuSummary.items}</div>
                        <div className="text-[11px] text-slate-500">{menuSummary.items === 1 ? "plato" : "platos"}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tu menu tiene contenido
                    </div>
                    <a
                      href="/restaurante/menu"
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:underline"
                    >
                      Editar menu
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 text-2xl mx-auto">
                      !
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Tu menu esta vacio</p>
                      <p className="text-xs text-slate-400 mt-1">Agrega al menos una categoria y un plato para poder activar tu restaurante</p>
                    </div>
                    <a
                      href="/restaurante/menu"
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 text-sm font-medium text-orange-400 hover:bg-orange-500/20 transition-colors"
                    >
                      Ir al editor de menu
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleStep4Next}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 5: Activar ─── */}
          {step === 4 && (
            <div className="space-y-6">
              {!activated ? (
                <>
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2">🚀</div>
                    <h2 className="text-xl font-bold text-white">Activar tu Restaurante</h2>
                    <p className="text-sm text-slate-400 mt-1">Revisa que todo este listo</p>
                  </div>

                  {/* Checklist */}
                  <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-3">
                    <ChecklistItem label="Telefono de WhatsApp" done={hasPhone} />
                    <ChecklistItem label="Logo del restaurante" done={hasLogo} optional />
                    <ChecklistItem label="Menu con al menos un plato" done={hasMenu} />
                  </div>

                  {!canActivate && (
                    <p className="text-center text-xs text-amber-400">
                      Completa los items obligatorios para poder activar
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleActivate}
                      disabled={saving || !canActivate}
                      className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Activando..." : "Activar mi Restaurante"}
                    </button>
                    <button
                      onClick={goBack}
                      className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                    >
                      Volver
                    </button>
                  </div>
                </>
              ) : (
                /* Success state */
                <div className="text-center space-y-6 py-4">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-4xl mx-auto shadow-lg shadow-emerald-500/25 animate-scale-in">
                      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-white">Tu restaurante esta activo!</h2>
                    <p className="text-sm text-slate-400 mt-2">
                      Tus clientes ya pueden ver tu menu y hacer pedidos
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-slate-500 mb-1">Tu pagina publica</p>
                    <a
                      href={`/${dealer?.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 font-bold hover:underline text-lg"
                    >
                      menusanjuan.com/{dealer?.slug}
                    </a>
                    <p className="text-[11px] text-slate-500 mt-2">Compartila por WhatsApp con tus clientes!</p>
                  </div>

                  <button
                    onClick={() => router.push("/restaurante/menu")}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                  >
                    Ir al Panel de Control
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confetti overlay */}
      {showConfetti && <ConfettiOverlay />}
    </div>
  );
}

// ─── Checklist Item ───

function ChecklistItem({ label, done, optional }: { label: string; done: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <span className={`text-sm ${done ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </span>
      {optional && !done && (
        <span className="text-[10px] text-slate-600 ml-auto">opcional</span>
      )}
    </div>
  );
}

// ─── Confetti Animation ───

function ConfettiOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#f97316", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animId: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.003;

        if (p.opacity <= 0) continue;
        alive = true;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx!.restore();
      }

      if (alive) {
        animId = requestAnimationFrame(animate);
      }
    }

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
    />
  );
}
