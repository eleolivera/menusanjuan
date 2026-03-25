"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

type Restaurant = {
  id: string; name: string; slug: string; phone: string; address: string | null;
  cuisineType: string; description: string | null; logoUrl: string | null; coverUrl: string | null;
  isActive: boolean; isVerified: boolean; claimedAt: string | null;
  ownerEmail: string; ownerName: string; isPlaceholder: boolean;
  sourceProfileId: string | null; sourceSite: string | null;
  openHours: string | null; mercadoPagoAlias: string | null; mercadoPagoCvu: string | null;
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
  const [isActive, setIsActive] = useState(true);

  // Owner assignment
  const [assignEmail, setAssignEmail] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  // Menu
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    const res = await fetch(`/api/admin/restaurants/${id}`);
    if (!res.ok) { router.push("/admin?login"); return; }
    const d = await res.json();
    setData(d);
    setName(d.name); setPhone(d.phone); setAddress(d.address || "");
    setCuisineType(d.cuisineType); setDescription(d.description || "");
    setIsActive(d.isActive);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, cuisineType, description, isActive }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
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
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-400 mb-1">Nombre</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Teléfono</label><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" /></div>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Dirección</label><input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Descripción</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none resize-none" /></div>
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
                    <span className="text-xs text-slate-400">${item.price.toLocaleString("es-AR")}</span>
                    <button onClick={() => handleToggleItem(item.id, item.available)} className={`text-xs ${item.available ? "text-emerald-400" : "text-slate-600"}`}>{item.available ? "✓" : "✗"}</button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-slate-600 hover:text-red-400">✕</button>
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
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Dueño Actual</h3>
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm text-white">{data.ownerName}</div>
                  <div className="text-xs text-slate-500">{data.ownerEmail}</div>
                </div>
                {data.isPlaceholder ? (
                  <span className="text-xs text-amber-400">Cuenta placeholder</span>
                ) : (
                  <button onClick={handleRemoveOwner} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Quitar dueño</button>
                )}
              </div>
            </div>

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
    </div>
  );
}
