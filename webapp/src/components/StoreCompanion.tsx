"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { MenuCategoryData, MenuItemData } from "@/data/menus";
import type { CartEntry } from "./StoreMenu";
import type { SelectedOptions } from "./ItemCustomizeSheet";

import Image from "next/image";
import { ItemCustomizeSheet } from "./ItemCustomizeSheet";

// ── Types ──
type SuggestedItem = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  suggestedItems?: SuggestedItem[];
};
type CompanionAction =
  | { type: "ADD_ITEM"; itemId: string; quantity: number; options?: string; note?: string }
  | { type: "REMOVE_ITEM"; itemId: string; quantity?: number | "all" }
  | { type: "CLEAR_CART" }
  | { type: "OPEN_CHECKOUT" };

type Props = {
  slug: string;
  restaurantName: string;
  categories: MenuCategoryData[];
  cart: CartEntry[];
  onAddToCart: (item: MenuItemData, qty: number, options: SelectedOptions, delta: number, note: string) => void;
  onRemoveFromCart: (cartKey: string) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
};

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Format bot text (escapes HTML first) ──
function formatText(text: string): string {
  return escapeHtml(text)
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

// ── Greeting jokes ──
const GREETINGS = [
  "Ey loco, bienvenido a {name}. ¿Qué carajo querés morfar?",
  "Bueno culiao, ya estás en {name}. ¿Vas a pedir o viniste a mirar nomás?",
  "Opa, un hambriento en {name}. Dale, decime qué querés antes de que cierre la cocina.",
  "Che boludo, acá estoy para ayudarte a pedir en {name}. No te hagas el tímido.",
  "Bienvenido a {name}, culiao. Acá la comida es buena y yo soy mejor. ¿Qué pedimos?",
];

export function StoreCompanion({ slug, restaurantName, categories, cart, onAddToCart, onRemoveFromCart, onClearCart, onOpenCheckout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // All items flat for lookup
  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Greet on first open
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace("{name}", restaurantName);
      setMessages([{ role: "assistant", content: greeting }]);
      setHasGreeted(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, hasGreeted, restaurantName]);

  // Build cart summary for API
  const cartSummary = useMemo(() =>
    cart.map((e) => ({
      itemId: e.item.id,
      name: e.item.name,
      quantity: e.quantity,
      price: e.item.price + e.optionsDelta,
      note: e.note || undefined,
    })),
    [cart]
  );

  async function sendMessage(override?: string) {
    const text = (override || input).trim();
    if (!text || sending) return;
    if (!override) setInput("");
    // Snapshot the history BEFORE adding the new user message (the server will add it)
    const historyForApi = messages.slice(-12);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/store-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          message: text,
          history: historyForApi,
          cart: cartSummary,
          personality: "bardero",
        }),
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply,
        suggestedItems: data.suggestedItems?.length > 0 ? data.suggestedItems : undefined,
      }]);

      // Execute actions directly (not via callback ref to avoid stale closures)
      if (data.actions?.length > 0) {
        for (const action of data.actions) {
          switch (action.type) {
            case "ADD_ITEM": {
              const item = allItems.find((i: MenuItemData) => i.id === action.itemId);
              if (!item) break;
              // If item has required option groups and bot didn't provide options, open the sheet instead
              const hasRequired = item.optionGroups?.some((g) => g.minSelections > 0);
              if (hasRequired && !action.options) {
                setCustomizingItem(item);
                setMessages((prev) => [...prev, {
                  role: "assistant",
                  content: `Ojo culiao, *${item.name}* necesita que elijas opciones. Abrí el detalle y elegí.`,
                }]);
                break;
              }
              const opts: SelectedOptions = [];
              if (action.options) {
                opts.push({
                  group: "Opciones",
                  groupId: "companion",
                  choices: action.options.split(",").map((o: string) => ({ name: o.trim(), priceDelta: 0 })),
                  delta: 0,
                });
              }
              onAddToCart(item, action.quantity || 1, opts, 0, action.note || "");
              break;
            }
            case "REMOVE_ITEM": {
              // Find all entries for this item
              const entries = cart.filter((e) => e.item.id === action.itemId);
              if (entries.length === 0) break;

              if (action.quantity === "all") {
                // Remove every unit of every entry
                for (const entry of entries) {
                  for (let i = 0; i < entry.quantity; i++) {
                    onRemoveFromCart(entry.cartKey);
                  }
                }
              } else {
                // Default: remove 1 unit from the first entry
                const qty = typeof action.quantity === "number" ? action.quantity : 1;
                let remaining = qty;
                for (const entry of entries) {
                  if (remaining <= 0) break;
                  const take = Math.min(entry.quantity, remaining);
                  for (let i = 0; i < take; i++) {
                    onRemoveFromCart(entry.cartKey);
                  }
                  remaining -= take;
                }
              }
              break;
            }
            case "CLEAR_CART":
              onClearCart();
              break;
            case "OPEN_CHECKOUT":
              onOpenCheckout();
              break;
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Uh, tuve un problema. Intentá de nuevo." },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function resetChat() {
    setMessages([]);
    setHasGreeted(false);
  }

  // ── Bubble ──
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-white text-xl font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 transition-all animate-bounce-once"
        title="Asistente de compras"
      >
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {cart.reduce((s, e) => s + e.quantity, 0)}
          </span>
        )}
      </button>
    );
  }

  // ── Panel ──
  return (
    <>
      {/* Backdrop on mobile */}
      <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setIsOpen(false)} />

      {/* Panel */}
      <div className="fixed z-50 flex flex-col bg-white shadow-2xl border-border/50
        bottom-0 right-0 left-0 w-full h-[70vh] rounded-t-3xl
        md:bottom-4 md:left-4 md:right-auto md:w-[360px] md:h-[500px] md:rounded-2xl md:border">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white text-sm font-bold">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text truncate">{restaurantName}</div>
            <div className="text-[10px] text-text-muted">Tu asistente de compras</div>
          </div>
          <button onClick={resetChat} className="text-[10px] text-text-muted hover:text-primary transition-colors px-2 py-1 rounded">
            Limpiar
          </button>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 mr-2 mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-amber-500 text-white text-[10px] font-bold">
                    M
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-surface-alt text-text rounded-bl-md leading-relaxed"
                  }`}
                >
                  {msg.role === "assistant"
                    ? <span dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
                    : msg.content
                  }
                </div>
              </div>

              {/* Item cards */}
              {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="ml-8 mt-2 flex gap-2 overflow-x-auto pb-1 snap-x">
                  {msg.suggestedItems.map((si) => {
                    const menuItem = allItems.find((i) => i.id === si.id);
                    return (
                      <button
                        key={si.id}
                        onClick={() => {
                          if (menuItem) setCustomizingItem(menuItem);
                        }}
                        className="shrink-0 w-36 rounded-xl border border-border/50 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all snap-start text-left"
                      >
                        {si.imageUrl && (
                          <div className="relative h-20 bg-slate-100">
                            <Image src={si.imageUrl} alt={si.name} fill className="object-cover" sizes="144px" />
                          </div>
                        )}
                        <div className="p-2">
                          <div className="text-[11px] font-bold text-text truncate">{si.name}</div>
                          {si.description && (
                            <div className="text-[9px] text-text-muted truncate mt-0.5">{si.description}</div>
                          )}
                          <div className="text-xs font-bold text-primary mt-1">${si.price.toLocaleString("es-AR")}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="shrink-0 mr-2 mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-amber-500 text-white text-[10px] font-bold">M</div>
              <div className="bg-surface-alt rounded-2xl rounded-bl-md px-3 py-2">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Quick suggestions when empty */}
        {messages.length <= 1 && !sending && (
          <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
            {["¿Qué me recomendás?", "Lo más pedido", "Algo light", "Sorprendeme"].map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-text-muted hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border/50 px-3 py-2.5">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Pedí, preguntá, puteá..."
              disabled={sending}
              className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-white shadow-sm hover:shadow-md transition-all disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Item customize sheet — opens when user taps a suggested item card */}
      {customizingItem && (
        <ItemCustomizeSheet
          item={customizingItem}
          onAdd={(qty, opts, delta, note) => {
            onAddToCart(customizingItem, qty, opts, delta, note);
            setCustomizingItem(null);
            // Add a confirmation message to chat
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: `Listo, te agregué ${qty}x *${customizingItem.name}* al carrito${note ? ` (${note})` : ""}.`,
            }]);
          }}
          onClose={() => setCustomizingItem(null)}
        />
      )}
    </>
  );
}
