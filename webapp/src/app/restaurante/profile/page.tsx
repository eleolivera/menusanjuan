"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationPicker } from "@/components/LocationPicker";
import { PhoneInput } from "@/components/PhoneInput";
import { CuisineMultiSelect } from "@/components/CuisineMultiSelect";

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [cuisineType, setCuisineType] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [hours, setHours] = useState<HoursMap>(parseHours(null));
  const [mercadoPagoAlias, setMercadoPagoAlias] = useState("");
  const [mercadoPagoCvu, setMercadoPagoCvu] = useState("");
  const [bankInfo, setBankInfo] = useState("");

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
        setName(d.name || "");
        setSlug(d.slug || "");
        setEmail(d.email || "");
        setPhone(d.phone || "");
        setAddress(d.address || "");
        setLatitude(d.latitude);
        setLongitude(d.longitude);
        setCuisineType(d.cuisineType || "");
        setDescription(d.description || "");
        setLogoUrl(d.logoUrl || "");
        setCoverUrl(d.coverUrl || "");
        setHours(parseHours(d.openHours));
        setMercadoPagoAlias(d.mercadoPagoAlias || "");
        setMercadoPagoCvu(d.mercadoPagoCvu || "");
        setBankInfo(d.bankInfo || "");
        setLoading(false);
      })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/restaurante/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, phone, address, latitude, longitude, cuisineType,
        description, logoUrl, coverUrl,
        openHours: JSON.stringify(hours),
        mercadoPagoAlias, mercadoPagoCvu, bankInfo,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function updateHours(day: string, field: string, value: string | boolean) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/restaurante")}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Perfil del Restaurante</h1>
              <p className="text-sm text-slate-400">menusanjuan.com/{slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs font-medium text-emerald-400 animate-fade-in">Guardado</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
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
                  <svg className="h-8 w-8 text-slate-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <span className="text-xs text-slate-500">Agregar foto de portada</span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Cambiar portada
              </div>
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "cover", setCoverUrl); e.target.value = ""; }} />
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
                  <svg className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo", setLogoUrl); e.target.value = ""; }} />
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
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre del restaurante</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email (solo lectura)</label>
              <input type="email" value={email} disabled
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-500 transition-colors" />
            </div>
            <div>
              <PhoneInput value={phone} onChange={setPhone} label="WhatsApp del Restaurante" placeholder="264 555 1234" required darkMode />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Tipo de cocina</label>
              <CuisineMultiSelect selected={cuisineType ? [cuisineType] : []} onChange={(vals) => setCuisineType(vals[vals.length - 1] || "")} darkMode />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Contá qué hace especial a tu restaurante..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
            </div>
          </div>
        </section>

        {/* Address + Map */}
        <LocationSection
          address={address}
          onConfirm={(addr, lat, lng) => {
            setAddress(addr);
            setLatitude(lat);
            setLongitude(lng);
          }}
        />

        {/* Images section removed — cover + logo are editable in the preview above */}

        {/* Hours of Operation */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Horarios de Atención</h2>
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day.key} className="flex items-center gap-3">
                <span className="w-20 text-xs font-medium text-slate-400">{day.label}</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hours[day.key]?.closed}
                    onChange={(e) => updateHours(day.key, "closed", !e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                  />
                  <span className="text-[11px] text-slate-500">Abierto</span>
                </label>
                {!hours[day.key]?.closed && (
                  <div className="flex items-center gap-2">
                    <input type="time" value={hours[day.key]?.open || "08:00"}
                      onChange={(e) => updateHours(day.key, "open", e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none" />
                    <span className="text-xs text-slate-600">a</span>
                    <input type="time" value={hours[day.key]?.close || "23:00"}
                      onChange={(e) => updateHours(day.key, "close", e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none" />
                  </div>
                )}
                {hours[day.key]?.closed && (
                  <span className="text-xs text-slate-600">Cerrado</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Payment Info */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Métodos de Pago</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Alias de Mercado Pago</label>
              <input type="text" value={mercadoPagoAlias} onChange={(e) => setMercadoPagoAlias(e.target.value)} placeholder="MI.ALIAS.MP"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">CVU</label>
              <input type="text" value={mercadoPagoCvu} onChange={(e) => setMercadoPagoCvu(e.target.value)} placeholder="0000003100..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Info bancaria (transferencia)</label>
              <textarea value={bankInfo} onChange={(e) => setBankInfo(e.target.value)} rows={2} placeholder="Banco, CBU, titular..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
            </div>
          </div>
        </section>

        {/* Save button (bottom) */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Separate component to manage email + password changes
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
          <svg className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
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
