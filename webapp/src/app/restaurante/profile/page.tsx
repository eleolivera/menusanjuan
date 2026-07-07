"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon, Camera, CheckCircle2, MapPin } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { PhoneInput } from "@/components/PhoneInput";
import { CuisineMultiSelect } from "@/components/CuisineMultiSelect";
import { useSmartSave } from "@/hooks/useSmartSave";
import { SaveIndicator } from "@/components/SaveIndicator";
import { MoneyInput } from "@/components/MoneyInput";
import { ScheduleEditor, ScheduleSummary } from "@/components/ScheduleEditor";
import { DeliveryZonesEditor, ZonesSummary } from "@/components/DeliveryZonesEditor";
import { ProfileSection, ProfileSectionFooter, SectionStatus } from "@/components/restaurante/ProfileSection";

const DAYS = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type HoursMap = Record<string, { open: string; close: string; closed: boolean }>;

function parseHours(json: string | null): HoursMap {
  if (!json) {
    const defaults: HoursMap = {};
    DAYS.forEach((d) => {
      defaults[d.key] = { open: "08:00", close: "23:00", closed: d.key === "dom" };
    });
    return defaults;
  }
  try { return JSON.parse(json); } catch { return parseHours(null); }
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(true);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [originalData, setOriginalData] = useState<Record<string, any>>({
    name: "", phone: "", address: "", latitude: null, longitude: null,
    cuisineType: "", description: "", logoUrl: "", coverUrl: "",
    openHours: JSON.stringify(parseHours(null)),
    mercadoPagoAlias: "", mercadoPagoCvu: "", bankInfo: "", posEnabled: false,
    deliveryEnabled: true, pickupEnabled: true,
    deliveryPricingEnabled: false,
    deliveryMode: "MANUAL" as "MANUAL" | "OWN" | "NETWORK" | "HYBRID",
    pickupHours: null as string | null, deliveryHours: null as string | null,
    deliveryZones: null as string | null,
    deliveryCloseRadius: null, deliveryClosePrice: null,
    deliveryFarRadius: null, deliveryFarPrice: null, deliveryFee: null, deliveryTimeMin: null,
  });

  const FIELD_CONFIG = {
    name: { tier: "autosave" as const },
    phone: { tier: "autosave" as const },
    address: { tier: "autosave" as const },
    latitude: { tier: "autosave" as const },
    longitude: { tier: "autosave" as const },
    cuisineType: { tier: "instant" as const },
    description: { tier: "autosave" as const },
    logoUrl: { tier: "instant" as const },
    coverUrl: { tier: "instant" as const },
    openHours: { tier: "autosave" as const },
    mercadoPagoAlias: { tier: "autosave" as const },
    mercadoPagoCvu: { tier: "autosave" as const },
    bankInfo: { tier: "autosave" as const },
    posEnabled: { tier: "instant" as const },
    deliveryEnabled: { tier: "instant" as const },
    deliveryPricingEnabled: { tier: "instant" as const },
    deliveryMode: { tier: "instant" as const },
    pickupEnabled: { tier: "instant" as const },
    // Tier 3 — explicit save. Complex structured editors that should commit
    // atomically (zones + schedules). User clicks "Guardar" inside the section
    // footer to commit; "Cancelar" reverts. No per-keystroke writes.
    pickupHours: { tier: "explicit" as const },
    deliveryHours: { tier: "explicit" as const },
    deliveryZones: { tier: "explicit" as const },
    deliveryCloseRadius: { tier: "autosave" as const },
    deliveryClosePrice: { tier: "autosave" as const },
    deliveryFarRadius: { tier: "autosave" as const },
    deliveryFarPrice: { tier: "autosave" as const },
    deliveryFee: { tier: "autosave" as const },
    deliveryTimeMin: { tier: "autosave" as const },
  };

  const { values, setValue, flushField, saveFields, revertField, statuses } = useSmartSave(
    originalData,
    FIELD_CONFIG,
    { endpoint: "/api/restaurante/profile", debounceMs: 1500 },
  );

  // Tier 3 sections — each has its own view/edit toggle state. Default: view mode.
  const [editingZones, setEditingZones] = useState(false);
  const [editingDeliveryHours, setEditingDeliveryHours] = useState(false);
  const [editingPickupHours, setEditingPickupHours] = useState(false);

  // Per-section dirty helpers — compare current value vs the last-saved original.
  const isFieldDirty = (field: string): boolean => {
    return JSON.stringify(values[field]) !== JSON.stringify(originalData[field]);
  };
  const isFieldSaving = (field: string): boolean => statuses[field] === "saving";

  // Generic helpers for explicit Tier 3 sections — same shape for every one.
  async function saveSection(field: string, exitEdit: () => void) {
    if (!isFieldDirty(field)) { exitEdit(); return; }
    await saveFields([field]);
    exitEdit();
  }
  function cancelSection(field: string, exitEdit: () => void) {
    revertField(field);
    exitEdit();
  }

  // beforeunload guard — warn if user tries to close/reload with unsaved Tier 3 changes
  useEffect(() => {
    const explicitFields = ["deliveryZones", "deliveryHours", "pickupHours"];
    const anyDirty = explicitFields.some(isFieldDirty);
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.deliveryZones, values.deliveryHours, values.pickupHours]);

  // Convenience accessors
  const name = values.name as string;
  const phone = values.phone as string;
  const address = values.address as string;
  const latitude = values.latitude as number | null;
  const longitude = values.longitude as number | null;
  const cuisineType = values.cuisineType as string;
  const description = values.description as string;
  const logoUrl = values.logoUrl as string;
  const coverUrl = values.coverUrl as string;
  const hours = parseHours(values.openHours as string);
  const mercadoPagoAlias = values.mercadoPagoAlias as string;
  const mercadoPagoCvu = values.mercadoPagoCvu as string;
  const bankInfo = values.bankInfo as string;
  const posEnabled = values.posEnabled as boolean;
  const deliveryEnabled = values.deliveryEnabled as boolean;
  const deliveryPricingEnabled = values.deliveryPricingEnabled as boolean;
  const pickupEnabled = values.pickupEnabled as boolean;
  const pickupHours = values.pickupHours as string | null;
  const deliveryHours = values.deliveryHours as string | null;
  const deliveryZones = values.deliveryZones as string | null;
  const deliveryFarRadius = values.deliveryFarRadius as number | null;
  const deliveryFee = values.deliveryFee as number | null;
  const deliveryTimeMin = values.deliveryTimeMin as number | null;
  const deliveryMode: "zones" | "flat" = deliveryFee != null && deliveryFee > 0 ? "flat" : "zones";

  function switchDeliveryMode(next: "zones" | "flat") {
    if (next === "flat") {
      setValue("deliveryZones", null);
      setValue("deliveryCloseRadius", null);
      setValue("deliveryClosePrice", null);
      setValue("deliveryFarPrice", null);
      setValue("deliveryFee", deliveryFee ?? 1500);
    } else {
      setValue("deliveryFee", null);
    }
  }

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(file: File, type: string, setter: (url: string) => void) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setter(data.url);
    } catch {}
  }

  useEffect(() => {
    fetch("/api/restaurante/profile")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setSlug(d.slug || "");
        setEmail(d.email || "");
        setHasPassword(d.hasPassword ?? true);
        setHasGoogle(d.hasGoogle ?? false);
        setOriginalData({
          name: d.name || "",
          phone: d.phone || "",
          address: d.address || "",
          latitude: d.latitude,
          longitude: d.longitude,
          cuisineType: d.cuisineType || "",
          description: d.description || "",
          logoUrl: d.logoUrl || "",
          coverUrl: d.coverUrl || "",
          openHours: d.openHours || JSON.stringify(parseHours(null)),
          mercadoPagoAlias: d.mercadoPagoAlias || "",
          mercadoPagoCvu: d.mercadoPagoCvu || "",
          bankInfo: d.bankInfo || "",
          posEnabled: d.posEnabled || false,
          deliveryEnabled: d.deliveryEnabled ?? true,
          deliveryPricingEnabled: d.deliveryPricingEnabled ?? false,
          deliveryMode: d.deliveryMode ?? "MANUAL",
          pickupEnabled: d.pickupEnabled ?? true,
          pickupHours: d.pickupHours || null,
          deliveryHours: d.deliveryHours || null,
          deliveryZones: d.deliveryZones || null,
          deliveryCloseRadius: d.deliveryCloseRadius,
          deliveryClosePrice: d.deliveryClosePrice,
          deliveryFarRadius: d.deliveryFarRadius,
          deliveryFarPrice: d.deliveryFarPrice,
          deliveryFee: d.deliveryFee,
          deliveryTimeMin: d.deliveryTimeMin,
        });
        setLoading(false);
      })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  // Scroll to a section based on URL hash (#pos, #modo-confiar, etc.).
  // Used by deep-links from Kanban banner + Novedades modal CTA.
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined" || !window.location.hash) return;
    const id = window.location.hash.replace(/^#/, "");
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [loading]);

  function updateHours(day: string, field: string, value: string | boolean) {
    const updated = { ...hours, [day]: { ...hours[day], [field]: value } };
    setValue("openHours", JSON.stringify(updated));
  }

  function handleImageUploadDone(field: "logoUrl" | "coverUrl", url: string) {
    setValue(field, url);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/restaurante")}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Perfil del Restaurante</h1>
              <p className="text-sm text-slate-400">menusanjuan.com/{slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Guardado automático</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Cover + Logo (Facebook-style, click to edit) */}
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          {/* Cover — click to change */}
          <div className="relative h-40 group cursor-pointer" onClick={() => coverInputRef.current?.click()}>
            {coverUrl ? (
              <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 text-slate-500 mx-auto mb-1" strokeWidth={1.5} />
                  <span className="text-xs text-slate-500">Agregar foto de portada</span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <Camera className="h-4 w-4" strokeWidth={1.5} />
                Cambiar portada
              </div>
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "cover", (url) => handleImageUploadDone("coverUrl", url)); e.target.value = ""; }} />
          </div>

          {/* Logo — overlapping the cover, click to change */}
          <div className="relative px-4 pb-4 -mt-10">
            <div className="flex items-end gap-4">
              <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-2xl font-bold shadow-lg border-4 border-slate-950 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    name?.charAt(0) || "R"
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo", (url) => handleImageUploadDone("logoUrl", url)); e.target.value = ""; }} />
              </div>
              <div className="pb-1">
                <div className="text-lg font-bold text-white">{name || "Tu Restaurante"}</div>
                <div className="flex items-center gap-2">
                  {cuisineType && <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">{cuisineType}</span>}
                  {address && <span className="text-xs text-slate-500">{address}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Información Básica</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                Nombre del restaurante <SaveIndicator status={statuses.name} />
              </label>
              <input type="text" value={name} onChange={(e) => setValue("name", e.target.value)} onBlur={() => flushField("name")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email (solo lectura)</label>
              <input type="email" value={email} disabled
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-500 transition-colors" />
            </div>
            <div>
              <PhoneInput
                value={phone}
                onChange={(v) => setValue("phone", v)}
                onBlur={() => flushField("phone")}
                label="WhatsApp del Restaurante"
                placeholder="264 555 1234"
                required
                darkMode
                statusIndicator={<SaveIndicator status={statuses.phone} />}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                Tipo de cocina <SaveIndicator status={statuses.cuisineType} />
              </label>
              <CuisineMultiSelect selected={cuisineType ? [cuisineType] : []} onChange={(vals) => setValue("cuisineType", vals[vals.length - 1] || "")} darkMode />
            </div>
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                Descripción <SaveIndicator status={statuses.description} />
              </label>
              <textarea value={description} onChange={(e) => setValue("description", e.target.value)} onBlur={() => flushField("description")} rows={3} placeholder="Contá qué hace especial a tu restaurante..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
            </div>
          </div>
        </section>

        {/* Address + Map */}
        <LocationSection
          address={address}
          onConfirm={(addr, lat, lng) => {
            setValue("address", addr);
            setValue("latitude", lat);
            setValue("longitude", lng);
          }}
        />

        {/* Servicios disponibles — independiente de los horarios */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-1">Servicios que ofrecés</h2>
          <p className="text-xs text-slate-400 mb-4">
            Activá / desactivá según querés que el cliente pueda pedir delivery o retiro. Es independiente del horario — los horarios se configuran abajo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-colors ${
              deliveryEnabled ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/5"
            }`}>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">🛵 Delivery</div>
                <div className="text-[11px] text-slate-400 mt-0.5">A domicilio con moto</div>
              </div>
              <input
                type="checkbox"
                checked={deliveryEnabled}
                onChange={(e) => setValue("deliveryEnabled", e.target.checked)}
                className="h-5 w-9 appearance-none rounded-full bg-slate-700 transition-colors checked:bg-primary relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>
            <label className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-colors ${
              pickupEnabled ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/5"
            }`}>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">🏪 Retiro en local</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Cliente lo busca en tu local</div>
              </div>
              <input
                type="checkbox"
                checked={pickupEnabled}
                onChange={(e) => setValue("pickupEnabled", e.target.checked)}
                className="h-5 w-9 appearance-none rounded-full bg-slate-700 transition-colors checked:bg-primary relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-500">
            <SaveIndicator status={statuses.deliveryEnabled} />
            <SaveIndicator status={statuses.pickupEnabled} />
          </div>
          {!deliveryEnabled && !pickupEnabled && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              ⚠️ Tenés ambos servicios apagados. El cliente no va a poder hacer pedidos hasta que actives al menos uno.
            </div>
          )}
        </section>

        {/* Delivery mode — how deliveries actually happen. MANUAL keeps the
            current copy-paste WhatsApp workflow; OWN/NETWORK/HYBRID route
            through the MenuSanJuan Repartidor PWA. See the Delivery Network
            docs for the dispatch semantics. */}
        {deliveryEnabled && (
          <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Cómo hacés los envíos</h2>
                <p className="text-xs text-slate-400 mt-1">Elegí cómo se le asigna un repartidor a cada pedido con envío.</p>
              </div>
              <SaveIndicator status={statuses.deliveryMode} />
            </div>
            <div className="space-y-2">
              {([
                { key: "MANUAL",  emoji: "📱", title: "Manual (como hoy)",   desc: "Copiás el mensaje a tu grupo de WhatsApp con tu repartidor de siempre." },
                { key: "OWN",     emoji: "🛵", title: "Mis repartidores",      desc: "Tus repartidores usan la app MenuSanJuan Repartidor. Cobrás el envío directo." },
                { key: "NETWORK", emoji: "🚚", title: "Red MenuSanJuan",       desc: "Repartidores de MenuSanJuan toman tus pedidos. Nos quedamos con el envío del ticket; vos cobrás la comida." },
                { key: "HYBRID",  emoji: "🔁", title: "Mis repartidores + red", desc: "Tus repartidores tienen preferencia. Si están ocupados, entra la red como refuerzo." },
              ] as const).map((mode) => {
                const active = values.deliveryMode === mode.key;
                return (
                  <button
                    type="button"
                    key={mode.key}
                    onClick={() => setValue("deliveryMode", mode.key)}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                      active ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none">{mode.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${active ? "text-primary" : "text-white"}`}>{mode.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{mode.desc}</div>
                      </div>
                      <div className={`shrink-0 h-4 w-4 rounded-full border-2 mt-1 ${active ? "border-primary bg-primary" : "border-slate-600"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
            {(values.deliveryMode === "OWN" || values.deliveryMode === "HYBRID") && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                💡 Cargá tus repartidores en <a className="underline font-semibold" href="/restaurante/drivers">Repartidores</a> del panel.
              </div>
            )}
          </section>
        )}

        {/* Delivery pricing — wrapped behind a toggle so restas that prefer to
            negotiate the fee per-order via WhatsApp don't have to fill anything in. */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Costo de Delivery</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Definí cómo cobrás el envío a los clientes.
              </p>
            </div>
          </div>

          {/* Pricing-enabled toggle (only meaningful when delivery itself is on) */}
          {deliveryEnabled ? (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-800/40 p-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Cobrar envío automáticamente</div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {deliveryPricingEnabled
                    ? "El sistema calcula el costo solo y se lo muestra al cliente al armar el pedido."
                    : "El cliente va a ver \"Costo de envío a confirmar\" y vos le pasás el precio por WhatsApp. Ideal para arrancar."}
                </p>
                <SaveIndicator status={statuses.deliveryPricingEnabled} />
              </div>
              <button
                type="button"
                onClick={() => setValue("deliveryPricingEnabled", !deliveryPricingEnabled)}
                className={`shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  deliveryPricingEnabled ? "bg-primary" : "bg-white/10"
                }`}
                aria-pressed={deliveryPricingEnabled}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    deliveryPricingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-4 text-xs text-slate-400">
              El delivery está desactivado arriba. Activalo para configurar el costo.
            </div>
          )}

          {(!latitude || !longitude) && deliveryEnabled && deliveryPricingEnabled && deliveryMode === "zones" && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              ⚠️ Necesitás cargar tu ubicación arriba (con el mapa) para que el cálculo por zonas funcione. Sin coordenadas, los clientes verán "Costo de envío a confirmar".
            </div>
          )}

          {deliveryEnabled && deliveryPricingEnabled && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-800/60 border border-white/5">
                <button
                  type="button"
                  onClick={() => switchDeliveryMode("zones")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${deliveryMode === "zones" ? "bg-primary text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  Por zonas
                </button>
                <button
                  type="button"
                  onClick={() => switchDeliveryMode("flat")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${deliveryMode === "flat" ? "bg-primary text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  Precio fijo
                </button>
              </div>

              {deliveryMode === "flat" ? (
                <div className="space-y-4">
                  <MoneyInput
                    label="Costo de envío — el mismo para todos los clientes"
                    value={deliveryFee ?? null}
                    onChange={(v) => setValue("deliveryFee", v)}
                    onBlur={() => flushField("deliveryFee")}
                    placeholder="2500"
                    darkMode
                    statusIndicator={<SaveIndicator status={statuses.deliveryFee} />}
                  />
                  <div>
                    <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                      Distancia máxima (km) — opcional <SaveIndicator status={statuses.deliveryFarRadius} />
                    </label>
                    <input
                      type="number" step="0.5" min="0"
                      value={deliveryFarRadius ?? ""}
                      onChange={(e) => setValue("deliveryFarRadius", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={() => flushField("deliveryFarRadius")}
                      placeholder="8.0"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Si lo dejás vacío, hacés envíos a cualquier distancia. Si ponés un número, los clientes más lejos verán &quot;Fuera del área&quot;.
                      {(!latitude || !longitude) && deliveryFarRadius != null && (
                        <span className="block mt-1 text-amber-300">⚠️ Para que la distancia máxima funcione, tenés que cargar tu ubicación arriba en el mapa.</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/5">
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Zonas de delivery</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {editingZones
                          ? "Editá los radios y precios. Los cambios se guardan cuando tocás \"Guardar zonas\"."
                          : "Cobrás distinto según la distancia."}
                      </p>
                    </div>
                    {!editingZones ? (
                      <button
                        type="button"
                        onClick={() => setEditingZones(true)}
                        className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        ✏️ Editar zonas
                      </button>
                    ) : (
                      <div className="shrink-0">
                        <SectionStatus dirty={isFieldDirty("deliveryZones")} saving={isFieldSaving("deliveryZones")} />
                      </div>
                    )}
                  </div>
                  <div className={`p-4 ${isFieldSaving("deliveryZones") ? "opacity-50 pointer-events-none" : ""}`}>
                    {editingZones ? (
                      <DeliveryZonesEditor
                        value={deliveryZones}
                        onChange={(json) => setValue("deliveryZones", json)}
                        dealerLat={latitude}
                        dealerLng={longitude}
                      />
                    ) : (
                      <ZonesSummary value={deliveryZones} />
                    )}
                  </div>
                  {editingZones && (
                    <div className="border-t border-white/5 bg-white/[0.015] px-4 py-3">
                      <ProfileSectionFooter
                        dirty={isFieldDirty("deliveryZones")}
                        saving={isFieldSaving("deliveryZones")}
                        onCancel={() => cancelSection("deliveryZones", () => setEditingZones(false))}
                        onSave={() => saveSection("deliveryZones", () => setEditingZones(false))}
                        saveLabel="Guardar zonas"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                  Tiempo estimado de entrega (minutos) <SaveIndicator status={statuses.deliveryTimeMin} />
                </label>
                <input
                  type="number" step="5" min="0"
                  value={deliveryTimeMin ?? ""}
                  onChange={(e) => setValue("deliveryTimeMin", e.target.value === "" ? null : Number(e.target.value))}
                  onBlur={() => flushField("deliveryTimeMin")}
                  placeholder="45"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>
          )}
        </section>

        {/* Horarios por método — Tier 3 (explicit save). View mode shows
           grouped summary; Edit mode reveals the per-day window editor + Save/Cancel. */}
        <ProfileSection
          title="Horarios de Delivery"
          subtitle={editingDeliveryHours
            ? "Editá los horarios. Los cambios se guardan cuando tocás \"Guardar horarios\"."
            : "Cuándo hacés delivery durante la semana."}
          status={editingDeliveryHours
            ? <SectionStatus dirty={isFieldDirty("deliveryHours")} saving={isFieldSaving("deliveryHours")} />
            : (
              <button
                type="button"
                onClick={() => setEditingDeliveryHours(true)}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                ✏️ Editar horarios
              </button>
            )
          }
          footer={editingDeliveryHours ? (
            <ProfileSectionFooter
              dirty={isFieldDirty("deliveryHours")}
              saving={isFieldSaving("deliveryHours")}
              onCancel={() => cancelSection("deliveryHours", () => setEditingDeliveryHours(false))}
              onSave={() => saveSection("deliveryHours", () => setEditingDeliveryHours(false))}
              saveLabel="Guardar horarios"
            />
          ) : undefined}
        >
          <div className={isFieldSaving("deliveryHours") ? "opacity-50 pointer-events-none" : ""}>
            {editingDeliveryHours ? (
              <ScheduleEditor
                title=""
                emoji="🛵"
                value={deliveryHours}
                onChange={(v) => setValue("deliveryHours", v)}
                copyFromLabel="Retiro"
                onCopyFromOther={() => { if (pickupHours) setValue("deliveryHours", pickupHours); }}
              />
            ) : (
              <ScheduleSummary value={deliveryHours} emoji="🛵" />
            )}
          </div>
        </ProfileSection>

        <ProfileSection
          title="Horarios de Retiro en local"
          subtitle={editingPickupHours
            ? "Editá los horarios. Los cambios se guardan cuando tocás \"Guardar horarios\"."
            : "Cuándo aceptás que vengan a buscar el pedido."}
          status={editingPickupHours
            ? <SectionStatus dirty={isFieldDirty("pickupHours")} saving={isFieldSaving("pickupHours")} />
            : (
              <button
                type="button"
                onClick={() => setEditingPickupHours(true)}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                ✏️ Editar horarios
              </button>
            )
          }
          footer={editingPickupHours ? (
            <ProfileSectionFooter
              dirty={isFieldDirty("pickupHours")}
              saving={isFieldSaving("pickupHours")}
              onCancel={() => cancelSection("pickupHours", () => setEditingPickupHours(false))}
              onSave={() => saveSection("pickupHours", () => setEditingPickupHours(false))}
              saveLabel="Guardar horarios"
            />
          ) : undefined}
        >
          <div className={isFieldSaving("pickupHours") ? "opacity-50 pointer-events-none" : ""}>
            {editingPickupHours ? (
              <ScheduleEditor
                title=""
                emoji="🏪"
                value={pickupHours}
                onChange={(v) => setValue("pickupHours", v)}
                copyFromLabel="Delivery"
                onCopyFromOther={() => { if (deliveryHours) setValue("pickupHours", deliveryHours); }}
              />
            ) : (
              <ScheduleSummary value={pickupHours} emoji="🏪" />
            )}
          </div>
        </ProfileSection>

        {/* Payment Info */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Métodos de Pago</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                Alias de Mercado Pago <SaveIndicator status={statuses.mercadoPagoAlias} />
              </label>
              <input type="text" value={mercadoPagoAlias} onChange={(e) => setValue("mercadoPagoAlias", e.target.value)} onBlur={() => flushField("mercadoPagoAlias")} placeholder="MI.ALIAS.MP"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                CVU <SaveIndicator status={statuses.mercadoPagoCvu} />
              </label>
              <input type="text" value={mercadoPagoCvu} onChange={(e) => setValue("mercadoPagoCvu", e.target.value)} onBlur={() => flushField("mercadoPagoCvu")} placeholder="0000003100..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center text-xs font-medium text-slate-400">
                Info bancaria (transferencia) <SaveIndicator status={statuses.bankInfo} />
              </label>
              <textarea value={bankInfo} onChange={(e) => setValue("bankInfo", e.target.value)} onBlur={() => flushField("bankInfo")} rows={2} placeholder="Banco, CBU, titular..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
            </div>
          </div>
        </section>

        {/* POS toggle */}
        <section id="pos" className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 scroll-mt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg">$</div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white">POS — Pedidos en el local</h2>
              <p className="text-xs text-slate-500 mt-0.5">Toma pedidos desde tu tablet o celular para mesas y mostrador. Los pedidos van directo a la cocina con el pago ya cobrado.</p>
            </div>
          </div>

          {/* What it does */}
          <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3 mb-4 space-y-2">
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>Cobra en efectivo, tarjeta, transferencia o Mercado Pago</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>Calculadora de vuelto automatica para efectivo</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>Pedidos por mesa o mostrador, todo en el mismo Kanban de cocina</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>Modifica precios o regala items con notas (cortesia, promo, etc.)</span>
            </div>
          </div>

          {/* Toggle (instant save via useSmartSave) */}
          <button
            type="button"
            onClick={() => setValue("posEnabled", !posEnabled)}
            disabled={statuses.posEnabled === "saving"}
            className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-all ${
              posEnabled ? "border-emerald-400/30 bg-emerald-400/5" : "border-white/10 bg-white/[0.02] hover:bg-white/5"
            } disabled:opacity-50`}
          >
            <div className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-in-out ${posEnabled ? "bg-emerald-500" : "bg-slate-700"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-1 ${posEnabled ? "translate-x-6 ml-0.5" : "translate-x-1"}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">{posEnabled ? "POS habilitado" : "Habilitar POS"}</p>
              <p className="text-[10px] text-slate-500">
                {statuses.posEnabled === "saving" ? "Guardando..." : statuses.posEnabled === "saved" ? "Guardado ✓" : posEnabled ? "Aparece en el menu lateral" : "Click para activar"}
              </p>
            </div>
          </button>

          {posEnabled && (
            <a href="/restaurante/pos" className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all">
              Abrir POS →
            </a>
          )}
        </section>

        {/* Security section */}
        <SecuritySection email={email} hasPassword={hasPassword} hasGoogle={hasGoogle} onPasswordSet={() => setHasPassword(true)} />

        {/* Bottom spacer */}
        <div className="pb-8" />
      </div>
    </div>
  );
}

function SecuritySection({ email, hasPassword, hasGoogle, onPasswordSet }: { email: string; hasPassword: boolean; hasGoogle: boolean; onPasswordSet: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleSetPassword() {
    if (newPw.length < 6) { setPwError("Mínimo 6 caracteres"); return; }
    if (newPw !== confirmPw) { setPwError("Las contraseñas no coinciden"); return; }
    setPwSaving(true);
    setPwError("");
    try {
      const res = await fetch("/api/restaurante/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", currentPassword: currentPw || undefined, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); return; }
      setPwSuccess(true);
      onPasswordSet();
      setShowForm(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Error de conexión");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
      <h2 className="text-sm font-bold text-white mb-4">Seguridad</h2>

      <div className="space-y-3">
        {/* Email */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 w-16">Email</span>
          <span className="text-slate-300">{email}</span>
        </div>

        {/* Google status */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 w-16">Google</span>
          {hasGoogle ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Vinculado
            </span>
          ) : (
            <button
              onClick={() => { window.location.href = "/api/auth/google?redirect=/restaurante/profile"; }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Vincular cuenta de Google
            </button>
          )}
        </div>

        {/* Password status */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 w-16">Clave</span>
          {hasPassword ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">••••••••</span>
              <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-primary hover:underline">
                Cambiar
              </button>
            </div>
          ) : (
            <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-amber-400 hover:underline">
              Crear contraseña
            </button>
          )}
          {pwSuccess && <span className="text-xs text-emerald-400">Guardada ✓</span>}
        </div>
      </div>

      {showForm && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {hasPassword && (
            <input
              type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              placeholder="Contraseña actual"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          )}
          <input
            type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder={hasPassword ? "Nueva contraseña" : "Crear contraseña (mín. 6)"}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          <input
            type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            placeholder="Confirmar contraseña"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setPwError(""); }} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSetPassword} disabled={pwSaving}
              className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50">
              {pwSaving ? "Guardando..." : hasPassword ? "Cambiar" : "Crear contraseña"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function LocationSection({ address, onConfirm }: { address: string; onConfirm: (addr: string, lat: number, lng: number) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white">Ubicación</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline transition-colors"
          >
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" strokeWidth={1.5} />
          <span className="text-sm text-slate-300">{address || "Sin dirección — hacé click en Editar para agregar"}</span>
        </div>
      ) : (
        <>
          <LocationPicker
            onLocationConfirm={(addr, lat, lng) => {
              onConfirm(addr, lat, lng);
              setEditing(false);
            }}
          />
          <button
            onClick={() => setEditing(false)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </>
      )}
    </section>
  );
}
