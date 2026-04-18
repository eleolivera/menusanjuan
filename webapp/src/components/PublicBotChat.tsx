"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { getBotCarts, saveBotCart, removeBotCart, type BotCart } from "@/lib/bot-carts";
import { getAllOrderRefs } from "@/lib/order-tracker";

// ── Types ──
type RestaurantCard = {
  type: "restaurant";
  slug: string;
  name: string;
  cuisineType: string | null;
  rating: number | null;
  coverUrl: string | null;
  logoUrl: string | null;
  itemCount: number;
};

type CategoryButton = {
  type: "category";
  name: string;
  itemCount: number;
};

type BotBlock =
  | { type: "restaurants"; items: RestaurantCard[] }
  | { type: "categories"; items: CategoryButton[]; slug: string; restaurantName: string }
  | { type: "checkout"; url: string; slug: string; items: { name: string; qty: number; price: number }[]; total: number };

type Message = {
  role: "user" | "assistant";
  content: string;
  blocks?: BotBlock[];
  sticker?: string;
};

// ── Sticker reactions ──
const STICKERS: Record<string, string[]> = {
  greeting: ["👋", "🙌", "✌️"],
  food: ["🍕", "🍔", "🌮", "🍣", "🥟", "🍗", "🥩", "🍝"],
  drink: ["🧉", "🍺", "☕", "🥤", "🍷"],
  happy: ["😋", "🤤", "😎", "🔥", "💪"],
  thinking: ["🤔", "👀", "🧐"],
  bardero: ["😈", "💀", "🤡", "🫡", "🤙"],
};

function pickSticker(text: string, personality: string): string | undefined {
  const lower = text.toLowerCase();
  if (personality === "bardero") {
    return STICKERS.bardero[Math.floor(Math.random() * STICKERS.bardero.length)];
  }
  if (lower.includes("hola") || lower.includes("buen")) return STICKERS.greeting[Math.floor(Math.random() * STICKERS.greeting.length)];
  if (lower.includes("pizza") || lower.includes("lomo") || lower.includes("hamburguesa") || lower.includes("sushi") || lower.includes("comida") || lower.includes("morfar")) return STICKERS.food[Math.floor(Math.random() * STICKERS.food.length)];
  if (lower.includes("cafe") || lower.includes("cerveza") || lower.includes("coca") || lower.includes("bebida")) return STICKERS.drink[Math.floor(Math.random() * STICKERS.drink.length)];
  if (lower.includes("dale") || lower.includes("genial") || lower.includes("perfecto") || lower.includes("listo")) return STICKERS.happy[Math.floor(Math.random() * STICKERS.happy.length)];
  return undefined;
}

// ── Format WhatsApp-style text ──
function formatBotMessage(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="text-primary underline hover:text-primary/80 break-all">$1</a>'
    )
    .replace(/\n/g, "<br/>");
}

function BotText({ content }: { content: string }) {
  const html = useMemo(() => formatBotMessage(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Rich blocks ──
function RestaurantCards({ items, onSelect }: { items: RestaurantCard[]; onSelect: (slug: string, name: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
      {items.map((r) => (
        <button
          key={r.slug}
          onClick={() => onSelect(r.slug, r.name)}
          className="shrink-0 w-48 rounded-xl border border-border/50 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all snap-start text-left"
        >
          <div className="relative h-24 bg-gradient-to-br from-primary/10 to-amber-100">
            {r.coverUrl && (
              <Image src={r.coverUrl} alt={r.name} fill className="object-cover" sizes="192px" />
            )}
            {r.logoUrl && (
              <div className="absolute bottom-2 left-2 h-8 w-8 rounded-lg bg-white shadow-md overflow-hidden border border-border/30">
                <Image src={r.logoUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
              </div>
            )}
            {r.rating && (
              <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 shadow-sm">
                <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                {r.rating}
              </div>
            )}
          </div>
          <div className="p-2.5">
            <div className="text-xs font-bold text-text truncate">{r.name}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{r.cuisineType} · {r.itemCount} items</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function CategoryButtons({ items, onSelect }: { items: CategoryButton[]; onSelect: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button
          key={c.name}
          onClick={() => onSelect(c.name)}
          className="rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-medium text-text hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
        >
          {c.name} <span className="text-text-muted ml-1">({c.itemCount})</span>
        </button>
      ))}
    </div>
  );
}

function CheckoutCard({ block, onCartSaved }: { block: BotBlock & { type: "checkout" }; onCartSaved: () => void }) {
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-amber-50 p-4">
      <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Tu Pedido</div>
      {block.items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm py-1">
          <span className="text-text-secondary">{item.qty}x {item.name}</span>
          <span className="font-semibold text-text">${(item.price * item.qty).toLocaleString("es-AR")}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-primary/20 pt-2 flex justify-between">
        <span className="font-bold text-text">Total</span>
        <span className="text-lg font-extrabold text-text">${block.total.toLocaleString("es-AR")}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <a
          href={block.url}
          target="_blank"
          rel="noopener"
          onClick={() => {
            saveBotCart({
              slug: block.slug,
              restaurantName: block.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              items: block.items,
              total: block.total,
              checkoutUrl: block.url,
            });
            onCartSaved();
          }}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
        >
          Completar pedido
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
        </a>
        <button
          onClick={() => {
            saveBotCart({
              slug: block.slug,
              restaurantName: block.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              items: block.items,
              total: block.total,
              checkoutUrl: block.url,
            });
            onCartSaved();
          }}
          className="rounded-xl border border-border px-4 py-3 text-xs font-medium text-text-muted hover:bg-surface-alt transition-colors"
          title="Guardar para después"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Mis Pedidos bar ──
function MisPedidosBar({ carts, onRefresh }: { carts: BotCart[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const recentOrders = typeof window !== "undefined" ? getAllOrderRefs().filter((o) => {
    const age = Date.now() - new Date(o.placedAt).getTime();
    return age < 12 * 60 * 60 * 1000; // 12 hours
  }) : [];

  const totalItems = carts.length + recentOrders.length;
  if (totalItems === 0) return null;

  return (
    <div className="shrink-0 border-t border-border/50 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🛒</span>
          <span className="text-xs font-bold text-text">Mis Pedidos</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{totalItems}</span>
        </div>
        <svg className={`h-4 w-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
          {/* Active carts */}
          {carts.map((cart) => (
            <div key={cart.slug} className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text truncate">{cart.restaurantName}</div>
                <div className="text-[10px] text-text-muted">
                  {cart.items.length} item{cart.items.length !== 1 ? "s" : ""} · ${cart.total.toLocaleString("es-AR")}
                </div>
              </div>
              <a
                href={cart.checkoutUrl}
                target="_blank"
                rel="noopener"
                className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Pedir
              </a>
              <button
                onClick={() => { removeBotCart(cart.slug); onRefresh(); }}
                className="text-text-muted hover:text-red-400 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}

          {/* Recent orders */}
          {recentOrders.map((order) => (
            <a
              key={order.orderId}
              href={`/${order.slug}?track=${order.orderId}&token=${order.token}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-emerald-800">{order.orderNumber}</div>
                <div className="text-[10px] text-emerald-600">
                  {order.slug.replace(/-/g, " ")} · {new Date(order.placedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <span className="text-[10px] font-medium text-emerald-600">Ver estado</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
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
  const [carts, setCarts] = useState<BotCart[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshCarts = useCallback(() => setCarts(getBotCarts()), []);

  useEffect(() => { refreshCarts(); }, [refreshCarts]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(override?: string) {
    const text = (override || input).trim();
    if (!text || sending) return;
    if (!override) setInput("");
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
      const sticker = pickSticker(data.reply, personality);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply,
        blocks: data.blocks,
        sticker,
      }]);
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
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: next === "bardero"
          ? "Jajaja dale culiao, activaste el *modo bardero*. Ahora te voy a atender como se debe. ¿Qué carajo querés morfar?"
          : "Listo, volví al modo tranquilo. ¿En qué te puedo ayudar?",
        sticker: next === "bardero" ? "😈" : "😇",
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
    // New session for clean state
    const newId = `pub_${Date.now()}`;
    localStorage.setItem("msj_bot_session", newId);
    inputRef.current?.focus();
  }

  // Handle tapping a restaurant card
  function handleRestaurantSelect(slug: string, name: string) {
    sendMessage(name);
  }

  // Handle tapping a category button
  function handleCategorySelect(name: string) {
    sendMessage(name);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-surface">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-white px-4 py-3 safe-area-top">
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
              Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ minHeight: 0 }}>
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center pt-16">
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
                  {[
                    { text: "🍕 Quiero pizza", msg: "Quiero pizza" },
                    { text: "☕ Algo de café", msg: "Algo de café" },
                    { text: "🍔 Tengo hambre", msg: "Tengo hambre" },
                    { text: "🍣 Sushi para dos", msg: "Sushi para dos" },
                  ].map((q) => (
                    <button
                      key={q.msg}
                      onClick={() => sendMessage(q.msg)}
                      className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text-secondary hover:border-primary hover:text-primary hover:shadow-sm transition-all"
                    >
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 mr-2 mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-xs font-bold">
                    {msg.sticker || "M"}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md shadow-sm whitespace-pre-wrap"
                      : "bg-white border border-border/50 text-text rounded-bl-md shadow-sm leading-relaxed"
                  }`}
                >
                  {msg.role === "assistant" ? <BotText content={msg.content} /> : msg.content}
                </div>
              </div>

              {/* Rich blocks below bot message */}
              {msg.blocks && msg.blocks.length > 0 && (
                <div className="mt-3 ml-9 space-y-3">
                  {msg.blocks.map((block, bi) => {
                    if (block.type === "restaurants") {
                      return <RestaurantCards key={bi} items={block.items} onSelect={handleRestaurantSelect} />;
                    }
                    if (block.type === "categories") {
                      return <CategoryButtons key={bi} items={block.items} onSelect={handleCategorySelect} />;
                    }
                    if (block.type === "checkout") {
                      return <CheckoutCard key={bi} block={block} onCartSaved={refreshCarts} />;
                    }
                    return null;
                  })}
                </div>
              )}
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

      {/* Mis Pedidos bar */}
      <MisPedidosBar carts={carts} onRefresh={refreshCarts} />

      {/* Input */}
      <div className="shrink-0 border-t border-border/50 bg-white px-4 py-3 safe-area-bottom">
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
            onClick={() => sendMessage()}
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
