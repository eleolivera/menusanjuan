"use client";

import { useState, useEffect, useRef } from "react";
import { PhoneInput } from "@/components/PhoneInput";
import { CuisineMultiSelect } from "@/components/CuisineMultiSelect";

type Restaurant = {
  id: string; name: string; slug: string; phone: string; address: string | null;
  cuisineType: string; description: string | null; logoUrl: string | null; coverUrl: string | null;
  isActive: boolean; isVerified: boolean; claimedAt: string | null;
  ownerEmail: string; ownerName: string; isPlaceholder: boolean;
  openHours: string | null;
  categories: { id: string; name: string; emoji: string | null; items: { id: string; name: string; description: string | null; price: number; imageUrl: string | null; badge: string | null; available: boolean }[] }[];
  orderCount: number;
  lastPassword: string | null;
};

type OnboardingStage = "NEEDS_INFO" | "READY" | "QUEUED" | "IN_PROGRESS" | "ONBOARDED";

const STAGES: { key: OnboardingStage; label: string; color: string }[] = [
  { key: "NEEDS_INFO", label: "Falta info", color: "text-amber-400" },
  { key: "READY", label: "Listo", color: "text-blue-400" },
  { key: "QUEUED", label: "Cola de contacto", color: "text-purple-400" },
  { key: "IN_PROGRESS", label: "En charla", color: "text-cyan-400" },
  { key: "ONBOARDED", label: "Onboardeado", color: "text-emerald-400" },
];

type HoursMap = Record<string, { open: string; close: string; closed: boolean }>;
const DAYS = [
  { key: "lun", label: "Lun" }, { key: "mar", label: "Mar" }, { key: "mie", label: "Mié" },
  { key: "jue", label: "Jue" }, { key: "vie", label: "Vie" }, { key: "sab", label: "Sáb" }, { key: "dom", label: "Dom" },
];
function parseHours(json: string | null): HoursMap {
  if (!json) {
    const d: HoursMap = {};
    DAYS.forEach((day) => { d[day.key] = { open: "08:00", close: "23:00", closed: day.key === "dom" }; });
    return d;
  }
  try { return JSON.parse(json); } catch { return parseHours(null); }
}

export function RestaurantModal({
  restaurantId,
  kanbanStage,
  onClose,
  onStageChange,
}: {
  restaurantId: string;
  kanbanStage?: OnboardingStage;
  onClose: () => void;
  onStageChange?: (stage: OnboardingStage) => void;
}) {
  const [data, setData] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "menu" | "owner">("info");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hours, setHours] = useState<HoursMap>(parseHours(null));
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  // Owner
  const [activating, setActivating] = useState(false);
  const [activatedCode, setActivatedCode] = useState<string | null>(null);
  const [whatsAppMsg, setWhatsAppMsg] = useState("");

  function updateHours(key: string, field: string, value: string | boolean) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function fetchData() {
    fetch(`/api/admin/restaurants/${restaurantId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setName(d.name); setPhone(d.phone); setAddress(d.address || "");
        setCuisineType(d.cuisineType); setDescription(d.description || "");
        setIsActive(d.isActive); setHours(parseHours(d.openHours));
        setLogoUrl(d.logoUrl || ""); setCoverUrl(d.coverUrl || "");
        if (d.lastPassword) setActivatedCode(d.lastPassword);
        setLoading(false);
      });
  }

  useEffect(() => { fetchData(); }, [restaurantId]);

  useEffect(() => {
    if (!data) return;
    const code = activatedCode || data.lastPassword || "";
    const email = data.ownerEmail;
    setWhatsAppMsg(`Hola! Soy de MenuSanJuan.com

Te creamos una pagina gratuita para *${data.name}* donde tus clientes pueden ver el menu completo con precios y hacer pedidos directo por WhatsApp. Sin intermediarios, sin comisiones — a diferencia de otras apps que se quedan con un porcentaje de cada venta, con nosotros todo lo que vendes es tuyo.

Ya esta armada con tu menu cargado:
${data.name}: menusanjuan.com/${data.slug}

Para entrar a tu panel y gestionar todo:
menusanjuan.com/restaurante/login
Email: ${email}
Codigo de acceso: ${code || "(sin generar)"}

La primera vez que entres te va a pedir que elijas tu propia contraseña.

Si tenes la carta actualizada con los precios de hoy, mandamela asi la actualizamos rapido.

Cualquier duda te ayudamos por aca, por llamada, o podemos pasar por el local. Estamos para hacerte las cosas faciles!`);
  }, [data, activatedCode]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, cuisineType, description, isActive, logoUrl, coverUrl, openHours: JSON.stringify(hours) }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  }

  async function handleImageUpload(file: File, type: "logo" | "cover") {
    setUploadingImg(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "restaurants");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      if (type === "logo") setLogoUrl(url); else setCoverUrl(url);
    }
    setUploadingImg(false);
  }

  async function handleActivate() {
    if (!data) return;
    setActivating(true);
    const dealerUrl = `/api/admin/restaurants/${restaurantId}/activate-owner`;
    let res = await fetch(dealerUrl, { method: "POST" });
    if (!res.ok) {
      await fetch(dealerUrl, { method: "DELETE" });
      res = await fetch(dealerUrl, { method: "POST" });
    }
    if (res.ok) {
      const creds = await res.json();
      setActivatedCode(creds.code);
    }
    setActivating(false);
    fetchData();
  }

  async function handleResetCode() {
    setActivating(true);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/reset-code`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setActivatedCode(d.code);
    }
    setActivating(false);
  }

  function openWhatsApp() {
    if (!data) return;
    if (!activatedCode && !data.lastPassword) {
      alert("Primero activa la cuenta para generar un codigo de acceso");
      return;
    }
    const cleanPhone = data.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMsg)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const menuItemCount = data.categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto w-full max-w-4xl bg-slate-950 border-l border-white/10 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg">←</button>
              <div>
                <a href={`https://menusanjuan.com/${data.slug}`} target="_blank" className="text-lg font-bold text-white hover:text-primary transition-colors">{data.name}</a>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">/{data.slug}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{data.orderCount} pedidos</span>
                  {data.isPlaceholder && <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 rounded">sin dueño</span>}
                  {data.isVerified && <span className="text-[10px] bg-emerald-400/10 text-emerald-400 px-1.5 rounded">verificado</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Kanban stage dropdown */}
              {kanbanStage && onStageChange && (
                <select
                  value={kanbanStage}
                  onChange={(e) => onStageChange(e.target.value as OnboardingStage)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                >
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              )}
              <a href={`https://menusanjuan.com/${data.slug}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">Ver publica</a>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(data.name + " San Juan")}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">Google</a>
              {data.phone && data.phone !== "0000000000" && (
                <button onClick={openWhatsApp} className="rounded-lg bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25 transition-colors">WhatsApp</button>
              )}
              {data.isPlaceholder && !data.isVerified && (
                <button onClick={handleActivate} disabled={activating} className="rounded-lg bg-purple-400/15 px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-400/25 disabled:opacity-50 transition-colors">
                  {activating ? "..." : "Activar"}
                </button>
              )}
              {(data.isVerified || activatedCode) && (
                <button onClick={handleResetCode} disabled={activating} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 disabled:opacity-50 transition-colors">
                  {activating ? "..." : "Resetear codigo"}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {(["info", "menu", "owner"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-all ${tab === t ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>
                {t === "info" ? "Informacion" : t === "menu" ? `Menu (${menuItemCount})` : "Dueño"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* ─── Info tab ─── */}
          {tab === "info" && (
            <div className="space-y-4">
              {/* Cover + logo */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 h-40">
                {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />}
                <label className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-lg">Cambiar portada</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "cover")} />
                </label>
                <div className="absolute bottom-3 left-3">
                  <label className="relative cursor-pointer group">
                    {logoUrl ? <img src={logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover border-2 border-slate-950" /> :
                      <div className="h-16 w-16 rounded-xl bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-2xl">🍽️</div>}
                    <div className="absolute inset-0 rounded-xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] text-white">Logo</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "logo")} />
                  </label>
                </div>
                {uploadingImg && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <PhoneInput value={phone} onChange={setPhone} label="WhatsApp" placeholder="264 555 1234" required darkMode />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Direccion</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Descripcion</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo de cocina</label>
                <CuisineMultiSelect selected={cuisineType ? [cuisineType] : []} onChange={(vals) => setCuisineType(vals[vals.length - 1] || "")} darkMode />
              </div>

              {/* Hours */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Horarios</label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div key={day.key} className="text-center space-y-1">
                      <span className="text-[10px] font-medium text-slate-400 block">{day.label}</span>
                      <label className="flex items-center justify-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={!hours[day.key]?.closed} onChange={(e) => updateHours(day.key, "closed", !e.target.checked)}
                          className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-3 w-3" />
                      </label>
                      {!hours[day.key]?.closed ? (
                        <div className="space-y-1">
                          <input type="time" value={hours[day.key]?.open || "08:00"} onChange={(e) => updateHours(day.key, "open", e.target.value)}
                            className="w-full rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-white focus:border-primary focus:outline-none" />
                          <input type="time" value={hours[day.key]?.close || "23:00"} onChange={(e) => updateHours(day.key, "close", e.target.value)}
                            className="w-full rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-white focus:border-primary focus:outline-none" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 block">Cerrado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary" />
                  <span className="text-xs text-slate-400">Activo</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Menu tab ─── */}
          {tab === "menu" && (
            <div className="space-y-3">
              {data.categories.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
                  <p className="text-slate-500">Sin categorias de menu</p>
                </div>
              ) : data.categories.map((cat) => (
                <div key={cat.id} className="rounded-xl border border-white/5 bg-slate-900/30">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{cat.emoji} {cat.name}</span>
                    <span className="text-[10px] text-slate-500">{cat.items.length} items</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {cat.items.map((item) => (
                      <div key={item.id} className="px-4 py-2 flex items-center gap-3">
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{item.name}</p>
                          {item.description && <p className="text-[10px] text-slate-500 truncate">{item.description}</p>}
                        </div>
                        <span className="text-xs text-primary font-semibold">${item.price.toLocaleString("es-AR")}</span>
                        <span className={`text-[10px] ${item.available ? "text-emerald-400" : "text-red-400"}`}>{item.available ? "✓" : "✗"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Owner tab ─── */}
          {tab === "owner" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Cuenta del dueño</h3>
                  {data.isPlaceholder ? <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded">Placeholder</span>
                    : <span className="text-[10px] bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded">Dueño real</span>}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white font-mono">{data.ownerEmail}</span>
                </div>
                {(activatedCode || data.lastPassword) && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Codigo</span>
                    <span className="text-primary font-mono font-bold">{activatedCode || data.lastPassword}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {data.isPlaceholder && !data.isVerified && (
                  <button onClick={handleActivate} disabled={activating} className="rounded-xl bg-purple-500/15 px-4 py-2 text-xs font-semibold text-purple-400 hover:bg-purple-500/25 transition-colors disabled:opacity-50">
                    {activating ? "Activando..." : "Generar codigo de acceso"}
                  </button>
                )}
                {(data.isVerified || activatedCode) && (
                  <button onClick={handleResetCode} disabled={activating} className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 transition-colors disabled:opacity-50">
                    {activating ? "Generando..." : "Regenerar codigo"}
                  </button>
                )}
              </div>

              {/* WhatsApp message */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Mensaje de WhatsApp</label>
                <textarea value={whatsAppMsg} onChange={(e) => setWhatsAppMsg(e.target.value)} rows={12}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none resize-y leading-relaxed" />
              </div>
              <button onClick={openWhatsApp}
                className="rounded-xl bg-[#25D366] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#20BD5A] transition-colors flex items-center gap-2">
                Enviar por WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
