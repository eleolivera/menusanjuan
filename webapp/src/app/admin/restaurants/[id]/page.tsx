"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";

type Restaurant = {
  id: string; name: string; slug: string; phone: string; address: string | null;
  cuisineType: string; description: string | null; logoUrl: string | null; coverUrl: string | null;
  isActive: boolean; isVerified: boolean; claimedAt: string | null;
  ownerEmail: string; ownerName: string; isPlaceholder: boolean;
  sourceProfileId: string | null; sourceSite: string | null;
  openHours: string | null; mercadoPagoAlias: string | null; mercadoPagoCvu: string | null;
  rating: number | null; deliveryFee: number | null;
  categories: { id: string; name: string; emoji: string | null; items: { id: string; name: string; description: string | null; price: number; imageUrl: string | null; badge: string | null; available: boolean }[] }[];
  claimRequests: { id: string; status: string; code: string | null; requestedAt: string; user: { email: string; name: string } }[];
  orderCount: number;
};

const CUISINE_OPTIONS = [
  "Comida Rápida", "Parrilla", "Pizzería", "Cafetería", "Pastas",
  "Sushi", "Heladería", "Empanadas", "Comida Árabe", "Comida Mexicana",
  "Comida China", "Vegetariano", "Postres", "Rotisería", "General",
];

export default function AdminRestaurantDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"info" | "menu" | "claims" | "owner">("info");

  // Editable fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [rating, setRating] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Owner assignment
  const [assignEmail, setAssignEmail] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  // Owner activation
  const [activating, setActivating] = useState(false);
  const [activatedCreds, setActivatedCreds] = useState<{ email: string; password: string; slug: string; name: string } | null>(null);
  const [whatsAppMsg, setWhatsAppMsg] = useState("");

  // Menu
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  // Edit item
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    const res = await fetch(`/api/admin/restaurants/${id}`);
    if (!res.ok) { router.push("/admin?login"); return; }
    const d = await res.json();
    setData(d);
    setName(d.name); setPhone(d.phone); setAddress(d.address || "");
    setCuisineType(d.cuisineType); setDescription(d.description || "");
    setLogoUrl(d.logoUrl || ""); setCoverUrl(d.coverUrl || "");
    setIsActive(d.isActive);
    setRating(d.rating != null ? String(d.rating) : "");
    setDeliveryFee(d.deliveryFee != null ? String(d.deliveryFee) : "");
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, cuisineType, description, logoUrl, coverUrl, isActive, rating: rating ? Number(rating) : null, deliveryFee: deliveryFee ? Number(deliveryFee) : null }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  }

  async function handleImageUpload(file: File, type: "logo" | "cover") {
    const setter = type === "logo" ? setLogoUrl : setCoverUrl;
    const setUploading = type === "logo" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const d = await res.json();
      if (res.ok) {
        setter(d.url);
        // Auto-save to DB
        await fetch(`/api/admin/restaurants/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [type === "logo" ? "logoUrl" : "coverUrl"]: d.url }),
        });
        fetchData();
      }
    } catch {}
    setUploading(false);
  }

  async function handleAssign() {
    setAssignMsg("");
    const res = await fetch(`/api/admin/restaurants/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: assignEmail }),
    });
    const d = await res.json();
    setAssignMsg(d.success ? `Asignado a ${assignEmail}` : d.message || d.error);
    if (d.success) { setAssignEmail(""); fetchData(); }
  }

  async function handleToggleOwner(enable: boolean) {
    setActivating(true);
    if (enable) {
      const res = await fetch(`/api/admin/restaurants/${id}/activate-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (d.success) {
        setActivatedCreds(d);
        setWhatsAppMsg(buildWhatsAppMessage(d));
        fetchData();
      } else {
        setAssignMsg(d.error || "Error al activar");
      }
    } else {
      await fetch(`/api/admin/restaurants/${id}/activate-owner`, { method: "DELETE" });
      setActivatedCreds(null);
      setWhatsAppMsg("");
      fetchData();
    }
    setActivating(false);
  }

  function buildWhatsAppMessage(creds: { email: string; password: string; slug: string; name: string }) {
    return `Hola! 👋 Soy de MenuSanJuan.com

Noté que *${creds.name}* no tiene su propia página de pedidos online todavía.

Te creamos una gratis — ya tiene tu menú cargado con precios e imágenes. Tus clientes pueden ver el menú y hacer pedidos por WhatsApp.

Es 100% gratis, sin comisiones.

🍽️ Tu página: menusanjuan.com/${creds.slug}

Para editar tu menú, horarios, y ver pedidos:
🔗 menusanjuan.com/restaurante/login
📧 ${creds.email}
🔑 ${creds.password}

Probalo y decime qué te parece!`;
  }

  async function handleRemoveOwner() {
    if (!confirm("¿Quitar al dueño actual? El restaurante volverá a estar sin reclamar.")) return;
    await fetch(`/api/admin/restaurants/${id}/assign`, { method: "DELETE" });
    fetchData();
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    await fetch(`/api/admin/restaurants/${id}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: newCatName, emoji: newCatEmoji }),
    });
    setNewCatName(""); setNewCatEmoji(""); fetchData();
  }

  async function handleAddItem(categoryId: string) {
    if (!itemName.trim() || !itemPrice) return;
    await fetch(`/api/admin/restaurants/${id}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "item", categoryId, name: itemName, price: itemPrice, description: itemDesc }),
    });
    setItemName(""); setItemPrice(""); setItemDesc(""); setAddingItemTo(null); fetchData();
  }

  async function handleDeleteCategory(catId: string) {
    if (!confirm("¿Eliminar esta categoría y todos sus items?")) return;
    await fetch(`/api/admin/restaurants/${id}/menu?type=category&targetId=${catId}`, { method: "DELETE" });
    fetchData();
  }

  async function handleDeleteItem(itemId: string) {
    await fetch(`/api/admin/restaurants/${id}/menu?type=item&targetId=${itemId}`, { method: "DELETE" });
    fetchData();
  }

  async function handleToggleItem(itemId: string, available: boolean) {
    await fetch(`/api/admin/restaurants/${id}/menu`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "item", itemId, available: !available }),
    });
    fetchData();
  }

  function startEditItem(item: any) {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditDesc(item.description || "");
    setEditImage(item.imageUrl || "");
  }

  async function handleUpdateItem() {
    if (!editingItem) return;
    await fetch(`/api/admin/restaurants/${id}/menu`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        itemId: editingItem.id,
        name: editName,
        price: Number(editPrice),
        description: editDesc || null,
        imageUrl: editImage || null,
      }),
    });
    setEditingItem(null);
    fetchData();
  }

  if (loading || !data) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin?login")} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{data.name}</h1>
              <p className="text-xs text-slate-500">/{data.slug} · {data.orderCount} pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-400">Guardado</span>}
            <a href={`/${data.slug}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">Ver pública</a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Status badges */}
        <div className="flex gap-2 mb-6">
          {data.isVerified ? <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">Verificado</span> : data.isPlaceholder ? <span className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">Sin reclamar</span> : <span className="rounded-md bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-400">Registrado</span>}
          {!data.isActive && <span className="rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">Inactivo</span>}
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-slate-500">{data.ownerEmail}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["info", "menu", "owner", "claims"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${tab === t ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>
              {t === "info" ? "Información" : t === "menu" ? `Menú (${data.categories.reduce((s, c) => s + c.items.length, 0)})` : t === "owner" ? "Dueño" : `Reclamos (${data.claimRequests.length})`}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === "info" && (
          <div className="space-y-4">
            {/* Cover + Logo */}
            <div className="rounded-2xl border border-white/5 overflow-hidden">
              {/* Cover */}
              <label className="relative block h-36 cursor-pointer group">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center">
                    <span className="text-xs text-slate-500">Click para agregar portada</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-black/60 rounded-lg px-3 py-1.5">
                    {uploadingCover ? "Subiendo..." : "Cambiar portada"}
                  </span>
                </div>
                <input type="file" accept="image/*,video/mp4" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "cover"); e.target.value = ""; }} />
              </label>

              {/* Logo */}
              <div className="relative px-4 pb-4 -mt-10">
                <label className="relative inline-block cursor-pointer group">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-2xl font-bold shadow-lg border-4 border-slate-950 overflow-hidden">
                    {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : name?.charAt(0) || "R"}
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white">
                      {uploadingLogo ? "..." : "Logo"}
                    </span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo"); e.target.value = ""; }} />
                </label>
                <span className="ml-3 text-lg font-bold text-white align-bottom">{name}</span>
              </div>
            </div>

            {/* Fields */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-400 mb-1">Nombre</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" /></div>
              <div><PhoneInput value={phone} onChange={setPhone} label="WhatsApp del Restaurante" placeholder="264 555 1234" required darkMode /></div>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Dirección</label><input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Descripción</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none resize-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rating (1-5 estrellas)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="5" step="0.1" value={rating} onChange={e => setRating(e.target.value)} placeholder="Ej: 4.5" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
                  {rating && <div className="flex items-center gap-0.5 shrink-0">{[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= Math.round(Number(rating)) ? "text-amber-400" : "text-slate-700"}`}>★</span>)}</div>}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Envío ($)</label>
                <input type="number" min="0" step="100" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="Gratis si vacío" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Tipo de cocina</label>
              <div className="flex flex-wrap gap-1.5">{CUISINE_OPTIONS.map(c => (
                <button key={c} onClick={() => setCuisineType(c)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${cuisineType === c ? "bg-primary/15 text-primary border border-primary/30" : "border border-white/10 text-slate-400 hover:border-white/20"}`}>{c}</button>
              ))}</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary" /><span className="text-xs text-slate-400">Activo</span></label>
            </div>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        )}

        {/* Menu tab */}
        {tab === "menu" && (
          <div className="space-y-4">
            {/* Add category */}
            <div className="flex gap-2">
              <input value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} placeholder="🍽️" className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-sm text-white focus:border-primary focus:outline-none" />
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nueva categoría" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" />
              <button onClick={handleAddCategory} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors">+ Categoría</button>
            </div>

            {data.categories.map(cat => (
              <div key={cat.id} className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                  <h3 className="text-sm font-bold text-white">{cat.emoji} {cat.name} <span className="font-normal text-slate-500">({cat.items.length})</span></h3>
                  <div className="flex gap-2">
                    <button onClick={() => { setAddingItemTo(cat.id); setItemName(""); setItemPrice(""); setItemDesc(""); }} className="rounded-lg bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10 transition-colors">+ Item</button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="rounded-lg p-1 text-slate-600 hover:text-red-400 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>

                {addingItemTo === cat.id && (
                  <div className="border-b border-white/5 bg-primary/5 p-3 flex gap-2">
                    <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Nombre *" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none" />
                    <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="Precio *" type="number" className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none" />
                    <button onClick={() => handleAddItem(cat.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">Agregar</button>
                    <button onClick={() => setAddingItemTo(null)} className="text-xs text-slate-500">✕</button>
                  </div>
                )}

                {cat.items.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0 ${!item.available ? "opacity-40" : ""}`}>
                    <span className="flex-1 text-sm text-white truncate">{item.name}</span>
                    {item.description && <span className="text-[10px] text-slate-600 truncate max-w-[150px]">{item.description}</span>}
                    <span className="text-xs text-slate-400 shrink-0">${item.price.toLocaleString("es-AR")}</span>
                    <button onClick={() => startEditItem(item)} className="text-xs text-slate-400 hover:text-primary transition-colors" title="Editar">✏️</button>
                    <button onClick={() => handleToggleItem(item.id, item.available)} className={`text-xs ${item.available ? "text-emerald-400" : "text-slate-600"}`} title={item.available ? "Desactivar" : "Activar"}>{item.available ? "✓" : "✗"}</button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-slate-600 hover:text-red-400" title="Eliminar">✕</button>
                  </div>
                ))}
                {cat.items.length === 0 && <div className="px-4 py-3 text-xs text-slate-600">Sin items</div>}
              </div>
            ))}
            {data.categories.length === 0 && <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center text-sm text-slate-500">Sin menú — agregá una categoría arriba</div>}
          </div>
        )}

        {/* Owner tab */}
        {tab === "owner" && (
          <div className="space-y-4">
            {/* Current owner info */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Dueño Actual</h3>
                {data.isPlaceholder ? (
                  <span className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">Placeholder</span>
                ) : (
                  <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">Dueño real</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm text-white">{data.ownerName}</div>
                  <div className="text-xs text-slate-500">{data.ownerEmail}</div>
                </div>
                {!data.isPlaceholder && (
                  <button onClick={handleRemoveOwner} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Quitar dueño</button>
                )}
              </div>
            </div>

            {/* Placeholder toggle + onboarding — only for placeholder accounts */}
            {data.isPlaceholder && (
              <div className={`rounded-2xl border p-6 space-y-4 transition-colors ${data.isVerified ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5 bg-slate-900/50"}`}>
                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Cuenta Habilitada</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.isVerified
                        ? "El dueño puede iniciar sesión. No aparece como \"sin reclamar\"."
                        : "Habilitá la cuenta para generar credenciales y enviar por WhatsApp."}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleOwner(!data.isVerified)}
                    disabled={activating}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${data.isVerified ? "bg-emerald-500" : "bg-slate-700"} ${activating ? "opacity-50" : ""}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-1 ${data.isVerified ? "translate-x-6 ml-0.5" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Credentials + WhatsApp — shown when enabled (verified) */}
                {data.isVerified && activatedCreds && (
                  <>
                    {/* Credentials card */}
                    <div className="rounded-xl bg-slate-900 border border-white/10 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Email</span>
                        <span className="text-sm font-mono text-white">{activatedCreds.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Contraseña</span>
                        <span className="text-sm font-mono text-primary font-bold">{activatedCreds.password}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Página</span>
                        <a href={`/${activatedCreds.slug}`} target="_blank" className="text-sm text-primary hover:underline">menusanjuan.com/{activatedCreds.slug}</a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Login</span>
                        <span className="text-sm text-slate-300">menusanjuan.com/restaurante/login</span>
                      </div>
                    </div>

                    {/* Editable WhatsApp message */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">Mensaje de WhatsApp (editá antes de enviar)</label>
                      <textarea
                        value={whatsAppMsg}
                        onChange={e => setWhatsAppMsg(e.target.value)}
                        rows={12}
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300 focus:border-emerald-400 focus:outline-none resize-y leading-relaxed"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(whatsAppMsg)}`}
                        target="_blank"
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white hover:bg-[#20BD5A] transition-colors"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Enviar por WhatsApp
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(whatsAppMsg)}
                        className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-400 hover:bg-white/5 transition-colors"
                        title="Copiar mensaje"
                      >
                        Copiar
                      </button>
                    </div>
                  </>
                )}

                {/* Already verified but no creds in memory — prompt to regenerate */}
                {data.isVerified && !activatedCreds && (
                  <div className="rounded-xl bg-slate-900 border border-white/10 p-4">
                    <p className="text-xs text-slate-400 mb-3">Esta cuenta ya está habilitada. Para generar nuevas credenciales y ver el mensaje de WhatsApp, desactivá y volvé a activar.</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Email:</span>
                      <span className="font-mono text-white">{data.ownerEmail}</span>
                    </div>
                  </div>
                )}

                {assignMsg && <p className="text-xs text-amber-400">{assignMsg}</p>}
              </div>
            )}

            {/* Pending owner */}
            {(data as any).pendingOwnerEmail && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">⏳</span>
                  <div>
                    <div className="text-xs font-semibold text-amber-300">Dueño pendiente</div>
                    <div className="text-sm text-white">{(data as any).pendingOwnerEmail}</div>
                    <div className="text-[11px] text-amber-400/70">Se asignará automáticamente cuando esta persona se registre</div>
                  </div>
                </div>
              </div>
            )}

            {/* Assign by email — for non-placeholder accounts */}
            {!data.isPlaceholder && (
              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Asignar Dueño por Email</h3>
                  <div className="flex gap-2">
                    <input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="email@ejemplo.com" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
                    <button onClick={handleAssign} disabled={!assignEmail.includes("@")} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">Asignar</button>
                  </div>
                  {assignMsg && <p className={`mt-2 text-xs ${assignMsg.startsWith("Asignado") ? "text-emerald-400" : "text-amber-400"}`}>{assignMsg}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claims tab */}
        {tab === "claims" && (
          <div className="space-y-3">
            {data.claimRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center text-sm text-slate-500">Sin reclamos para este restaurante</div>
            ) : data.claimRequests.map(c => (
              <div key={c.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{c.user.name} <span className="text-slate-500">({c.user.email})</span></div>
                  <div className="text-[11px] text-slate-600">{new Date(c.requestedAt).toLocaleString("es-AR")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.code && <span className="font-mono text-xs font-bold text-primary">{c.code}</span>}
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${c.status === "PENDING" ? "bg-amber-500/15 text-amber-400" : c.status === "CODE_SENT" ? "bg-blue-500/15 text-blue-400" : c.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-4">Editar Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Precio</label>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Descripción</label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">URL de imagen/video</label>
                <input value={editImage} onChange={e => setEditImage(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setEditingItem(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={handleUpdateItem}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
