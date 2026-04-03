"use client";

import { useState } from "react";
import { OptionGroupEditor } from "@/components/OptionGroupEditor";
import { formatARS } from "@/lib/admin-utils";

// ─── Types ───

type OptionChoice = { id: string; name: string; priceDelta: number; available: boolean };
type OptionGroup = { id: string; title: string; minSelections: number; maxSelections: number; options: OptionChoice[] };
type MenuItem = {
  id: string; name: string; description: string | null; price: number;
  imageUrl: string | null; badge: string | null; available: boolean; sortOrder?: number;
  optionGroups?: OptionGroup[];
};
type Category = { id: string; name: string; emoji: string | null; sortOrder?: number; items: MenuItem[] };

type MenuEditorProps = {
  categories: Category[];
  onRefresh: () => void;
  apiBase: string; // "/api/restaurante/menu" or "/api/admin/restaurants/{id}/menu"
  useAdminApi?: boolean; // admin uses { type: "category" | "item" | "option-group" } pattern
  uploadEndpoint?: string; // "/api/upload" — pass null to disable file upload
};

// ─── Main Component ───

export function MenuEditor({ categories, onRefresh, apiBase, useAdminApi, uploadEndpoint = "/api/upload" }: MenuEditorProps) {
  // Category form
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");

  // Item add form
  const [addingItemCat, setAddingItemCat] = useState<string | null>(null);

  // Edit modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", imageUrl: "", badge: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(item: MenuItem) {
    setEditingItem(item);
    setForm({ name: item.name, description: item.description || "", price: String(item.price), imageUrl: item.imageUrl || "", badge: item.badge || "" });
  }

  function startAdd(categoryId: string) {
    setAddingItemCat(categoryId);
    setForm({ name: "", description: "", price: "", imageUrl: "", badge: "" });
  }

  // ─── API calls ───

  async function addCategory() {
    if (!newCatName.trim()) return;
    if (useAdminApi) {
      await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "category", name: newCatName.trim(), emoji: newCatEmoji || null }) });
    } else {
      await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCatName.trim(), emoji: newCatEmoji || null }) });
    }
    setNewCatName(""); setNewCatEmoji(""); setAddingCat(false); onRefresh();
  }

  async function deleteCategory(catId: string, catName: string) {
    if (!confirm(`Eliminar "${catName}" y todos sus items?`)) return;
    if (useAdminApi) {
      await fetch(`${apiBase}?type=category&targetId=${catId}`, { method: "DELETE" });
    } else {
      await fetch(`${apiBase}?id=${catId}`, { method: "DELETE" });
    }
    onRefresh();
  }

  async function addItem(categoryId: string) {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    if (useAdminApi) {
      await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "item", categoryId, name: form.name.trim(), description: form.description || null, price: Number(form.price), imageUrl: form.imageUrl || null, badge: form.badge || null }) });
    } else {
      await fetch("/api/restaurante/menu/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId, name: form.name.trim(), description: form.description || null, price: Number(form.price), imageUrl: form.imageUrl || null, badge: form.badge || null }) });
    }
    setSaving(false); setAddingItemCat(null); onRefresh();
  }

  async function updateItem() {
    if (!editingItem) return;
    setSaving(true);
    if (useAdminApi) {
      await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "item", itemId: editingItem.id, name: form.name, description: form.description || null, price: Number(form.price), imageUrl: form.imageUrl || null, badge: form.badge || null }) });
    } else {
      await fetch("/api/restaurante/menu/items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingItem.id, name: form.name, description: form.description || null, price: Number(form.price), imageUrl: form.imageUrl || null, badge: form.badge || null }) });
    }
    setSaving(false); setEditingItem(null); onRefresh();
  }

  async function toggleAvailability(item: MenuItem) {
    if (useAdminApi) {
      await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "item", itemId: item.id, available: !item.available }) });
    } else {
      await fetch("/api/restaurante/menu/items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, available: !item.available }) });
    }
    onRefresh();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Eliminar este item?")) return;
    if (useAdminApi) {
      await fetch(`${apiBase}?type=item&targetId=${itemId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/restaurante/menu/items?id=${itemId}`, { method: "DELETE" });
    }
    onRefresh();
  }

  async function handleUpload(file: File) {
    if (!uploadEndpoint) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      updateForm("imageUrl", url);
    }
    setUploading(false);
  }

  const optionGroupApiBase = useAdminApi ? apiBase : "/api/restaurante/menu/items/option-groups";
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  // ─── Render ───

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{categories.length} categorias, {totalItems} items</span>
        {!addingCat && (
          <button onClick={() => setAddingCat(true)} className="rounded-lg bg-primary/15 px-3 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/25 transition-colors">
            + Categoria
          </button>
        )}
      </div>

      {/* Add category */}
      {addingCat && (
        <div className="flex gap-2 animate-fade-in">
          <input value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} placeholder="Emoji" className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-sm text-white focus:border-primary focus:outline-none" />
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nombre de la categoria" autoFocus onKeyDown={(e) => e.key === "Enter" && addCategory()} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
          <button onClick={addCategory} disabled={!newCatName.trim()} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Crear</button>
          <button onClick={() => setAddingCat(false)} className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 && !addingCat && (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <div className="text-3xl mb-3">🍽️</div>
          <h3 className="text-sm font-bold text-white mb-1">Menu vacio</h3>
          <p className="text-xs text-slate-500 mb-4">Agrega una categoria para empezar</p>
          <button onClick={() => setAddingCat(true)} className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-primary/25 transition-all">
            + Agregar categoria
          </button>
        </div>
      )}

      {/* Categories */}
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-xl border border-white/5 bg-slate-900/30 overflow-hidden">
          {/* Category header */}
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{cat.emoji || "🍽️"}</span>
              <span className="text-sm font-semibold text-white">{cat.name}</span>
              <span className="text-[10px] text-slate-600">{cat.items.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startAdd(cat.id)} className="text-[10px] text-primary hover:underline">+ Item</button>
              <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Eliminar</button>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-white/5">
            {cat.items.map((item) => (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => startEdit(item)}>
                {item.imageUrl ? (
                  isVideo(item.imageUrl) ? (
                    <video src={item.imageUrl} className="h-10 w-10 rounded-lg object-cover shrink-0" autoPlay loop muted playsInline />
                  ) : (
                    <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  )
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-slate-700 text-xs">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{item.name}</span>
                    {item.badge && <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-semibold text-primary">{item.badge}</span>}
                    {!item.available && <span className="rounded bg-red-400/20 px-1 py-0.5 text-[9px] font-semibold text-red-400">Oculto</span>}
                    {item.optionGroups && item.optionGroups.length > 0 && <span className="rounded bg-purple-400/20 px-1 py-0.5 text-[9px] font-semibold text-purple-400">{item.optionGroups.length} opc</span>}
                  </div>
                  {item.description && <p className="text-[10px] text-slate-500 truncate">{item.description}</p>}
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{formatARS(item.price)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleAvailability(item)} className={`rounded-lg p-1.5 transition-colors ${item.available ? "text-emerald-400 hover:bg-emerald-400/10" : "text-slate-600 hover:bg-white/5"}`} title={item.available ? "Ocultar" : "Mostrar"}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={item.available ? "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" : "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"} /></svg>
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Add item inline */}
            {addingItemCat === cat.id && (
              <div className="px-4 py-3 space-y-2 bg-primary/5 animate-fade-in">
                <div className="flex gap-2">
                  <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Nombre *" autoFocus className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                  <input value={form.price} onChange={(e) => updateForm("price", e.target.value)} placeholder="Precio *" type="number" className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                </div>
                <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Descripcion (opcional)" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                {/* Image upload */}
                <ImageUploadField imageUrl={form.imageUrl} onChange={(url) => updateForm("imageUrl", url)} onUpload={handleUpload} uploading={uploading} uploadEndpoint={uploadEndpoint} />
                <div className="flex gap-2">
                  <button onClick={() => addItem(cat.id)} disabled={!form.name.trim() || !form.price || saving} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Agregar"}</button>
                  <button onClick={() => setAddingItemCat(null)} className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
                </div>
              </div>
            )}

            {cat.items.length === 0 && addingItemCat !== cat.id && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-600 mb-2">Sin items</p>
                <button onClick={() => startAdd(cat.id)} className="text-[10px] text-primary hover:underline">+ Agregar item</button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Edit item modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-md max-h-[85vh] rounded-2xl bg-slate-900 border border-white/10 shadow-2xl animate-scale-in flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-3 shrink-0 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Editar item</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 overflow-y-auto flex-1 space-y-3 pb-4" style={{ minHeight: 0 }}>
              <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Nombre" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <div className="flex gap-2">
                <input value={form.price} onChange={(e) => updateForm("price", e.target.value)} placeholder="Precio" type="number" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                <input value={form.badge} onChange={(e) => updateForm("badge", e.target.value)} placeholder="Badge (Popular, Nuevo)" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              </div>
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Descripcion" rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none resize-none" />

              {/* Image */}
              <ImageUploadField imageUrl={form.imageUrl} onChange={(url) => updateForm("imageUrl", url)} onUpload={handleUpload} uploading={uploading} uploadEndpoint={uploadEndpoint} />

              {/* Option groups */}
              <OptionGroupEditor
                menuItemId={editingItem.id}
                groups={(editingItem.optionGroups || []).map((g) => ({ id: g.id, title: g.title, minSelections: g.minSelections, maxSelections: g.maxSelections, options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available })) }))}
                onUpdate={onRefresh}
                apiBase={optionGroupApiBase}
                useAdminApi={useAdminApi}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 shrink-0 border-t border-white/5 flex items-center justify-between">
              <button onClick={() => { deleteItem(editingItem.id); setEditingItem(null); }} className="text-xs text-red-400 hover:underline">Eliminar item</button>
              <div className="flex gap-2">
                <button onClick={() => setEditingItem(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">Cancelar</button>
                <button onClick={updateItem} disabled={saving || !form.name.trim() || !form.price} className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Image Upload Field ───

function ImageUploadField({ imageUrl, onChange, onUpload, uploading, uploadEndpoint }: {
  imageUrl: string; onChange: (url: string) => void; onUpload: (file: File) => void; uploading: boolean; uploadEndpoint?: string | null;
}) {
  return (
    <div>
      {imageUrl && (
        <div className="relative mb-2 rounded-xl overflow-hidden border border-white/10 h-32">
          {isVideo(imageUrl) ? (
            <video src={imageUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline />
          ) : (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          )}
          <button onClick={() => onChange("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {uploadEndpoint ? (
        <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs cursor-pointer hover:bg-white/5 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? (
            <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /><span className="text-slate-400">Subiendo...</span></>
          ) : (
            <><svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            <span className="text-slate-500">{imageUrl ? "Cambiar imagen" : "Subir imagen o video"}</span></>
          )}
          <input type="file" accept="image/*,video/mp4" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </label>
      ) : (
        <input value={imageUrl} onChange={(e) => onChange(e.target.value)} placeholder="URL de imagen (opcional)" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
      )}
    </div>
  );
}

function isVideo(url: string) {
  return /\.(mp4|mov|webm)/i.test(url);
}
