"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BotMessage = { role: "user" | "assistant"; content: string };

type Convo = {
  id: string;
  channel: "web" | "whatsapp" | "admin";
  selectedSlug: string | null;
  personality: string | null;
  updatedAt: string;
  msgCount: number;
  messages: BotMessage[];
};

const CHANNEL_LABEL: Record<string, { emoji: string; label: string; cls: string }> = {
  web:      { emoji: "🌐", label: "Web",      cls: "bg-blue-500/15 text-blue-300" },
  whatsapp: { emoji: "💬", label: "WhatsApp", cls: "bg-green-500/15 text-green-300" },
  admin:    { emoji: "🔧", label: "Admin",    cls: "bg-slate-500/15 text-slate-300" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function BotConversationsPage() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<Convo | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<"all" | "web" | "whatsapp" | "admin">("all");

  useEffect(() => {
    const qs = channelFilter !== "all" ? `?channel=${channelFilter}` : "";
    fetch(`/api/admin/bot-conversations${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setConvos(d.convos || []);
        setLoading(false);
        // Auto-select the newest convo when the list loads
        if (d.convos?.length && !selected) setSelected(d.convos[0]);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter]);

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Conversaciones del Bot</h1>
            <p className="text-[11px] text-slate-500">
              {loading ? "Cargando..." : `${convos.length} convos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { key: "all", label: "Todas" },
            { key: "web", label: "🌐 Web" },
            { key: "whatsapp", label: "💬 WA" },
            { key: "admin", label: "🔧 Admin" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => { setChannelFilter(t.key); setSelected(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                channelFilter === t.key
                  ? "bg-primary text-white"
                  : "border border-white/10 text-slate-400 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[340px_1fr] overflow-hidden">
        {/* List of convos (left) */}
        <aside className="border-r border-white/5 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : convos.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">No hay conversaciones todavía</div>
          ) : (
            convos.map((c) => {
              const ch = CHANNEL_LABEL[c.channel];
              const firstUser = c.messages.find((m) => m.role === "user")?.content || "(sin mensaje)";
              const isSelected = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${ch.cls}`}>
                      {ch.emoji} {ch.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeAgo(c.updatedAt)}</span>
                  </div>
                  <div className="text-xs text-slate-200 line-clamp-2 leading-snug">{firstUser}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                    <span>{c.msgCount} msgs</span>
                    {c.selectedSlug && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">→ {c.selectedSlug}</span>
                      </>
                    )}
                    {c.personality === "bardero" && (
                      <>
                        <span>·</span>
                        <span className="text-red-400">bardero</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </aside>

        {/* Selected convo (right) */}
        <main className="overflow-y-auto p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              ← Elegí una conversación de la izquierda
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="mb-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${CHANNEL_LABEL[selected.channel].cls}`}>
                    {CHANNEL_LABEL[selected.channel].emoji} {CHANNEL_LABEL[selected.channel].label}
                  </span>
                  <span>·</span>
                  <span>{new Date(selected.updatedAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {selected.personality && (
                    <>
                      <span>·</span>
                      <span className={selected.personality === "bardero" ? "text-red-400" : "text-slate-500"}>
                        modo {selected.personality}
                      </span>
                    </>
                  )}
                  {selected.selectedSlug && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400">pickeó {selected.selectedSlug}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-600">{selected.id}</div>
              </div>

              <div className="space-y-3">
                {selected.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-slate-800 text-slate-200 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
