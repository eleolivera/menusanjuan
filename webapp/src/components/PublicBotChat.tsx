"use client";

import { useState, useRef, useEffect, useMemo } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Parse WhatsApp-style formatting to HTML
function formatBotMessage(text: string): string {
  return text
    // Bold: *text* → <strong>text</strong>
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    // Links: https://... → <a>
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="text-primary underline hover:text-primary/80">$1</a>'
    )
    // Line breaks
    .replace(/\n/g, "<br/>");
}

function BotMessage({ content }: { content: string }) {
  const html = useMemo(() => formatBotMessage(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function PublicBotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("msj_bot_session");
      if (existing) return existing;
      const id = `pub_${Date.now()}`;
      localStorage.setItem("msj_bot_session", id);
      return id;
    }
    return `pub_${Date.now()}`;
  });
  const [personality, setPersonality] = useState<"normal" | "bardero">("normal");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Disculpa, tuve un problema. Intenta de nuevo." },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function togglePersonality() {
    const next = personality === "normal" ? "bardero" : "normal";
    setPersonality(next);
    await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "personality", personality: next }),
    });
    // Add a system message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          next === "bardero"
            ? "Jajaja dale culiao, activaste el *modo bardero*. Ahora te voy a atender como se debe. ¿Qué carajo querés morfar?"
            : "Listo, volví al modo tranquilo. ¿En qué te puedo ayudar?",
      },
    ]);
  }

  function resetChat() {
    fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "reset" }),
    });
    setMessages([]);
    inputRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-surface">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white text-lg font-bold shadow-md shadow-primary/25">
            M
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-text">MenuSanJuan</h1>
            <p className="text-[11px] text-text-muted">Tu asistente de comida en San Juan</p>
          </div>
          <button
            onClick={togglePersonality}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              personality === "bardero"
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "border border-border text-text-muted hover:bg-surface-alt"
            }`}
          >
            {personality === "bardero" ? "🤬 Bardero" : "😇 Normal"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={resetChat}
              className="rounded-xl border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-alt transition-colors"
            >
              Nuevo pedido
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" style={{ minHeight: 0 }}>
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center pt-20">
              <div className="text-center max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-3xl font-bold shadow-lg shadow-primary/25">
                  M
                </div>
                <h2 className="text-xl font-bold text-text mb-2">
                  ¿Qué querés comer hoy?
                </h2>
                <p className="text-sm text-text-secondary mb-6">
                  Te ayudo a encontrar restaurantes, ver menus y armar tu pedido en San Juan.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Quiero pizza", "Algo de café", "Tengo hambre", "Sushi para dos"].map((q) => (
                    <button
                      key={q}
                      onClick={async () => {
                        setMessages([{ role: "user", content: q }]);
                        setSending(true);
                        try {
                          const res = await fetch("/api/bot", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message: q, sessionId }),
                          });
                          if (!res.ok) throw new Error("Failed");
                          const data = await res.json();
                          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
                        } catch {
                          setMessages((prev) => [...prev, { role: "assistant", content: "Disculpa, tuve un problema." }]);
                        } finally {
                          setSending(false);
                        }
                      }}
                      className="rounded-xl border border-border bg-white px-4 py-2 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 mr-2 mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-xs font-bold">
                  M
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md shadow-sm whitespace-pre-wrap"
                    : "bg-white border border-border/50 text-text rounded-bl-md shadow-sm leading-relaxed"
                }`}
              >
                {msg.role === "assistant" ? <BotMessage content={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="shrink-0 mr-2 mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-xs font-bold">
                M
              </div>
              <div className="bg-white border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/50 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Escribí qué querés comer..."
            disabled={sending}
            autoFocus
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-30"
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
