"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  debug?: {
    selectedSlug: string | null;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    responseMs: number;
    systemPromptLength: number;
  };
};

export default function BotTestPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `admin_${Date.now()}`);
  const [showDebug, setShowDebug] = useState(true);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check auth
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) setAuthed(true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Total cost
  const totalCost = messages
    .filter((m) => m.debug)
    .reduce((sum, m) => sum + (m.debug?.costCents || 0), 0);

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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, debug: data.debug },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: no se pudo generar respuesta" },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
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
          <a href="/admin" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">
            Ir al Admin
          </a>
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
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Bot Test</h1>
          <p className="text-[10px] text-slate-500">Misma logica que WhatsApp — sin costo de envio</p>
        </div>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${showDebug ? "bg-primary/20 text-primary" : "border border-white/10 text-slate-500"}`}
        >
          Debug {showDebug ? "ON" : "OFF"}
        </button>
        <button
          onClick={resetChat}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-slate-400 hover:bg-white/5 transition-colors"
        >
          Reset
        </button>
        {totalCost > 0 && (
          <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-mono text-emerald-400">
            ${totalCost.toFixed(3)}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-sm text-slate-500">Escribi algo para testear el bot</p>
              <p className="text-[10px] text-slate-600 mt-1">Probalo como si fueras un cliente de WhatsApp</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "bg-slate-800 text-slate-200 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>

            {/* Debug info */}
            {showDebug && msg.debug && (
              <div className="flex justify-start mt-1 ml-1">
                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
                  <span>{msg.debug.responseMs}ms</span>
                  <span>{msg.debug.inputTokens}+{msg.debug.outputTokens} tok</span>
                  <span>${msg.debug.costCents.toFixed(3)}</span>
                  <span>{msg.debug.systemPromptLength} chars prompt</span>
                  {msg.debug.selectedSlug && (
                    <span className="text-primary">@ {msg.debug.selectedSlug}</span>
                  )}
                </div>
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
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
