"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───

type OnboardingStage = "NEEDS_INFO" | "READY" | "QUEUED" | "IN_PROGRESS" | "ONBOARDED";

type Completeness = {
  hasLogo: boolean;
  hasCover: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasMenu: boolean;
  score: number;
  total: number;
};

type Note = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type Card = {
  id: string;
  dealerId: string;
  stage: OnboardingStage;
  sortOrder: number;
  stageChangedAt: string;
  lastContactedAt: string | null;
  dealer: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    address: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    isActive: boolean;
    isVerified: boolean;
    isPlaceholder: boolean;
    ownerEmail: string;
    ownerPhone: string | null;
    categoryCount: number;
    itemCount: number;
    orderCount: number;
  };
  completeness: Completeness;
  notes: Note[];
};

// ─── Column definitions ───

const STAGES: { key: OnboardingStage; label: string; color: string; bgColor: string; description: string }[] = [
  { key: "NEEDS_INFO", label: "Falta info", color: "text-amber-400", bgColor: "bg-amber-400/10 border-amber-400/20", description: "Faltan fotos, dirección, WhatsApp o menú" },
  { key: "READY", label: "Listo", color: "text-blue-400", bgColor: "bg-blue-400/10 border-blue-400/20", description: "Info completa, listo para contactar al dueño" },
  { key: "QUEUED", label: "Cola de contacto", color: "text-purple-400", bgColor: "bg-purple-400/10 border-purple-400/20", description: "En cola para enviar mensaje / activar cuenta" },
  { key: "IN_PROGRESS", label: "En charla", color: "text-cyan-400", bgColor: "bg-cyan-400/10 border-cyan-400/20", description: "Ya contactamos, en conversación" },
  { key: "ONBOARDED", label: "Onboardeado", color: "text-emerald-400", bgColor: "bg-emerald-400/10 border-emerald-400/20", description: "Activo y verificado" },
];

// ─── Helpers ───

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function completenessIcons(c: Completeness) {
  const items: { label: string; ok: boolean; icon: string }[] = [
    { label: "Logo", ok: c.hasLogo, icon: "🖼️" },
    { label: "Portada", ok: c.hasCover, icon: "📸" },
    { label: "Dirección", ok: c.hasAddress, icon: "📍" },
    { label: "WhatsApp", ok: c.hasPhone, icon: "📱" },
    { label: "Menú", ok: c.hasMenu, icon: "🍽️" },
  ];
  return items;
}

// ─── Main Board ───

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function OnboardingBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [dragCard, setDragCard] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<OnboardingStage | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchCards = useCallback(async () => {
    const res = await fetch("/api/admin/onboarding");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      boardRef.current?.requestFullscreen();
    }
  }

  // ─── Drag and drop ───

  function handleDragStart(cardId: string) {
    setDragCard(cardId);
  }

  function handleDragOver(e: React.DragEvent, stage: OnboardingStage) {
    e.preventDefault();
    setDragOverStage(stage);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  async function handleDrop(stage: OnboardingStage) {
    setDragOverStage(null);
    if (!dragCard) return;
    const card = cards.find((c) => c.id === dragCard);
    if (!card || card.stage === stage) { setDragCard(null); return; }

    // Optimistic update
    setCards((prev) => prev.map((c) => c.id === dragCard ? { ...c, stage } : c));
    setDragCard(null);

    await fetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: dragCard, stage }),
    });
  }

  // ─── Notes ───

  async function addNote(cardId: string, text?: string | null, imageUrl?: string | null) {
    if (!text && !imageUrl) return;
    setSavingNote(true);
    const res = await fetch("/api/admin/onboarding/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, text, imageUrl }),
    });
    if (res.ok) {
      const note = await res.json();
      setCards((prev) =>
        prev.map((c) => c.id === cardId ? { ...c, notes: [note, ...c.notes] } : c)
      );
      setNoteText("");
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string, cardId: string) {
    setCards((prev) =>
      prev.map((c) => c.id === cardId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c)
    );
    await fetch(`/api/admin/onboarding/notes?noteId=${noteId}`, { method: "DELETE" });
  }

  // ─── Image paste/upload ───

  async function handlePaste(e: React.ClipboardEvent, cardId: string) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setUploadingImage(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "onboarding");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { url } = await res.json();
          await addNote(cardId, null, url);
        }
        setUploadingImage(false);
        return;
      }
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, cardId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "onboarding");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      await addNote(cardId, null, url);
    }
    setUploadingImage(false);
    e.target.value = "";
  }

  // ─── Activate owner + move to En charla ───

  const [activatingCard, setActivatingCard] = useState<string | null>(null);
  const [cardCreds, setCardCreds] = useState<Record<string, { email: string; password: string }>>({});
  const [whatsappMsg, setWhatsappMsg] = useState<{ cardId: string; msg: string; phone: string } | null>(null);

  async function activateAndMove(card: Card) {
    setActivatingCard(card.id);
    const res = await fetch(`/api/admin/restaurants/${card.dealer.id}/activate-owner`, { method: "POST" });
    if (res.ok) {
      const creds = await res.json();
      setCardCreds((prev) => ({ ...prev, [card.id]: { email: creds.email, password: creds.password } }));
      // Move to EN_CHARLA
      setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, stage: "IN_PROGRESS" as OnboardingStage } : c));
      await fetch("/api/admin/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, stage: "IN_PROGRESS" }),
      });
    }
    setActivatingCard(null);
  }

  function buildWhatsAppMsg(card: Card) {
    const creds = cardCreds[card.id];
    const d = card.dealer;
    if (creds) {
      return `Hola! 👋 Soy de MenuSanJuan.com

Noté que *${d.name}* no tiene su propia página de pedidos online todavía.

Te creamos una gratis — ya tiene tu menú cargado con precios e imágenes. Tus clientes pueden ver el menú y hacer pedidos por WhatsApp.

Es 100% gratis, sin comisiones.

🍽️ Tu página: menusanjuan.com/${d.slug}

Para editar tu menú, horarios, y ver pedidos:
🔗 menusanjuan.com/restaurante/login
📧 ${creds.email}
🔑 ${creds.password}

Probalo y decime qué te parece!`;
    }
    return `Hola! 👋 Soy de MenuSanJuan.com

Noté que *${d.name}* no tiene su propia página de pedidos online todavía.

Te creamos una gratis — ya tiene tu menú cargado con precios e imágenes. Tus clientes pueden ver el menú y hacer pedidos por WhatsApp.

Es 100% gratis, sin comisiones.

🍽️ Tu página: menusanjuan.com/${d.slug}

Probalo y decime qué te parece!`;
  }

  function openWhatsApp(card: Card) {
    const phone = card.dealer.phone.replace(/\D/g, "");
    const msg = buildWhatsAppMsg(card);
    setWhatsappMsg({ cardId: card.id, msg, phone });
  }

  function sendWhatsApp() {
    if (!whatsappMsg) return;
    const url = `https://wa.me/${whatsappMsg.phone}?text=${encodeURIComponent(whatsappMsg.msg)}`;
    window.open(url, "_blank");
    // Auto-update lastContactedAt
    fetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: whatsappMsg.cardId, lastContactedAt: true }),
    });
    setCards((prev) =>
      prev.map((c) => c.id === whatsappMsg.cardId ? { ...c, lastContactedAt: new Date().toISOString() } : c)
    );
    setWhatsappMsg(null);
  }

  // ─── Filter ───

  const filtered = search
    ? cards.filter((c) => normalize(c.dealer.name).includes(normalize(search)) || normalize(c.dealer.slug).includes(normalize(search)))
    : cards;

  const visibleStages = hideCompleted
    ? STAGES.filter((s) => s.key !== "NEEDS_INFO" && s.key !== "READY")
    : STAGES;

  // ─── Loading ───

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((s) => (
          <div key={s.key} className="min-w-[280px] flex-1 rounded-2xl border border-white/5 bg-slate-900/30 p-3">
            <div className="h-6 w-32 rounded bg-white/5 animate-pulse mb-3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse mb-2" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={boardRef} className={isFullscreen ? "bg-slate-950 p-4 h-screen overflow-hidden" : ""}>
      {/* Search bar */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar restaurante..."
          className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => setHideCompleted(!hideCompleted)}
          className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all border ${hideCompleted ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 text-slate-400 hover:bg-white/5"}`}
        >
          {hideCompleted ? "Solo outreach" : "Todas las columnas"}
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
          <span>{cards.length} restaurantes</span>
          <span>·</span>
          <span>{cards.filter((c) => c.stage === "ONBOARDED").length} onboardeados</span>
          <button
            onClick={toggleFullscreen}
            className="ml-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/10 transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? "✕ Salir" : "⛶ Full"}
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: isFullscreen ? "calc(100vh - 80px)" : "calc(100vh - 240px)" }}>
        {visibleStages.map((stage) => {
          const columnCards = filtered
            .filter((c) => c.stage === stage.key)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.dealer.name.localeCompare(b.dealer.name));

          return (
            <div
              key={stage.key}
              className={`min-w-[280px] flex-1 rounded-2xl border p-3 transition-colors ${
                dragOverStage === stage.key
                  ? "border-primary/50 bg-primary/5"
                  : "border-white/5 bg-slate-900/30"
              }`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(stage.key)}
            >
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${stage.color}`}>{stage.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${stage.bgColor} ${stage.color}`}>
                    {columnCards.length}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mb-3 leading-relaxed">{stage.description}</p>

              {/* Cards */}
              <div className={`space-y-2 overflow-y-auto pr-1 ${isFullscreen ? "max-h-[calc(100vh-160px)]" : "max-h-[calc(100vh-300px)]"}`}>
                {columnCards.map((card) => (
                  <KanbanCardView
                    key={card.id}
                    card={card}
                    expanded={expandedCard === card.id}
                    onToggleExpand={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    onDragStart={() => handleDragStart(card.id)}
                    noteText={expandedCard === card.id ? noteText : ""}
                    onNoteTextChange={setNoteText}
                    onAddNote={(text) => addNote(card.id, text)}
                    onDeleteNote={(noteId) => deleteNote(noteId, card.id)}
                    onPaste={(e) => handlePaste(e, card.id)}
                    onImageUpload={(e) => handleImageUpload(e, card.id)}
                    onActivate={() => activateAndMove(card)}
                    onWhatsApp={() => openWhatsApp(card)}
                    activating={activatingCard === card.id}
                    creds={cardCreds[card.id]}
                    savingNote={savingNote}
                    uploadingImage={uploadingImage}
                  />
                ))}
                {columnCards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
                    <p className="text-xs text-slate-600">Sin restaurantes</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* WhatsApp message preview/edit modal */}
      {whatsappMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWhatsappMsg(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Mensaje de WhatsApp</h3>
              <button onClick={() => setWhatsappMsg(null)} className="text-slate-500 hover:text-white text-lg">✕</button>
            </div>
            <textarea
              value={whatsappMsg.msg}
              onChange={(e) => setWhatsappMsg({ ...whatsappMsg, msg: e.target.value })}
              rows={14}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none resize-none font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-slate-500">Editá el mensaje antes de enviar</span>
              <div className="flex gap-2">
                <button onClick={() => setWhatsappMsg(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button onClick={sendWhatsApp} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors">
                  Enviar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card Component ───

function KanbanCardView({
  card,
  expanded,
  onToggleExpand,
  onDragStart,
  noteText,
  onNoteTextChange,
  onAddNote,
  onDeleteNote,
  onPaste,
  onImageUpload,
  onActivate,
  onWhatsApp,
  activating,
  creds,
  savingNote,
  uploadingImage,
}: {
  card: Card;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: () => void;
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onAddNote: (text: string) => void;
  onDeleteNote: (noteId: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onActivate: () => void;
  onWhatsApp: () => void;
  activating: boolean;
  creds?: { email: string; password: string };
  savingNote: boolean;
  uploadingImage: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const d = card.dealer;
  const comp = card.completeness;
  const icons = completenessIcons(comp);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className="rounded-xl border border-white/5 bg-slate-800/50 p-3 hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing"
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        {d.logoUrl ? (
          <img src={d.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
            <span className="text-xs">🍽️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <a href={`/admin/restaurants/${d.id}`} target="_blank" className="text-sm font-semibold text-white truncate hover:text-primary transition-colors block">{d.name}</a>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-500">{d.slug}</span>
            {d.isPlaceholder && (
              <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1 rounded">sin dueño</span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(card.stageChangedAt)}</span>
      </div>

      {/* Completeness */}
      <div className="flex gap-1 mb-2">
        {icons.map((item) => (
          <span
            key={item.label}
            title={`${item.label}: ${item.ok ? "OK" : "Falta"}`}
            className={`text-[11px] rounded px-1 py-0.5 ${
              item.ok ? "bg-emerald-400/10 opacity-60" : "bg-red-400/10"
            }`}
          >
            {item.icon}
          </span>
        ))}
        <span className="text-[10px] text-slate-500 ml-auto">{comp.score}/{comp.total}</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
        <span>{d.categoryCount} cat</span>
        <span>·</span>
        <span>{d.itemCount} items</span>
        <span>·</span>
        <span>{d.orderCount} pedidos</span>
      </div>

      {/* Stage-specific action buttons */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {card.stage === "NEEDS_INFO" && (
          <>
            <a href={`/admin/restaurants/${d.id}`} target="_blank" className="rounded-lg bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-400/20 transition-colors">
              Editar info
            </a>
            <a href={`/${d.slug}`} target="_blank" className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
              Ver página
            </a>
            <a href={`/admin/restaurants/${d.id}#menu`} target="_blank" className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
              Ver menú
            </a>
          </>
        )}
        {card.stage === "READY" && (
          <>
            <a href={`/${d.slug}`} target="_blank" className="rounded-lg bg-blue-400/10 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-400/20 transition-colors">
              Ver página
            </a>
            <a href={`/admin/restaurants/${d.id}`} target="_blank" className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
              Revisar
            </a>
          </>
        )}
        {card.stage === "QUEUED" && (
          <>
            <button onClick={onActivate} disabled={activating} className="rounded-lg bg-purple-400/10 px-2 py-1 text-[10px] font-medium text-purple-400 hover:bg-purple-400/20 disabled:opacity-50 transition-colors">
              {activating ? "Activando..." : "Activar cuenta"}
            </button>
            {creds ? (
              <div className="w-full mt-1 rounded-lg bg-emerald-400/10 border border-emerald-400/20 p-2 space-y-0.5">
                <p className="text-[10px] text-emerald-400 font-bold">Cuenta activada — moviendo a En charla...</p>
                <p className="text-[10px] text-slate-300">📧 {creds.email}</p>
                <p className="text-[10px] text-slate-300">🔑 {creds.password}</p>
              </div>
            ) : (
              <span className="text-[10px] text-slate-600 py-1">{d.ownerEmail}</span>
            )}
          </>
        )}
        {card.stage === "IN_PROGRESS" && (
          <>
            {d.phone && d.phone !== "0000000000" && (
              <button onClick={onWhatsApp} className="rounded-lg bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-400/20 transition-colors">
                WhatsApp
              </button>
            )}
            {creds && (
              <div className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 p-2 space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">Credenciales:</p>
                <p className="text-[10px] text-slate-300">📧 {creds.email}</p>
                <p className="text-[10px] text-slate-300">🔑 {creds.password}</p>
              </div>
            )}
            {card.lastContactedAt && (
              <span className="text-[10px] text-slate-600 py-1">Último contacto: {timeAgo(card.lastContactedAt)}</span>
            )}
          </>
        )}
        {card.stage === "ONBOARDED" && (
          <>
            <a href={`/${d.slug}`} target="_blank" className="rounded-lg bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-400/20 transition-colors">
              Ver página
            </a>
            <span className="text-[10px] py-1">
              {d.isActive ? <span className="text-emerald-400">Activo</span> : <span className="text-red-400">Inactivo</span>}
              {d.isVerified && <span className="text-blue-400 ml-1">✓</span>}
            </span>
          </>
        )}
      </div>

      {/* Expand toggle for notes */}
      <button
        onClick={onToggleExpand}
        className="w-full mt-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-500 hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
      >
        <span>Notas ({card.notes.length})</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Notes panel */}
      {expanded && (
        <div className="mt-2 border-t border-white/5 pt-2">
          {/* Add note */}
          <div className="flex gap-1.5 mb-2">
            <textarea
              value={noteText}
              onChange={(e) => onNoteTextChange(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onAddNote(noteText);
                }
              }}
              placeholder="Escribir nota... (Ctrl+Enter para guardar, pegar imagen)"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white placeholder:text-slate-600 focus:border-primary focus:outline-none resize-none"
              rows={2}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onAddNote(noteText)}
                disabled={savingNote || !noteText.trim()}
                className="rounded-lg bg-primary/20 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/30 disabled:opacity-30 transition-colors"
              >
                {savingNote ? "..." : "💾"}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                {uploadingImage ? "..." : "📎"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Existing notes */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {card.notes.map((note) => (
              <div key={note.id} className="group rounded-lg bg-white/5 p-2 relative">
                {note.text && <p className="text-[11px] text-slate-300 whitespace-pre-wrap break-words">{note.text}</p>}
                {note.imageUrl && (
                  <a href={note.imageUrl} target="_blank" rel="noopener">
                    <img src={note.imageUrl} alt="" className="mt-1 max-h-32 rounded-lg object-cover" />
                  </a>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-slate-600">{new Date(note.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="text-[9px] text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
            {card.notes.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center py-2">Sin notas todavía</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
