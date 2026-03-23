"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  badge: string | null;
  available: boolean;
  sortOrder: number;
};

type Category = {
  id: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
  items: MenuItem[];
};

export default function MenuManagementPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");

  // New category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");

  // New item form — which category
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemBadge, setItemBadge] = useState("");

  // Edit item
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editBadge, setEditBadge] = useState("");

  useEffect(() => {
    fetch("/api/restaurante/session")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setSlug(d.slug))
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  useEffect(() => {
    if (!slug) return;
    fetchMenu();
  }, [slug]);

  function fetchMenu() {
    fetch("/api/restaurante/menu")
      .then((r) => r.json())
      .then((d) => { setCategories(d); setLoading(false); });
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    await fetch("/api/restaurante/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName, emoji: newCatEmoji || null }),
    });
    setNewCatName("");
    setNewCatEmoji("");
    setShowNewCat(false);
    fetchMenu();
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("¿Eliminar esta categoría y todos sus items?")) return;
    await fetch(`/api/restaurante/menu?id=${id}`, { method: "DELETE" });
    fetchMenu();
  }

  async function handleAddItem() {
    if (!itemName.trim() || !itemPrice || !addingItemTo) return;
    await fetch("/api/restaurante/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: addingItemTo,
        name: itemName,
        description: itemDesc || null,
        price: Number(itemPrice),
        imageUrl: itemImage || null,
        badge: itemBadge || null,
      }),
    });
    setItemName(""); setItemDesc(""); setItemPrice(""); setItemImage(""); setItemBadge("");
    setAddingItemTo(null);
    fetchMenu();
  }

  async function handleUpdateItem() {
    if (!editingItem) return;
    await fetch("/api/restaurante/menu/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingItem.id,
        name: editName,
        description: editDesc || null,
        price: Number(editPrice),
        imageUrl: editImage || null,
        badge: editBadge || null,
      }),
    });
    setEditingItem(null);
    fetchMenu();
  }

  async function handleToggleAvailable(item: MenuItem) {
    await fetch("/api/restaurante/menu/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, available: !item.available }),
    });
    fetchMenu();
  }

  async function handleDeleteItem(id: string) {
    if (!confirm("¿Eliminar este item?")) return;
    await fetch(`/api/restaurante/menu/items?id=${id}`, { method: "DELETE" });
    fetchMenu();
  }

  function startEditItem(item: MenuItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditDesc(item.description || "");
    setEditPrice(String(item.price));
    setEditImage(item.imageUrl || "");
    setEditBadge(item.badge || "");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/5 glass-dark px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/restaurante")}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Menú</h1>
              <p className="text-sm text-slate-400">{categories.length} categorías · {totalItems} items</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewCat(true)}
            className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            + Categoría
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* New Category Form */}
        {showNewCat && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 animate-fade-in">
            <h3 className="text-sm font-bold text-white mb-3">Nueva Categoría</h3>
            <div className="flex gap-3">
              <input type="text" value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)}
                placeholder="🍔" className="w-16 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nombre de la categoría" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <button onClick={handleAddCategory}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
                Crear
              </button>
              <button onClick={() => setShowNewCat(false)}
                className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {categories.length === 0 && !showNewCat && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
            <div className="text-4xl mb-4">🍽️</div>
            <h3 className="text-lg font-bold text-white mb-2">Tu menú está vacío</h3>
            <p className="text-sm text-slate-500 mb-4">
              Empezá creando categorías (ej: Platos Principales, Bebidas) y después agregá los items.
            </p>
            <button onClick={() => setShowNewCat(true)}
              className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all">
              Crear mi primera categoría
            </button>
          </div>
        )}

        {/* Categories + Items */}
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <h2 className="text-sm font-bold text-white">
                {cat.emoji && <span className="mr-1.5">{cat.emoji}</span>}
                {cat.name}
                <span className="ml-2 text-xs font-normal text-slate-500">{cat.items.length} items</span>
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAddingItemTo(cat.id); setItemName(""); setItemDesc(""); setItemPrice(""); setItemImage(""); setItemBadge(""); }}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors">
                  + Item
                </button>
                <button onClick={() => handleDeleteCategory(cat.id)}
                  className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add Item Form */}
            {addingItemTo === cat.id && (
              <div className="border-b border-white/5 bg-primary/5 p-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
                    placeholder="Nombre del item *" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                  <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="Precio *" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                  <input type="text" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                    placeholder="Descripción (opcional)" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                  <input type="url" value={itemImage} onChange={(e) => setItemImage(e.target.value)}
                    placeholder="URL imagen (opcional)" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                  <input type="text" value={itemBadge} onChange={(e) => setItemBadge(e.target.value)}
                    placeholder="Badge: Popular, Nuevo... (opcional)" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddItem} disabled={!itemName.trim() || !itemPrice}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                    Agregar
                  </button>
                  <button onClick={() => setAddingItemTo(null)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Items list */}
            {cat.items.length > 0 ? (
              <div className="divide-y divide-white/5">
                {cat.items.map((item) => (
                  <div key={item.id} className={`flex items-center gap-4 px-5 py-3 ${!item.available ? "opacity-50" : ""}`}>
                    {/* Image */}
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-600 text-lg">🍽️</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{item.name}</span>
                        {item.badge && (
                          <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{item.badge}</span>
                        )}
                        {!item.available && (
                          <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">No disponible</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                      )}
                    </div>

                    {/* Price */}
                    <span className="text-sm font-bold text-white shrink-0">
                      ${item.price.toLocaleString("es-AR")}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggleAvailable(item)}
                        className={`rounded-lg p-1.5 transition-colors ${item.available ? "text-emerald-400 hover:bg-emerald-500/10" : "text-slate-600 hover:bg-white/5"}`}
                        title={item.available ? "Marcar no disponible" : "Marcar disponible"}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.available ? "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" : "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"} />
                        </svg>
                      </button>
                      <button onClick={() => startEditItem(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)}
                        className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-slate-600">Sin items. Hacé click en "+ Item" para agregar.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-4">Editar Item</h3>
            <div className="space-y-3">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Precio" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Descripción" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <input type="url" value={editImage} onChange={(e) => setEditImage(e.target.value)}
                placeholder="URL imagen" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
              <input type="text" value={editBadge} onChange={(e) => setEditBadge(e.target.value)}
                placeholder="Badge (Popular, Nuevo...)" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none" />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setEditingItem(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button onClick={handleUpdateItem}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
