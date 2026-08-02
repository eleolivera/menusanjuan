"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";
import { LocationPicker } from "@/components/LocationPicker";
import { CuisineMultiSelect } from "@/components/CuisineMultiSelect";
import { RestaurantQrCard } from "@/components/RestaurantQrCard";
import { MoneyInput } from "@/components/MoneyInput";
import { ScheduleEditor, ScheduleSummary } from "@/components/ScheduleEditor";
import { DeliveryZonesEditor, ZonesSummary } from "@/components/DeliveryZonesEditor";
import { ProfileSection, ProfileSectionFooter, SectionStatus } from "@/components/restaurante/ProfileSection";
import { useSmartSave } from "@/hooks/useSmartSave";
import { SaveIndicator } from "@/components/SaveIndicator";
import { resizeImageForUpload } from "@/lib/resize-image";

type Restaurant = {
  id: string; name: string; slug: string; phone: string; address: string | null;
  cuisineType: string; description: string | null; logoUrl: string | null; coverUrl: string | null;
  isActive: boolean; isVerified: boolean; claimedAt: string | null;
  ownerEmail: string; ownerName: string; isPlaceholder: boolean;
  sourceProfileId: string | null; sourceSite: string | null;
  openHours: string | null; mercadoPagoAlias: string | null; mercadoPagoCvu: string | null;
  rating: number | null; deliveryFee: number | null;
  deliveryEnabled: boolean; deliveryCloseRadius: number | null; deliveryClosePrice: number | null; deliveryFarRadius: number | null; deliveryFarPrice: number | null;
  categories: { id: string; name: string; emoji: string | null; items: { id: string; name: string; description: string | null; price: number; imageUrl: string | null; badge: string | null; available: boolean }[] }[];
  claimRequests: { id: string; status: string; code: string | null; requestedAt: string; user: { email: string; name: string } }[];
  orderCount: number;
  lastPassword: string | null;
};


export default function AdminRestaurantDetail() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const initialTab = (searchParams.get("tab") as "info" | "menu" | "claims" | "owner") || "info";
  const [data, setData] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [tab, setTab] = useState<"info" | "menu" | "claims" | "owner">(initialTab);

  // Autosave: same pattern as owner profile
  const [originalData, setOriginalData] = useState<Record<string, any>>({
    name: "",
    phone: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
    cuisineType: "",
    description: "",
    logoUrl: "",
    coverUrl: "",
    isActive: true,
    rating: null as number | null,
    deliveryFee: null as number | null,
    deliveryTimeMin: null as number | null,
    deliveryEnabled: true,
    pickupEnabled: true,
    pickupHours: null as string | null,
    deliveryHours: null as string | null,
    deliveryZones: null as string | null,
    deliveryFarRadius: null as number | null,
    mercadoPagoAlias: "",
    mercadoPagoCvu: "",
    bankInfo: "",
    posEnabled: false,
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
    isActive: { tier: "instant" as const },
    rating: { tier: "autosave" as const },
    deliveryFee: { tier: "autosave" as const },
    deliveryTimeMin: { tier: "autosave" as const },
    deliveryEnabled: { tier: "instant" as const },
    pickupEnabled: { tier: "instant" as const },
    // Tier 3 — explicit save (same pattern as owner profile). Click "Editar" to enter
    // edit mode, "Guardar" to commit, "Cancelar" to revert.
    pickupHours: { tier: "explicit" as const },
    deliveryHours: { tier: "explicit" as const },
    deliveryZones: { tier: "explicit" as const },
    deliveryFarRadius: { tier: "autosave" as const },
    mercadoPagoAlias: { tier: "autosave" as const },
    mercadoPagoCvu: { tier: "autosave" as const },
    bankInfo: { tier: "autosave" as const },
    posEnabled: { tier: "instant" as const },
  };

  const { values, setValue, flushField, saveFields, revertField, statuses } = useSmartSave(
    originalData,
    FIELD_CONFIG,
    { endpoint: `/api/admin/restaurants/${id}`, debounceMs: 1500 },
  );

  // Tier 3 sections — view/edit toggle per section (mirrors owner profile pattern)
  const [editingZones, setEditingZones] = useState(false);
  const [editingDeliveryHours, setEditingDeliveryHours] = useState(false);
  const [editingPickupHours, setEditingPickupHours] = useState(false);

  const isFieldDirty = (field: string): boolean =>
    JSON.stringify(values[field]) !== JSON.stringify(originalData[field]);
  const isFieldSaving = (field: string): boolean => statuses[field] === "saving";

  async function saveSection(field: string, exitEdit: () => void) {
    if (!isFieldDirty(field)) { exitEdit(); return; }
    await saveFields([field]);
    exitEdit();
  }
  function cancelSection(field: string, exitEdit: () => void) {
    revertField(field);
    exitEdit();
  }

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
  const isActive = values.isActive as boolean;
  const rating = values.rating as number | null;
  const deliveryFee = values.deliveryFee as number | null;
  const deliveryTimeMin = values.deliveryTimeMin as number | null;
  const deliveryEnabled = values.deliveryEnabled as boolean;
  const pickupEnabled = values.pickupEnabled as boolean;
  const pickupHoursJson = values.pickupHours as string | null;
  const deliveryHoursJson = values.deliveryHours as string | null;
  const deliveryZones = values.deliveryZones as string | null;
  const deliveryFarRadius = values.deliveryFarRadius as number | null;
  const mercadoPagoAlias = values.mercadoPagoAlias as string;
  const mercadoPagoCvu = values.mercadoPagoCvu as string;
  const bankInfo = values.bankInfo as string;
  const posEnabled = values.posEnabled as boolean;
  const deliveryMode: "zones" | "flat" = deliveryFee != null && deliveryFee > 0 ? "flat" : "zones";

  function switchDeliveryMode(next: "zones" | "flat") {
    if (next === "flat") {
      setValue("deliveryZones", null);
      setValue("deliveryFee", deliveryFee ?? 1500);
    } else {
      setValue("deliveryFee", null);
    }
  }

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<{ type: "logo" | "cover"; msg: string } | null>(null);

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
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [uploadingNewItemImage, setUploadingNewItemImage] = useState(false);

  // Edit item
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatEmoji, setEditCatEmoji] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");
  const [uploadingItemImage, setUploadingItemImage] = useState(false);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    const res = await fetch(`/api/admin/restaurants/${id}`);
    if (!res.ok) { router.push("/admin"); return; }
    const d = await res.json();
    setData(d);
    setOriginalData({
      name: d.name || "",
      phone: d.phone || "",
      address: d.address || "",
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      cuisineType: d.cuisineType || "",
      description: d.description || "",
      logoUrl: d.logoUrl || "",
      coverUrl: d.coverUrl || "",
      isActive: d.isActive,
      rating: d.rating ?? null,
      deliveryFee: d.deliveryFee ?? null,
      deliveryTimeMin: d.deliveryTimeMin ?? null,
      deliveryEnabled: d.deliveryEnabled !== false,
      pickupEnabled: (d as any).pickupEnabled !== false,
      pickupHours: (d as any).pickupHours || null,
      deliveryHours: (d as any).deliveryHours || null,
      deliveryZones: (d as any).deliveryZones || null,
      deliveryFarRadius: d.deliveryFarRadius ?? null,
      mercadoPagoAlias: (d as any).mercadoPagoAlias || "",
      mercadoPagoCvu: (d as any).mercadoPagoCvu || "",
      bankInfo: (d as any).bankInfo || "",
      posEnabled: (d as any).posEnabled || false,
    });
    setLoading(false);
  }

  async function handleImageUpload(rawFile: File, type: "logo" | "cover") {
    const setUploading = type === "logo" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    setUploadError(null);
    try {
      // Client-side resize before POST — logos are shown at ≤200 px and covers
      // top out around 1600 px wide. Skipping resize meant multi-MB phone JPEGs
      // silently 413'd against Vercel's 4.5 MB body limit and the old empty
      // catch made it look like the button just didn't work.
      let file: File = rawFile;
      if (rawFile.type.startsWith("image/")) {
        try {
          file = await resizeImageForUpload(rawFile, type === "logo"
            ? { maxWidth: 200, maxHeight: 200, quality: 0.9 }
            : { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });
        } catch (err) {
          setUploadError({ type, msg: `No pude procesar la imagen: ${err instanceof Error ? err.message : "error desconocido"}` });
          setUploading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      let res: Response;
      try {
        res = await fetch("/api/upload", { method: "POST", body: formData });
      } catch (err) {
        setUploadError({ type, msg: `Falló la conexión: ${err instanceof Error ? err.message : "sin respuesta"}` });
        setUploading(false);
        return;
      }

      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError({ type, msg: (d as { error?: string }).error || `Error ${res.status}` });
        setUploading(false);
        return;
      }
      // setValue with "instant" tier autosaves immediately
      setValue(type === "logo" ? "logoUrl" : "coverUrl", (d as { url: string }).url);
    } finally {
      setUploading(false);
    }
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
      body: JSON.stringify({ type: "item", categoryId, name: itemName, price: itemPrice, description: itemDesc, imageUrl: itemImageUrl || undefined }),
    });
    setItemName(""); setItemPrice(""); setItemDesc(""); setItemImageUrl(""); setAddingItemTo(null); fetchData();
  }

  async function handleSaveCategory(catId: string) {
    await fetch(`/api/admin/restaurants/${id}/menu`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", categoryId: catId, name: editCatName, emoji: editCatEmoji || null }),
    });
    setEditingCatId(null);
    fetchData();
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
            <button onClick={() => router.push("/admin")} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{data.name}</h1>
              <p className="text-xs text-slate-500">/{data.slug} · {data.orderCount} pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Guardado automático</span>
            <a href={`https://menusanjuan.com/${data.slug}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors">Ver pública</a>
            <button
              onClick={async () => {
                const res = await fetch("/api/admin/impersonate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dealerSlug: data.slug }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                  alert(`No pude entrar como dueño: ${body.error || "error"}`);
                  return;
                }
                window.location.href = body.redirectTo || "https://www.menusanjuan.com/restaurante";
              }}
              className="rounded-lg bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors"
              title="Abrir el panel del dueño (menú, pedidos, dashboard, clientes) como si fueras el dueño de este local"
            >
              👁️ Ver como dueño
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* QR + link to public page — for printing / sharing with the owner */}
        <RestaurantQrCard slug={data.slug} name={data.name} />

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
          <div className="space-y-6">
            {/* Cover + Logo (Facebook-style, click to edit) */}
            <div className="rounded-2xl border border-white/5 overflow-hidden">
              {/* Cover */}
              <label className="relative block h-40 cursor-pointer group">
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
                    {uploadingCover ? "Subiendo..." : "Cambiar portada"}
                  </div>
                </div>
                <input type="file" accept="image/*,video/mp4" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "cover"); e.target.value = ""; }} />
              </label>

              {/* Logo overlapping the cover */}
              <div className="relative px-4 pb-4 -mt-10">
                <div className="flex items-end gap-4">
                  <label className="relative group cursor-pointer">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-2xl font-bold shadow-lg border-4 border-slate-950 overflow-hidden">
                      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : name?.charAt(0) || "R"}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <svg className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo"); e.target.value = ""; }} />
                  </label>
                  <div className="pb-1">
                    <div className="text-lg font-bold text-white">{name || "Restaurante"}</div>
                    <div className="flex items-center gap-2">
                      {cuisineType && <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">{cuisineType}</span>}
                      {address && <span className="text-xs text-slate-500">{address}</span>}
                    </div>
                  </div>
                </div>
              </div>
              {uploadError && (
                <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-start justify-between gap-2">
                  <span>
                    <span className="font-semibold">
                      {uploadError.type === "logo" ? "Logo" : "Portada"}:
                    </span>{" "}
                    {uploadError.msg}
                  </span>
                  <button
                    onClick={() => setUploadError(null)}
                    className="text-red-300/70 hover:text-red-200 shrink-0"
                    aria-label="Descartar error"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Admin-only quick controls */}
            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-amber-200">🔧 Controles de admin</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center justify-between rounded-xl border-2 p-3 cursor-pointer transition-colors ${
                  isActive ? "border-emerald-400/40 bg-emerald-400/5" : "border-red-500/40 bg-red-500/5"
                }`}>
                  <div>
                    <div className="text-xs font-bold text-white">Activo (visible al público)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{isActive ? "Aparece en /explorar y se puede pedir" : "Oculto del público"}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setValue("isActive", e.target.checked)}
                    className="h-5 w-9 appearance-none rounded-full bg-slate-700 transition-colors checked:bg-emerald-500 relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
                  />
                </label>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <label className="text-xs font-bold text-white block mb-1.5">Rating (1-5 ★)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max="5" step="0.1"
                      value={rating ?? ""}
                      onChange={e => setValue("rating", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={() => flushField("rating")}
                      placeholder="4.5"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                    {rating != null && <div className="flex items-center gap-0.5 shrink-0">{[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= Math.round(rating)  ? "text-amber-400" : "text-slate-700"}`}>★</span>)}</div>}
                    <SaveIndicator status={statuses.rating} />
                  </div>
                </div>
              </div>
            </section>

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
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Email del dueño (solo lectura)</label>
                  <input type="email" value={data.ownerEmail} disabled
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
                  <textarea value={description} onChange={(e) => setValue("description", e.target.value)} onBlur={() => flushField("description")} rows={3} placeholder="Contá qué hace especial a este restaurante..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
                </div>
              </div>
            </section>

            {/* Address + Map */}
            <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">Ubicación</h2>
                {!showMap && (
                  <button
                    onClick={() => setShowMap(true)}
                    className="text-xs font-medium text-primary hover:underline transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>
              {!showMap ? (
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <div>
                    <div className="text-sm text-slate-300">{address || "Sin dirección — hacé click en Editar"}</div>
                    {latitude && longitude && (
                      <div className="text-[10px] text-emerald-400 mt-0.5">📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}</div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <LocationPicker
                    initialAddress={address}
                    initialLat={latitude}
                    initialLng={longitude}
                    onLocationConfirm={(addr, lat, lng) => {
                      setValue("address", addr);
                      setValue("latitude", lat);
                      setValue("longitude", lng);
                      flushField("address");
                      flushField("latitude");
                      flushField("longitude");
                      setShowMap(false);
                    }}
                  />
                  <button
                    onClick={() => setShowMap(false)}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </section>

            {/* Servicios disponibles */}
            <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
              <h2 className="text-sm font-bold text-white mb-1">Servicios que ofrece</h2>
              <p className="text-xs text-slate-400 mb-4">
                Activá / desactivá según querés que el cliente pueda pedir delivery o retiro. Es independiente del horario.
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
                    <div className="text-[11px] text-slate-400 mt-0.5">Cliente lo busca en el local</div>
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
                  ⚠️ Ambos servicios apagados. El cliente no puede hacer pedidos.
                </div>
              )}
            </section>

            {/* Delivery Zones */}
            <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Zonas de Delivery</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    La distancia se mide desde <span className="text-primary font-medium">la dirección de arriba</span> hasta la del cliente
                  </p>
                </div>
              </div>

              {(!latitude || !longitude) && deliveryMode === "zones" && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  ⚠️ Necesitás cargar la ubicación arriba para que el cálculo de delivery funcione.
                </div>
              )}

              {deliveryEnabled && (
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

            {/* Horarios por método — Tier 3 explicit save (same pattern as owner profile) */}
            <ProfileSection
              title="Horarios de Delivery"
              subtitle={editingDeliveryHours
                ? "Editá los horarios. Los cambios se guardan al tocar \"Guardar horarios\"."
                : "Cuándo este restaurante hace delivery."}
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
                    value={deliveryHoursJson}
                    onChange={(v) => setValue("deliveryHours", v)}
                    copyFromLabel="Retiro"
                    onCopyFromOther={() => { if (pickupHoursJson) setValue("deliveryHours", pickupHoursJson); }}
                  />
                ) : (
                  <ScheduleSummary value={deliveryHoursJson} emoji="🛵" />
                )}
              </div>
            </ProfileSection>

            <ProfileSection
              title="Horarios de Retiro en local"
              subtitle={editingPickupHours
                ? "Editá los horarios. Los cambios se guardan al tocar \"Guardar horarios\"."
                : "Cuándo este restaurante acepta retiros."}
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
                    value={pickupHoursJson}
                    onChange={(v) => setValue("pickupHours", v)}
                    copyFromLabel="Delivery"
                    onCopyFromOther={() => { if (deliveryHoursJson) setValue("pickupHours", deliveryHoursJson); }}
                  />
                ) : (
                  <ScheduleSummary value={pickupHoursJson} emoji="🏪" />
                )}
              </div>
            </ProfileSection>

            {/* Métodos de Pago */}
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
            <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-lg">$</div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-white">POS — Pedidos en el local</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Tablet / celular para mesas y mostrador. Pedidos a cocina con el pago ya cobrado.</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/50 border border-white/5 p-3 mb-4 space-y-2">
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>Cobra en efectivo, tarjeta, transferencia o Mercado Pago</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>Calculadora de vuelto automática para efectivo</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>Pedidos por mesa o mostrador en el mismo Kanban de cocina</span>
                </div>
              </div>

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
                    {statuses.posEnabled === "saving" ? "Guardando..." : statuses.posEnabled === "saved" ? "Guardado ✓" : posEnabled ? "Aparece en el menú lateral del dueño" : "Click para activar"}
                  </p>
                </div>
              </button>
            </section>
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
                  {editingCatId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input value={editCatEmoji} onChange={e => setEditCatEmoji(e.target.value)} className="w-10 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-center text-sm text-white focus:border-primary focus:outline-none" />
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white focus:border-primary focus:outline-none" />
                      <button onClick={() => handleSaveCategory(cat.id)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white">Guardar</button>
                      <button onClick={() => setEditingCatId(null)} className="text-xs text-slate-500">Cancelar</button>
                    </div>
                  ) : (
                    <h3 className="text-sm font-bold text-white cursor-pointer hover:text-primary transition-colors" onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatEmoji(cat.emoji || ""); }}>
                      {cat.emoji} {cat.name} <span className="font-normal text-slate-500">({cat.items.length})</span>
                      <span className="ml-1.5 text-slate-600 text-[10px]">✏️</span>
                    </h3>
                  )}
                  <div className="flex gap-2 shrink-0 ml-2">
                    <button onClick={() => { setAddingItemTo(cat.id); setItemName(""); setItemPrice(""); setItemDesc(""); }} className="rounded-lg bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10 transition-colors">+ Item</button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="rounded-lg p-1 text-slate-600 hover:text-red-400 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>

                {addingItemTo === cat.id && (
                  <div className="border-b border-white/5 bg-primary/5 p-3 space-y-2">
                    <div className="flex gap-2">
                      <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Nombre *" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none" />
                      <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="Precio *" type="number" className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Descripción (opcional)" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none" />
                      {itemImageUrl ? (
                        <div className="flex items-center gap-1.5">
                          <img src={itemImageUrl} alt="" className="h-7 w-7 rounded object-cover" />
                          <button onClick={() => setItemImageUrl("")} className="text-xs text-slate-500 hover:text-red-400">✕</button>
                        </div>
                      ) : (
                        <label className={`shrink-0 flex items-center gap-1 rounded-lg border border-dashed border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 cursor-pointer hover:bg-white/10 transition-colors ${uploadingNewItemImage ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingNewItemImage ? <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" /> : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>}
                          Imagen
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const f = e.target.files?.[0]; if (!f) return;
                            setUploadingNewItemImage(true);
                            try {
                              const formData = new FormData();
                              formData.append("file", f);
                              formData.append("type", "menu-item");
                              const res = await fetch("/api/upload", { method: "POST", body: formData });
                              const d = await res.json();
                              if (res.ok) setItemImageUrl(d.url);
                            } catch {}
                            setUploadingNewItemImage(false);
                            e.target.value = "";
                          }} />
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAddItem(cat.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">Agregar</button>
                      <button onClick={() => { setAddingItemTo(null); setItemImageUrl(""); }} className="text-xs text-slate-500">Cancelar</button>
                    </div>
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
                        <a href={`https://menusanjuan.com/${activatedCreds.slug}`} target="_blank" className="text-sm text-primary hover:underline">menusanjuan.com/{activatedCreds.slug}</a>
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

                {/* Already verified but no creds in memory — show stored password */}
                {data.isVerified && !activatedCreds && (
                  <div className="rounded-xl bg-slate-900 border border-white/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Email</span>
                      <span className="text-sm font-mono text-white">{data.ownerEmail}</span>
                    </div>
                    {data.lastPassword ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Contraseña</span>
                        <span className="text-sm font-mono text-primary font-bold">{data.lastPassword}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Contraseña</span>
                        <button
                          onClick={async () => {
                            setActivating(true);
                            await fetch(`/api/admin/restaurants/${id}/activate-owner`, { method: "DELETE" });
                            await handleToggleOwner(true);
                          }}
                          disabled={activating}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          {activating ? "Generando..." : "Generar nueva"}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Login</span>
                      <span className="text-sm text-slate-300">menusanjuan.com/restaurante/login</span>
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
                <label className="block text-xs text-slate-400 mb-1">Imagen</label>
                {/* Preview */}
                {editImage && (
                  <div className="relative mb-2 rounded-xl overflow-hidden border border-white/10 h-32">
                    {editImage.toLowerCase().includes(".mp4") || editImage.toLowerCase().includes(".mov") || editImage.toLowerCase().includes(".webm") ? (
                      <video src={editImage} className="h-full w-full object-cover" autoPlay loop muted playsInline />
                    ) : (
                      <img src={editImage} alt="" className="h-full w-full object-cover" />
                    )}
                    <button onClick={() => setEditImage("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                {/* Upload button */}
                <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm cursor-pointer hover:bg-white/10 transition-colors ${uploadingItemImage ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingItemImage ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> <span className="text-slate-400">Subiendo...</span></>
                  ) : (
                    <><svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    <span className="text-slate-400">{editImage ? "Cambiar imagen" : "Subir imagen"}</span></>
                  )}
                  <input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setUploadingItemImage(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", f);
                      formData.append("type", "menu-item");
                      const res = await fetch("/api/upload", { method: "POST", body: formData });
                      const d = await res.json();
                      if (res.ok) setEditImage(d.url);
                    } catch {}
                    setUploadingItemImage(false);
                    e.target.value = "";
                  }} />
                </label>
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

