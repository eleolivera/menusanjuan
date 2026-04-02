"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RestaurantModal } from "@/components/RestaurantModal";
import { ONBOARDING_STAGES, type OnboardingStage } from "@/lib/admin-config";
import { timeAgo, normalize, formatARS, buildOnboardingWhatsAppMsg } from "@/lib/admin-utils";

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
  lastPassword: string | null;
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

const STAGES = ONBOARDING_STAGES;

function completenessIcons(c: Completeness) {
  return [
    { label: "Logo", ok: c.hasLogo, icon: "L" },
    { label: "Portada", ok: c.hasCover, icon: "P" },
    { label: "Direccion", ok: c.hasAddress, icon: "D" },
    { label: "WhatsApp", ok: c.hasPhone, icon: "W" },
    { label: "Menu", ok: c.hasMenu, icon: "M" },
  ];
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
  const [modalRestaurantId, setModalRestaurantId] = useState<string | null>(null);
  const [modalKanbanStage, setModalKanbanStage] = useState<OnboardingStage | null>(null);

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

    // Auto-activate when moving to EN_CHARLA or ONBOARDED
    if ((stage === "IN_PROGRESS" || stage === "ONBOARDED") && !card.dealer.isVerified) {
      const dealerUrl = `/api/admin/restaurants/${card.dealer.id}/activate-owner`;
      let res = await fetch(dealerUrl, { method: "POST" });
      if (!res.ok) {
        // Already activated — deactivate + reactivate for fresh code
        await fetch(dealerUrl, { method: "DELETE" });
        res = await fetch(dealerUrl, { method: "POST" });
      }
      if (res.ok) {
        const creds = await res.json();
        setCardCreds((prev) => ({ ...prev, [card.id]: { email: creds.email, password: creds.code } }));
      }
    }

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
    const dealerUrl = `/api/admin/restaurants/${card.dealer.id}/activate-owner`;
    // Try to activate
    let res = await fetch(dealerUrl, { method: "POST" });
    if (!res.ok) {
      // Already activated — deactivate first, then reactivate to get fresh creds
      await fetch(dealerUrl, { method: "DELETE" });
      res = await fetch(dealerUrl, { method: "POST" });
    }
    if (res.ok) {
      const creds = await res.json();
      setCardCreds((prev) => ({ ...prev, [card.id]: { email: creds.email, password: creds.code } }));
      // Save creds as a note for future reference
      const credsNote = `Codigo generado:\nEmail: ${creds.email}\nCodigo: ${creds.code}`;
      fetch("/api/admin/onboarding/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, text: credsNote }),
      }).then(r => r.ok ? r.json() : null).then(note => {
        if (note) setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, notes: [note, ...c.notes] } : c));
      });
    }
    // Move to EN_CHARLA
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, stage: "IN_PROGRESS" as OnboardingStage } : c));
    await fetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, stage: "IN_PROGRESS" }),
    });
    setActivatingCard(null);
  }

  function buildWhatsAppMsg(card: Card) {
    const creds = cardCreds[card.id];
    const code = creds?.password || card.lastPassword || null;
    return buildOnboardingWhatsAppMsg(card.dealer, code);
  }

  async function resetCode(card: Card) {
    setActivatingCard(card.id);
    const res = await fetch(`/api/admin/restaurants/${card.dealer.id}/reset-code`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCardCreds((prev) => ({ ...prev, [card.id]: { email: data.email, password: data.code } }));
    }
    setActivatingCard(null);
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
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div className="mb-2 flex items-center gap-3 shrink-0">
          <div className="h-10 w-64 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-10 w-28 rounded-xl bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-3 flex-1" style={{ minHeight: 0 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 rounded-2xl border border-white/5 bg-slate-900/30 p-3 flex flex-col">
              <div className="h-5 w-28 rounded bg-white/5 animate-pulse mb-3" />
              <div className="space-y-2 flex-1">
                {Array.from({ length: 3 + i }, (_, j) => (
                  <div key={j} className="h-28 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={boardRef} className={`flex flex-col ${isFullscreen ? "bg-slate-950 p-4 h-screen overflow-hidden" : "flex-1"}`} style={{ minHeight: 0 }}>
      {/* Search bar */}
      <div className="mb-2 flex items-center gap-3 shrink-0">
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
      <div className="flex gap-3 overflow-x-auto flex-1" style={{ minHeight: 0 }}>
        {visibleStages.map((stage) => {
          const columnCards = filtered
            .filter((c) => c.stage === stage.key)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.dealer.name.localeCompare(b.dealer.name));

          return (
            <div
              key={stage.key}
              className={`min-w-[280px] flex-1 rounded-2xl border p-3 transition-colors flex flex-col ${
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
              <div className="space-y-2 overflow-y-auto pr-1 flex-1" style={{ minHeight: 0 }}>
                {columnCards.map((card) => (
                  <KanbanCardView
                    key={card.id}
                    card={card}
                    expanded={expandedCard === card.id}
                    onCardClick={() => { setModalRestaurantId(card.dealer.id); setModalKanbanStage(card.stage); }}
                    onToggleExpand={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    onDragStart={() => handleDragStart(card.id)}
                    noteText={expandedCard === card.id ? noteText : ""}
                    onNoteTextChange={setNoteText}
                    onAddNote={(text) => addNote(card.id, text)}
                    onDeleteNote={(noteId) => deleteNote(noteId, card.id)}
                    onPaste={(e) => handlePaste(e, card.id)}
                    onImageUpload={(e) => handleImageUpload(e, card.id)}
                    onActivate={() => activateAndMove(card)}
                    onResetCode={() => resetCode(card)}
                    onWhatsApp={() => openWhatsApp(card)}
                    activating={activatingCard === card.id}
                    creds={cardCreds[card.id] || (card.lastPassword ? { email: card.dealer.ownerEmail, password: card.lastPassword } : undefined)}
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
              <div>
                <h3 className="text-sm font-bold text-white">Mensaje de WhatsApp</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Para: +{whatsappMsg.phone}</p>
              </div>
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

      {/* Restaurant detail modal */}
      {modalRestaurantId && (
        <RestaurantModal
          restaurantId={modalRestaurantId}
          kanbanStage={modalKanbanStage || undefined}
          onClose={() => { setModalRestaurantId(null); setModalKanbanStage(null); fetchCards(); }}
          onStageChange={async (stage) => {
            const card = cards.find((c) => c.dealer.id === modalRestaurantId);
            if (!card) return;
            setCards((prev) => prev.map((c) => c.dealer.id === modalRestaurantId ? { ...c, stage } : c));
            setModalKanbanStage(stage);
            await fetch("/api/admin/onboarding", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardId: card.id, stage }),
            });
          }}
        />
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
  onResetCode,
  onWhatsApp,
  onCardClick,
  activating,
  creds,
  savingNote,
  uploadingImage,
}: {
  card: Card;
  expanded: boolean;
  onCardClick: () => void;
  onToggleExpand: () => void;
  onDragStart: () => void;
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onAddNote: (text: string) => void;
  onDeleteNote: (noteId: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onActivate: () => void;
  onResetCode: () => void;
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

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      draggable
      onMouseDown={(e) => { dragStartPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        if (!dragStartPos.current) return;
        // Don't open modal when clicking buttons, links, inputs, or textareas
        const tag = (e.target as HTMLElement).closest("button, a, input, textarea, select, [data-no-modal]");
        if (tag) return;
        const dx = Math.abs(e.clientX - dragStartPos.current.x);
        const dy = Math.abs(e.clientY - dragStartPos.current.y);
        if (dx < 5 && dy < 5) onCardClick();
      }}
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
          <button onClick={onCardClick} className="text-sm font-semibold text-white truncate hover:text-primary transition-colors block text-left">{d.name}</button>
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
      <div className="flex gap-0.5 mb-2">
        {icons.map((item) => (
          <span
            key={item.label}
            title={`${item.label}: ${item.ok ? "OK" : "Falta"}`}
            className={`text-[9px] font-bold rounded w-5 h-5 flex items-center justify-center ${
              item.ok ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/10 text-red-400/60"
            }`}
          >
            {item.icon}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400/60 transition-all" style={{ width: `${(comp.score / comp.total) * 100}%` }} />
          </div>
          <span className="text-[9px] text-slate-600">{comp.score}/{comp.total}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
        <span>{d.categoryCount} cat</span>
        <span>·</span>
        <span>{d.itemCount} items</span>
        <span>·</span>
        <span>{d.orderCount} pedidos</span>
      </div>

      {/* Common action buttons */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        <a href={`https://menusanjuan.com/${d.slug}`} target="_blank" className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">Ver</a>
        <a href={`https://www.google.com/search?q=${encodeURIComponent(d.name + " San Juan")}`} target="_blank" className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">Google</a>

        {/* Stage-specific */}
        {card.stage === "NEEDS_INFO" && (
          <button onClick={onCardClick} className="rounded-lg bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-400/20 transition-colors">
            Editar
          </button>
        )}
        {card.stage === "READY" && (
          <button onClick={onCardClick} className="rounded-lg bg-blue-400/10 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-400/20 transition-colors">
            Revisar
          </button>
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
            {creds ? (
              <div className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 p-2 space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">Credenciales:</p>
                <p className="text-[10px] text-slate-300">Email: {creds.email}</p>
                <p className="text-[10px] text-white font-mono font-bold">Codigo: {creds.password}</p>
              </div>
            ) : (
              <button onClick={onActivate} disabled={activating} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
                {activating ? "Generando..." : "Regenerar credenciales"}
              </button>
            )}
            <button onClick={onResetCode} disabled={activating} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
              {activating ? "..." : "Resetear codigo"}
            </button>
            {card.lastContactedAt && (
              <span className="text-[10px] text-slate-600 py-1">Ultimo contacto: {timeAgo(card.lastContactedAt)}</span>
            )}
          </>
        )}
        {card.stage === "ONBOARDED" && (
          <>
            <button onClick={onResetCode} disabled={activating} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 transition-colors">
              {activating ? "..." : "Resetear codigo"}
            </button>
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
