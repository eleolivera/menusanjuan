"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";
import { LocationPicker } from "@/components/LocationPicker";

const CUISINE_OPTIONS = [
  "Comida Rápida", "Parrilla", "Pizzería", "Cafetería", "Pastas",
  "Sushi", "Heladería", "Empanadas", "Comida Árabe", "Comida Mexicana",
  "Comida China", "Vegetariano", "Postres", "Rotisería", "General",
];

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
        {/* Live Preview */}
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <div className="relative h-32 bg-gradient-to-br from-slate-900 via-orange-950 to-red-950">
            {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-end gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white text-xl font-bold shadow-lg border-2 border-white/20 overflow-hidden">
                {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : name?.charAt(0) || "R"}
              </div>
              <div>
                <div className="text-base font-bold text-white">{name || "Tu Restaurante"}</div>
                <div className="flex items-center gap-2">
                  {cuisineType && <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">{cuisineType}</span>}
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
              <label className="mb-1.5 block text-xs font-medium text-slate-400">WhatsApp</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2645551234"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Tipo de cocina</label>
              <div className="grid grid-cols-3 gap-2">
                {CUISINE_OPTIONS.map((c) => (
                  <button key={c} type="button" onClick={() => setCuisineType(c)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                      cuisineType === c ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-slate-400 hover:border-white/20"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Contá qué hace especial a tu restaurante..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
            </div>
          </div>
        </section>

        {/* Address + Map */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Ubicación</h2>
          <LocationPicker
            onLocationConfirm={(addr, lat, lng) => {
              setAddress(addr);
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </section>

        {/* Images */}
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold text-white mb-4">Imágenes</h2>
          <div className="flex gap-6">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              type="logo"
              label="Logo"
              shape="logo"
            />
            <div className="flex-1">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                type="cover"
                label="Foto de portada"
                shape="cover"
              />
            </div>
          </div>
        </section>

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

        {/* Account — Email + Password (for handoff) */}
        <AccountSection email={email} onEmailChange={setEmail} />

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
function AccountSection({ email, onEmailChange }: { email: string; onEmailChange: (e: string) => void }) {
  const [newEmail, setNewEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const isPlaceholder = email.endsWith("@menusanjuan.com");

  async function handleChangeEmail() {
    if (!newEmail.includes("@")) { setEmailMsg("Email inválido"); return; }
    setSaving(true);
    setEmailMsg("");
    const res = await fetch("/api/restaurante/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_email", newEmail }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setEmailMsg("Email actualizado");
      onEmailChange(newEmail);
    } else {
      setEmailMsg(data.error || "Error");
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) { setPwMsg("Mínimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setPwMsg("Las contraseñas no coinciden"); return; }
    setSaving(true);
    setPwMsg("");
    const res = await fetch("/api/restaurante/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setPwMsg("Contraseña actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwMsg(data.error || "Error");
    }
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
      <h2 className="text-sm font-bold text-white mb-1">Cuenta y Acceso</h2>
      <p className="text-xs text-slate-500 mb-4">
        {isPlaceholder
          ? "Esta cuenta usa un email temporal. Cambialo al email real del dueño para hacer la entrega."
          : "Modificá el email o la contraseña de acceso."}
      </p>

      {/* Handoff banner for placeholder accounts */}
      {isPlaceholder && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">🔑</span>
            <div>
              <p className="text-xs font-semibold text-amber-300">Cuenta pendiente de entrega</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                Cambiá el email al del dueño del restaurante y establecé una contraseña nueva. Con eso puede iniciar sesión y gestionar todo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Change Email */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Email de acceso</label>
        <div className="flex gap-2">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          <button onClick={handleChangeEmail} disabled={saving || newEmail === email}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-30">
            Cambiar
          </button>
        </div>
        {emailMsg && (
          <p className={`mt-1.5 text-xs font-medium ${emailMsg.includes("actualizado") ? "text-emerald-400" : "text-red-400"}`}>
            {emailMsg}
          </p>
        )}
      </div>

      {/* Change Password */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Cambiar contraseña</label>
        <div className="space-y-2">
          {!isPlaceholder && (
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Contraseña actual"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          )}
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar nueva contraseña"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          <button onClick={handleChangePassword} disabled={saving || !newPassword}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-30">
            Actualizar Contraseña
          </button>
        </div>
        {pwMsg && (
          <p className={`mt-1.5 text-xs font-medium ${pwMsg.includes("actualizada") ? "text-emerald-400" : "text-red-400"}`}>
            {pwMsg}
          </p>
        )}
      </div>
    </section>
  );
}
