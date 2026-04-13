"use client";

import { useState, useRef, useEffect } from "react";

type Debug = {
  selectedSlug: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  responseMs: number;
  systemPromptLength: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  debug?: Debug;
  feedback?: 1 | 2; // 1=bad, 2=good
};

type Feedback = {
  id: string;
  rating: number;
  note: string | null;
  userMessage: string;
  botReply: string;
  selectedSlug: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  responseMs: number;
  createdAt: string;
};

export default function BotTestPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"chat" | "feedback">("chat");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `admin_${Date.now()}`);
  const [showDebug, setShowDebug] = useState(true);
  const [feedbackNote, setFeedbackNote] = useState<{ idx: number; text: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Feedback list state
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Paste conversation state
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteSaved, setPasteSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setAuthed(true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (tab === "feedback" && authed) loadFeedback();
  }, [tab, authed]);

  async function loadFeedback() {
    setLoadingFeedback(true);
    try {
      const res = await fetch("/api/admin/bot");
      if (res.ok) setFeedbackList(await res.json());
    } catch {}
    setLoadingFeedback(false);
  }

  const totalCost = messages.filter((m) => m.debug).reduce((s, m) => s + (m.debug?.costCents || 0), 0);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/admin/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, debug: data.debug }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: no se pudo generar respuesta" }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function submitFeedback(msgIdx: number, rating: 1 | 2, note?: string) {
    const msg = messages[msgIdx];
    if (!msg || msg.role !== "assistant") return;

    // Find the user message before this one
    const userMsg = messages.slice(0, msgIdx).reverse().find((m) => m.role === "user");

    setMessages((prev) => prev.map((m, i) => (i === msgIdx ? { ...m, feedback: rating } : m)));

    await fetch("/api/admin/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "feedback",
        sessionId,
        rating,
        note: note || null,
        userMessage: userMsg?.content || "",
        botReply: msg.content,
        debug: msg.debug,
      }),
    });
  }

  async function resetChat() {
    await fetch("/api/admin/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "reset" }),
    });
    setMessages([]);
    inputRef.current?.focus();
  }

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Necesitas estar logueado como admin</p>
          <a href="/admin" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">Ir al Admin</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <a href="/admin" className="text-slate-500 hover:text-white transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </a>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-sm font-bold">M</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Bot Test</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button onClick={() => setTab("chat")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${tab === "chat" ? "bg-primary text-white" : "border border-white/10 text-slate-500"}`}>
            Chat
          </button>
          <button onClick={() => setTab("feedback")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${tab === "feedback" ? "bg-primary text-white" : "border border-white/10 text-slate-500"}`}>
            Feedback
          </button>
        </div>

        {tab === "chat" && (
          <>
            <button onClick={() => setShowDebug(!showDebug)} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${showDebug ? "bg-emerald-500/20 text-emerald-400" : "border border-white/10 text-slate-500"}`}>
              Debug
            </button>
            <button onClick={resetChat} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-slate-400 hover:bg-white/5 transition-colors">
              Reset
            </button>
            {totalCost > 0 && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-mono text-emerald-400">
                ${totalCost.toFixed(3)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat Tab */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 && showInstructions && (
              <div className="flex items-center justify-center h-full">
                <div className="max-w-sm">
                  <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">🤖</div>
                      <h2 className="text-base font-bold text-white">Bot de MenuSanJuan</h2>
                    </div>
                    <div className="space-y-3 text-sm text-slate-400">
                      <p>Probalo como si fueras un cliente que quiere pedir comida.</p>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-start">
                          <span className="text-lg shrink-0">👍</span>
                          <span>Si la respuesta esta bien, dale <strong className="text-white">pulgar arriba</strong></span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="text-lg shrink-0">👎</span>
                          <span>Si la respuesta esta mal, dale <strong className="text-white">pulgar abajo</strong> y escribi que deberia haber dicho</span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="text-lg shrink-0">📋</span>
                          <span>Si probaste el bot en <strong className="text-white">WhatsApp</strong>, anda a la pestana <strong className="text-white">Feedback</strong> y pega la conversacion</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 pt-1">Cada feedback nos ayuda a mejorar el bot. Probalo varias veces con distintos pedidos.</p>
                    </div>
                    <button onClick={() => { setShowInstructions(false); inputRef.current?.focus(); }}
                      className="w-full mt-4 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-semibold text-white">
                      Empezar a probar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-slate-800 text-slate-200 rounded-bl-md"}`}>
                    {msg.content}
                  </div>
                </div>

                {/* Feedback + debug row for bot messages */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mt-1 ml-1">
                    {/* Thumbs */}
                    {!msg.feedback ? (
                      <div className="flex gap-1">
                        <button onClick={() => submitFeedback(i, 2)} className="rounded-md px-1.5 py-0.5 text-slate-600 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors" title="Buena respuesta">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V2.75a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H3.75" /></svg>
                        </button>
                        <button
                          onClick={() => setFeedbackNote({ idx: i, text: "" })}
                          className="rounded-md px-1.5 py-0.5 text-slate-600 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                          title="Mala respuesta (agregar nota)"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.848.992-5.464 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h4.369a4.5 4.5 0 011.423.23l3.114 1.04a4.5 4.5 0 001.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.75 2.25 2.25 0 009.75 22a.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" /></svg>
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-medium ${msg.feedback === 2 ? "text-emerald-500" : "text-red-400"}`}>
                        {msg.feedback === 2 ? "👍" : "👎"}
                      </span>
                    )}

                    {/* Debug */}
                    {showDebug && msg.debug && (
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
                        <span>{msg.debug.responseMs}ms</span>
                        <span>{msg.debug.inputTokens}+{msg.debug.outputTokens} tok</span>
                        <span>${msg.debug.costCents.toFixed(3)}</span>
                        {msg.debug.selectedSlug && <span className="text-primary">@ {msg.debug.selectedSlug}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback note input */}
                {feedbackNote?.idx === i && (
                  <div className="ml-1 mt-1 flex gap-2">
                    <input
                      type="text"
                      value={feedbackNote.text}
                      onChange={(e) => setFeedbackNote({ ...feedbackNote, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          submitFeedback(i, 1, feedbackNote.text);
                          setFeedbackNote(null);
                        }
                      }}
                      placeholder="Que estuvo mal?"
                      autoFocus
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-red-400 focus:outline-none"
                    />
                    <button
                      onClick={() => { submitFeedback(i, 1, feedbackNote.text); setFeedbackNote(null); }}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Enviar
                    </button>
                    <button onClick={() => setFeedbackNote(null)} className="text-[10px] text-slate-600 hover:text-slate-400">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-white/5 px-4 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Escribi como si fueras un cliente..."
                disabled={sending}
                autoFocus
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
              />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Feedback Tab */}
      {tab === "feedback" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white">Feedback ({feedbackList.length})</h2>
            <button onClick={loadFeedback} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-slate-400 hover:bg-white/5">
              Recargar
            </button>
          </div>

          {/* Paste WhatsApp conversation */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4 mb-4">
            <h3 className="text-xs font-bold text-white mb-2">📋 Pegar conversacion de WhatsApp</h3>
            <p className="text-[10px] text-slate-500 mb-3">
              Si probaste el bot por WhatsApp, copia y pega la conversacion aca. Esto nos ayuda a ver como responde el bot en la vida real.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setPasteSaved(false); }}
              placeholder="Pega aca la conversacion de WhatsApp..."
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none resize-none mb-2"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!pasteText.trim()) return;
                  setPasteSaving(true);
                  await fetch("/api/admin/bot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "feedback",
                      sessionId: `paste_${Date.now()}`,
                      rating: 0,
                      note: "Conversacion pegada de WhatsApp",
                      userMessage: "[Conversacion completa]",
                      botReply: pasteText.trim(),
                      debug: {},
                    }),
                  });
                  setPasteSaving(false);
                  setPasteSaved(true);
                  setPasteText("");
                  loadFeedback();
                }}
                disabled={!pasteText.trim() || pasteSaving}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-30"
              >
                {pasteSaving ? "Guardando..." : "Guardar conversacion"}
              </button>
              {pasteSaved && <span className="text-[10px] text-emerald-400">Guardado</span>}
            </div>
          </div>

          {loadingFeedback ? (
            <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : feedbackList.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-sm font-bold text-white mb-1">Sin feedback todavia</h3>
              <p className="text-[10px] text-slate-500">Usa los pulgares en el chat para marcar respuestas</p>
            </div>
          ) : (
            feedbackList.map((fb) => (
              <div key={fb.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{fb.rating === 2 ? "👍" : fb.rating === 1 ? "👎" : "📋"}</span>
                  <span className="text-[10px] text-slate-500">{new Date(fb.createdAt).toLocaleString("es-AR")}</span>
                  <span className="text-[10px] font-mono text-slate-600">{fb.responseMs}ms / {fb.inputTokens}+{fb.outputTokens}tok / ${fb.costCents.toFixed(3)}</span>
                  {fb.selectedSlug && <span className="text-[10px] text-primary">@ {fb.selectedSlug}</span>}
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg bg-primary/10 px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Cliente:</div>
                    <div className="text-xs text-white">{fb.userMessage}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800 px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Bot:</div>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap">{fb.botReply}</div>
                  </div>
                  {fb.note && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                      <div className="text-[10px] text-red-400">Nota: {fb.note}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
