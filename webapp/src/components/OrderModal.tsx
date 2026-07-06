"use client";

import { useState, useEffect, useRef } from "react";
import type { MenuItemData } from "@/data/menus";
import type { SelectedOptions, ComponentSelection } from "./ItemCustomizeSheet";
import { LocationPicker } from "./LocationPicker";
import { PhoneInput } from "./PhoneInput";
import { formatForWhatsApp } from "@/lib/phone";
import { type DeliveryConfig, calculateDeliveryFee, type DeliveryZoneResult } from "@/lib/delivery";
import { OrderStatusStepper } from "./OrderStatusStepper";
import { saveOrderRef } from "@/lib/order-tracker";
import { ComprobanteUploader } from "./ComprobanteUploader";
import { X, Plus, Minus, Pencil } from "lucide-react";

type PaymentIntent = "cash" | "transfer" | "mercadopago";

type CartItem = {
  item: MenuItemData;
  quantity: number;
  cartKey: string;
  selectedOptions: SelectedOptions;
  // Promo only — per-slot customizations. Each slot already includes its own
  // `optionsDelta`; the CartItem-level `optionsDelta` is the SUM across parent + components.
  componentSelections?: ComponentSelection[];
  optionsDelta: number;
  note?: string;
};

export function OrderModal({
  items,
  total,
  restaurantName,
  restaurantPhone,
  restauranteSlug,
  deliveryConfig,
  mercadoPagoAlias,
  mercadoPagoCvu,
  bankInfo,
  pickupService,
  deliveryService,
  onClose,
  onRemove,
  onAdd,
  onUpdateNote,
  onClearCart,
  onOrderSent,
  trackingOrder,
  rewardPreview,
}: {
  items: CartItem[];
  total: number;
  restaurantName: string;
  restaurantPhone: string;
  restauranteSlug: string;
  deliveryConfig?: DeliveryConfig | null;
  mercadoPagoAlias?: string | null;
  mercadoPagoCvu?: string | null;
  bankInfo?: string | null;
  pickupService?: { enabled: boolean; openNow: boolean; available: boolean; nextOpenLabel: string | null } | null;
  deliveryService?: { enabled: boolean; openNow: boolean; available: boolean; nextOpenLabel: string | null } | null;
  onClose: () => void;
  onRemove: (cartKey: string) => void;
  onAdd: (cartKey: string) => void;
  onUpdateNote?: (cartKey: string, note: string) => void;
  onClearCart?: () => void;
  onOrderSent?: (orderId: string, token: string, orderNumber: string) => void;
  trackingOrder?: { orderId: string; token: string; orderNumber: string } | null;
  /** Populated by StoreMenu when the customer is signed in + eligible.
   *  Shows a "your free X will be added" callout in the confirm summary so
   *  the reward is visible BEFORE hitting submit. When the cart already
   *  contains the reward item, the server applies as a DISCOUNT (not a
   *  bonus); we mirror that math client-side for accurate preview. */
  rewardPreview?: {
    rewardItemName: string;
    rewardItemId: string | null;
    rewardItemPrice: number | null;
  } | null;
}) {
  const [step, setStep] = useState<"cart" | "method" | "info" | "confirm" | "tracking">(
    trackingOrder ? "tracking" : "cart"
  );
  const [editingNote, setEditingNote] = useState<{ cartKey: string; text: string } | null>(null);
  // Snapshot of items taken right before cart is cleared — used for re-send WhatsApp after checkout
  const [sentItemsSnapshot, setSentItemsSnapshot] = useState<CartItem[]>([]);
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("msj_name") || "";
    return "";
  });
  const [phone, setPhone] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("msj_phone") || "";
    return "";
  });
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderId, setOrderId] = useState(trackingOrder?.orderId || "");
  const [orderToken, setOrderToken] = useState(trackingOrder?.token || "");
  const [trackingStatus, setTrackingStatus] = useState<string>("GENERATED");
  const [trackingData, setTrackingData] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Payment intent — what the customer SAYS they'll pay with at checkout.
  // Stays nullable until they pick; cash is the default fallback so existing
  // copy still works for users who don't engage with the picker.
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>("cash");
  // Optional pre-order comprobante URL when the customer uploads at checkout.
  const [checkoutReceiptUrl, setCheckoutReceiptUrl] = useState<string | null>(null);
  const [copiedAlias, setCopiedAlias] = useState(false);
  // Optional gift code entry — code was WhatsApp'd to the customer by the
  // owner. Server validates and computes the discount preview.
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeState, setCodeState] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "ok"; code: string; description: string; discountAmount: number }
    | { status: "error"; message: string }
  >({ status: "idle" });
  // (rewardPreview arrives via props from StoreMenu; that parent already
  // fetches /api/rewards/progress once for the FloatingCart hint.)
  // Soft-intercept: when transfer/MP is picked and no receipt is attached, the
  // Send button shows a one-step nudge instead of firing immediately. Customer
  // can choose to upload or send anyway. Improves attach rate without forcing.
  const [showReceiptNudge, setShowReceiptNudge] = useState(false);
  // Ref to the upload section so "Subir ahora" in the nudge can scroll it into view.
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 1500);
    } catch {}
  }

  // Poll for order status when in tracking mode
  useEffect(() => {
    const oid = trackingOrder?.orderId || orderId;
    const tok = trackingOrder?.token || orderToken;
    if (step !== "tracking" || !oid || !tok) return;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/track?id=${oid}&token=${tok}`);
        if (res.ok) {
          const data = await res.json();
          setTrackingStatus(data.status);
          setTrackingData(data);
          if (data.status === "DELIVERED" || data.status === "CANCELLED") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {}
    }
    poll();
    pollRef.current = setInterval(poll, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, orderId, orderToken, trackingOrder]);

  // Delivery
  // Pick a sensible default method depending on what's available right now
  const deliveryAvailable = deliveryService?.available ?? (deliveryConfig?.deliveryEnabled !== false);
  const pickupAvailable = pickupService?.available ?? true;
  const initialMethod: "delivery" | "pickup" =
    deliveryAvailable ? "delivery" :
    pickupAvailable ? "pickup" :
    "delivery";
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(initialMethod);
  const [deliveryResult, setDeliveryResult] = useState<DeliveryZoneResult | null>(null);

  // hasDelivery is now derived from the service availability (toggle + hours combined)
  const hasDelivery = deliveryAvailable;
  const isAnyOpen = deliveryAvailable || pickupAvailable;
  // Has at least one configured zone (new system — preferred over legacy close/far)?
  const hasZones =
    !!deliveryConfig?.deliveryZones &&
    deliveryConfig.deliveryZones.length > 0;
  // No usable pricing = restaurant confirms fee manually. Three ways to land here:
  //   1. owner has explicitly opted out of auto-pricing (deliveryPricingEnabled=false)
  //   2. owner enabled pricing but didn't set zones / flat fee
  //   3. zones exist but resta has no coordinates (haversine can't compute)
  const hasDeliveryPricing = deliveryConfig != null && deliveryConfig.deliveryPricingEnabled !== false && (
    (hasZones && deliveryConfig.latitude != null && deliveryConfig.longitude != null) ||
    (deliveryConfig.deliveryClosePrice != null && deliveryConfig.latitude != null && deliveryConfig.longitude != null) ||
    (deliveryConfig.deliveryFee != null && deliveryConfig.deliveryFee > 0)
  );
  const deliveryFee = deliveryMethod === "pickup" ? 0 : (deliveryResult?.fee ?? 0);
  // Reflect any pending redemption code discount in the visible total. Discount
  // amounts are ≥0 pesos (server clamps to subtotal-1 so the total stays ≥ $1).
  const codeDiscount = codeState.status === "ok" ? codeState.discountAmount : 0;

  // Punch-reward preview: when cart already contains the reward item, the
  // server will apply as a discount (not a bonus). Mirror that math here.
  // If the customer added N of the reward item, only ONE gets discounted.
  const cartHasRewardItem = Boolean(
    rewardPreview?.rewardItemId &&
    items.some((ci) => ci.item.id === rewardPreview.rewardItemId)
  );
  const rewardDiscount = cartHasRewardItem && rewardPreview?.rewardItemPrice
    ? Math.max(0, Math.min(total - 1, Math.round(rewardPreview.rewardItemPrice)))
    : 0;
  const grandTotal = total + deliveryFee - codeDiscount - rewardDiscount;

  async function validateCode(raw: string) {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) { setCodeState({ status: "idle" }); return; }
    setCodeState({ status: "checking" });
    try {
      const res = await fetch("/api/rewards/preview-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalized,
          dealerSlug: restauranteSlug,
          cartItems: items.map((ci) => ({
            unitPrice: ci.item.price,
            optionsDelta: ci.optionsDelta,
            quantity: ci.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Extract discount amount from the line (unitPrice is negative for
        // discounts; 0 for free item). Use absolute value.
        const discountAmount = data.line ? Math.abs(data.line.unitPrice * data.line.quantity) : 0;
        setCodeState({ status: "ok", code: normalized, description: data.description, discountAmount });
      } else {
        const messages: Record<string, string> = {
          invalid: "Código no válido",
          expired: "Este código ya venció",
          already_used: "Este código ya fue canjeado",
          not_your_dealer: "Este código no aplica en este restaurante",
          empty_cart: "Agregá algo al carrito antes de aplicar el código",
          rate_limited: "Muchos intentos. Esperá un momento.",
        };
        setCodeState({ status: "error", message: messages[data.error] || "No se pudo aplicar el código" });
      }
    } catch {
      setCodeState({ status: "error", message: "Error de conexión" });
    }
  }

  function clearCode() {
    setCodeInput("");
    setCodeState({ status: "idle" });
  }
  const isOutOfRange = deliveryMethod === "delivery" && deliveryResult?.zone === null && deliveryResult !== null;

  // Price range text for delivery option — shown BEFORE the customer picks a
  // location, so we display the cheapest → most-expensive zone range when
  // multiple zones exist, or the single price for flat/single-zone setups.
  function getDeliveryPriceText(): string {
    if (!deliveryConfig) return "";
    // New zones system — preferred.
    if (deliveryConfig.deliveryZones && deliveryConfig.deliveryZones.length > 0) {
      const prices = deliveryConfig.deliveryZones.map((z) => z.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) return `$${min.toLocaleString("es-AR")}`;
      return `$${min.toLocaleString("es-AR")} — $${max.toLocaleString("es-AR")}`;
    }
    // Legacy fallbacks
    if (deliveryConfig.deliveryClosePrice != null && deliveryConfig.deliveryFarPrice != null) {
      return `$${deliveryConfig.deliveryClosePrice.toLocaleString("es-AR")} — $${deliveryConfig.deliveryFarPrice.toLocaleString("es-AR")}`;
    }
    if (deliveryConfig.deliveryClosePrice != null) return `$${deliveryConfig.deliveryClosePrice.toLocaleString("es-AR")}`;
    if (deliveryConfig.deliveryFee != null) return `$${deliveryConfig.deliveryFee.toLocaleString("es-AR")}`;
    return "Consultá con el restaurante";
  }

  function handleLocationConfirm(addr: string, lat: number, lng: number) {
    setAddress(addr);
    setLatitude(lat);
    setLongitude(lng);
    // Calculate delivery fee
    if (deliveryConfig && deliveryMethod === "delivery") {
      const result = calculateDeliveryFee(deliveryConfig, lat, lng);
      setDeliveryResult(result);
    }
  }

  function formatItemLines(cartItems: CartItem[]): string {
    return cartItems
      .map((ci) => {
        const linePrice = (ci.item.price + ci.optionsDelta) * ci.quantity;
        let line = `  ${ci.quantity}x ${ci.item.name} — $${linePrice.toLocaleString("es-AR")}`;
        // Parent-level options (rare on a promo, common on a normal item)
        if (ci.selectedOptions.length > 0) {
          const optLines = ci.selectedOptions.map((so) => {
            const choiceNames = so.choices.map((c) => c.priceDelta > 0 ? `${c.name} (+$${c.priceDelta.toLocaleString("es-AR")})` : c.name).join(", ");
            return `     > ${so.group}: ${choiceNames}`;
          });
          line += "\n" + optLines.join("\n");
        }
        // Per-component (promo slot) options — nested under each slot label
        // so the resta sees what's customized on each pachata individually.
        if (ci.componentSelections && ci.componentSelections.length > 0) {
          for (const comp of ci.componentSelections) {
            line += `\n     ↳ ${comp.label}`;
            for (const so of comp.selectedOptions) {
              const choiceNames = so.choices.map((c) => c.priceDelta > 0 ? `${c.name} (+$${c.priceDelta.toLocaleString("es-AR")})` : c.name).join(", ");
              line += `\n       · ${so.group}: ${choiceNames}`;
            }
          }
        }
        if (ci.note) {
          line += `\n     > Nota: ${ci.note}`;
        }
        return line;
      })
      .join("\n");
  }

  // Building the WhatsApp message after the order is created — we use orderIdForLink
  // + token to embed a /pagar link when the customer picked transfer/MP and didn't
  // upload at checkout.
  function buildWhatsAppMessageFor(orderNum: string, cartItems: CartItem[], opts?: { orderIdForLink?: string; tokenForLink?: string; receiptUploadedAtCheckout?: boolean }): string {
    const itemLines = formatItemLines(cartItems);
    const methodLabel = deliveryMethod === "pickup" ? "Retiro en local" : "Delivery";
    let deliveryLine = "";
    if (deliveryMethod === "delivery" && deliveryFee > 0) {
      deliveryLine = `\n🚛 *Envío:* $${deliveryFee.toLocaleString("es-AR")}${deliveryResult?.zone === "far" ? " (zona lejana)" : ""}`;
    } else if (deliveryMethod === "delivery" && !hasDeliveryPricing) {
      deliveryLine = "\n🚛 *Envío:* ⚠️ Por confirmar — informale al cliente el costo de envío";
    } else if (deliveryMethod === "pickup") {
      deliveryLine = "\n🏪 *Retiro en local* (sin costo de envío)";
    }

    const subtotal = cartItems.reduce((s, ci) => s + (ci.item.price + ci.optionsDelta) * ci.quantity, 0);

    // Payment-intent line — what the customer chose
    const intentLabel =
      paymentIntent === "cash" ? "💵 Efectivo al entregar"
      : paymentIntent === "transfer" ? "🏦 Transferencia"
      : "📲 Mercado Pago";
    const intentLine = `\n💳 *Forma de pago:* ${intentLabel}`;

    // Mercado Pago alias only when the resta is fully configured.
    // Skip the alias on the "Por confirmar" delivery state — the resta isn't ready yet.
    const wantsTransferOrMP = paymentIntent === "transfer" || paymentIntent === "mercadopago";
    const showAlias = !!mercadoPagoAlias && wantsTransferOrMP && !(deliveryMethod === "delivery" && !hasDeliveryPricing);
    const aliasLine = showAlias
      ? `\n💸 *Alias para transferir:* \`${mercadoPagoAlias}\``
      : "";

    // /pagar link — only when MP/transfer + no receipt uploaded yet + we have a finalized total
    const finalizedTotal = !(deliveryMethod === "delivery" && !hasDeliveryPricing);
    const showPagarLink =
      wantsTransferOrMP &&
      !opts?.receiptUploadedAtCheckout &&
      finalizedTotal &&
      opts?.orderIdForLink &&
      opts?.tokenForLink;
    const pagarLine = showPagarLink
      ? `\n🧾 *Mandar el comprobante:* https://menusanjuan.com/pagar/${opts!.orderIdForLink}?t=${opts!.tokenForLink}`
      : "";
    const receiptUploadedLine = opts?.receiptUploadedAtCheckout
      ? "\n✅ *Comprobante adjuntado al pedido* (esperando validación del restaurante)"
      : "";

    return `🍽️ *Nuevo Pedido — ${restaurantName}*
━━━━━━━━━━━━━━━━━━
📋 *Pedido:* ${orderNum}

${itemLines}

💰 *Subtotal: $${subtotal.toLocaleString("es-AR")}*${deliveryLine}
💰 *Total: $${(subtotal + deliveryFee).toLocaleString("es-AR")}*${!hasDeliveryPricing && deliveryMethod === "delivery" ? " + envío" : ""}
━━━━━━━━━━━━━━━━━━
👤 *Nombre:* ${name}
📱 *Teléfono:* ${phone}
📦 *Entrega:* ${methodLabel}
${deliveryMethod === "delivery" && address ? `📍 *Dirección:* ${address}` : ""}
${deliveryMethod === "delivery" && latitude && longitude ? `📌 *Mapa:* https://www.google.com/maps?q=${latitude},${longitude}` : ""}
${notes ? `📝 *Notas:* ${notes}` : ""}${intentLine}${aliasLine}${pagarLine}${receiptUploadedLine}
━━━━━━━━━━━━━━━━━━
_Pedido realizado desde MenuSanJuan_`;
  }

  function buildWhatsAppMessage(orderNum: string, opts?: { orderIdForLink?: string; tokenForLink?: string; receiptUploadedAtCheckout?: boolean }) {
    return encodeURIComponent(buildWhatsAppMessageFor(orderNum, items, opts));
  }

  // Rebuild from tracking data (persisted order) — used when cart has been cleared and snapshot is gone
  function buildWhatsAppFromTracking(orderNum: string, td: any): string {
    const tdItems = (td.items as any[]) || [];
    const lines = tdItems.map((it) => {
      let line = `  ${it.quantity}x ${it.name} — $${(it.total ?? (it.unitPrice * it.quantity)).toLocaleString("es-AR")}`;
      if (it.selectedOptions?.length > 0) {
        const optLines = it.selectedOptions.map((so: any) => {
          const choiceNames = so.choices.map((c: any) => c.priceDelta > 0 ? `${c.name} (+$${c.priceDelta.toLocaleString("es-AR")})` : c.name).join(", ");
          return `     > ${so.group}: ${choiceNames}`;
        });
        line += "\n" + optLines.join("\n");
      }
      if (it.note) line += `\n     > Nota: ${it.note}`;
      return line;
    }).join("\n");

    return `🍽️ *Nuevo Pedido — ${td.restaurantName || restaurantName}*
━━━━━━━━━━━━━━━━━━
📋 *Pedido:* ${orderNum}

${lines}

💰 *Total: $${(td.total || 0).toLocaleString("es-AR")}*
━━━━━━━━━━━━━━━━━━
👤 *Nombre:* ${td.customerName || name}
━━━━━━━━━━━━━━━━━━
_Pedido realizado desde MenuSanJuan_`;
  }

  async function handleSendWhatsApp() {
    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restauranteSlug,
          customerName: name,
          customerPhone: phone,
          customerAddress: deliveryMethod === "pickup" ? null : address,
          latitude: deliveryMethod === "pickup" ? null : latitude,
          longitude: deliveryMethod === "pickup" ? null : longitude,
          items: items.map((ci) => ({
            menuItemId: ci.item.id,
            name: ci.item.name,
            quantity: ci.quantity,
            unitPrice: ci.item.price,
            optionsDelta: ci.optionsDelta,
            selectedOptions: ci.selectedOptions,
            // Promo only — per-slot customizations. Server persists this as
            // part of the Order.items JSON so the kanban + ticket can render
            // each slot's options independently.
            componentSelections: ci.componentSelections,
            note: ci.note || "",
            total: (ci.item.price + ci.optionsDelta) * ci.quantity,
          })),
          // total intentionally omitted — server recomputes from items.
          // (Previously we sent grandTotal here which included deliveryFee → double-count
          // when combined with the separate deliveryFee column.)
          deliveryMethod,
          deliveryFee,
          notes,
          paymentIntent,
          paymentReceiptUrl: checkoutReceiptUrl,
          // Optional gift code — server re-validates before applying.
          redemptionCode: codeState.status === "ok" ? codeState.code : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create order");

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setOrderToken(order.customerAccessToken || "");

      // Cache name and phone for next order
      localStorage.setItem("msj_name", name);
      localStorage.setItem("msj_phone", phone);

      // Save to localStorage for persistent tracking
      if (order.customerAccessToken) {
        saveOrderRef(restauranteSlug, order.id, order.customerAccessToken, order.orderNumber);
        onOrderSent?.(order.id, order.customerAccessToken, order.orderNumber);
      }

      const cleanPhone = formatForWhatsApp(restaurantPhone) || restaurantPhone.replace(/[^0-9]/g, "");
      const message = buildWhatsAppMessage(order.orderNumber, {
        orderIdForLink: order.id,
        tokenForLink: order.customerAccessToken,
        receiptUploadedAtCheckout: !!checkoutReceiptUrl,
      });
      const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

      setStep("tracking");

      // Snapshot items for later re-send, then clear the cart
      setSentItemsSnapshot(items);
      onClearCart?.();

      // Mark as sent (non-blocking)
      fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappSent: true }),
      });

      // Use location.href for mobile compatibility (window.open gets blocked after await)
      window.location.href = waUrl;
    } catch (err) {
      console.error(err);
      alert("Error al crear el pedido. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-t-2xl sm:rounded-2xl bg-surface shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-surface px-5 py-4">
          <h2 className="text-lg font-bold text-text">
            {step === "cart" && "Tu Pedido"}
            {step === "method" && "Método de Entrega"}
            {step === "info" && "Tus Datos"}
            {step === "confirm" && "Confirmar Pedido"}
            {step === "tracking" && "Seguimiento"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover transition-colors">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Cart review */}
          {step === "cart" && (
            <>
              <div className="space-y-3 mb-6">
                {items.map((ci) => (
                  <div key={ci.cartKey} className="rounded-xl border border-border/50 bg-surface-alt p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text truncate">{ci.item.name}</div>
                        {ci.selectedOptions.length > 0 && (
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {ci.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")}
                          </div>
                        )}
                        {/* Per-component selections (promos): one line per slot */}
                        {ci.componentSelections && ci.componentSelections.length > 0 && (
                          <div className="text-[10px] text-text-muted mt-0.5 space-y-0.5">
                            {ci.componentSelections.map((comp) => (
                              <div key={comp.componentId}>
                                <span className="font-semibold text-text-secondary">↳ {comp.label}:</span>{" "}
                                {comp.selectedOptions.length > 0
                                  ? comp.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")
                                  : <span className="italic">sin extras</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-text-muted">${(ci.item.price + ci.optionsDelta).toLocaleString("es-AR")} c/u</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onRemove(ci.cartKey)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-secondary hover:border-danger hover:text-danger transition-colors">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.25rem] text-center text-sm font-bold text-text">{ci.quantity}</span>
                        <button onClick={() => onAdd(ci.cartKey)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-sm font-bold text-text w-20 text-right">${((ci.item.price + ci.optionsDelta) * ci.quantity).toLocaleString("es-AR")}</div>
                    </div>
                    {/* Note: show or edit */}
                    {editingNote?.cartKey === ci.cartKey ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editingNote.text}
                          onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value.slice(0, 200) })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { onUpdateNote?.(ci.cartKey, editingNote.text); setEditingNote(null); }
                            if (e.key === "Escape") setEditingNote(null);
                          }}
                          placeholder="sin cebolla, bien cocido..."
                          autoFocus
                          className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                        />
                        <button
                          onClick={() => { onUpdateNote?.(ci.cartKey, editingNote.text); setEditingNote(null); }}
                          className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingNote({ cartKey: ci.cartKey, text: ci.note || "" })}
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                        {ci.note ? `Nota: ${ci.note}` : "Agregar nota"}
                      </button>
                    )}
                  </div>
                ))}

                {/* Bonus reward item shown as a virtual line item so the
                    customer SEES what they're getting for free, alongside
                    their own selections. Not editable, not part of the
                    client cart state — the server injects the real line at
                    checkout submit. */}
                {rewardPreview && !cartHasRewardItem && (
                  <div className="rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate flex items-center gap-1.5">
                          <span>🎁</span>
                          <span>{rewardPreview.rewardItemName}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500 text-white rounded px-1.5 py-0.5">Regalo</span>
                        </div>
                        <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                          Se suma sin costo — canje de premio de fidelidad
                        </div>
                      </div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 w-20 text-right">
                        GRATIS
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {rewardPreview && cartHasRewardItem && (
                <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                    <span>🎁</span>
                    <span>
                      {cartHasRewardItem
                        ? `${rewardPreview.rewardItemName} gratis (canje)`
                        : `${rewardPreview.rewardItemName} de regalo`}
                    </span>
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    {cartHasRewardItem && rewardDiscount > 0
                      ? `−$${rewardDiscount.toLocaleString("es-AR")}`
                      : "GRATIS"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-primary/5 to-orange-50 p-4 mb-5">
                <span className="text-sm font-semibold text-text">Subtotal</span>
                <span className="text-xl font-extrabold text-text tracking-tight">
                  ${(total - rewardDiscount).toLocaleString("es-AR")}
                </span>
              </div>

              <button
                onClick={() => setStep("method")}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Continuar
              </button>
            </>
          )}

          {/* Step 1.5: Delivery method selection */}
          {step === "method" && (
            <>
              <div className="space-y-3 mb-6">
                {/* Delivery option */}
                {(() => {
                  const reason = !deliveryService?.enabled
                    ? "El restaurante no hace delivery por ahora"
                    : !deliveryService?.openNow
                      ? `Delivery cerrado${deliveryService.nextOpenLabel ? ` · abre ${deliveryService.nextOpenLabel}` : ""}`
                      : null;
                  return (
                    <button
                      type="button"
                      disabled={!deliveryAvailable}
                      onClick={() => { if (!deliveryAvailable) return; setDeliveryMethod("delivery"); setDeliveryResult(null); }}
                      className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        !deliveryAvailable
                          ? "border-border/30 bg-surface-alt opacity-50 cursor-not-allowed"
                          : deliveryMethod === "delivery"
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">🛵</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-text">Delivery</div>
                        <div className="text-xs text-text-muted">{reason || "Te lo llevamos a tu dirección"}</div>
                      </div>
                      <div className="text-sm font-semibold text-primary shrink-0">
                        {deliveryAvailable ? getDeliveryPriceText() : ""}
                      </div>
                    </button>
                  );
                })()}

                {/* Pickup option */}
                {(() => {
                  const reason = !pickupService?.enabled
                    ? "El restaurante no acepta retiros por ahora"
                    : !pickupService?.openNow
                      ? `Retiro cerrado${pickupService.nextOpenLabel ? ` · abre ${pickupService.nextOpenLabel}` : ""}`
                      : null;
                  return (
                    <button
                      type="button"
                      disabled={!pickupAvailable}
                      onClick={() => { if (!pickupAvailable) return; setDeliveryMethod("pickup"); setDeliveryResult(null); setAddress(""); setLatitude(null); setLongitude(null); }}
                      className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        !pickupAvailable
                          ? "border-border/30 bg-surface-alt opacity-50 cursor-not-allowed"
                          : deliveryMethod === "pickup"
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">🏪</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-text">Retiro en Local</div>
                        <div className="text-xs text-text-muted">{reason || "Retirá tu pedido en el restaurante"}</div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-500 shrink-0">
                        {pickupAvailable ? "Gratis" : ""}
                      </div>
                    </button>
                  );
                })()}
              </div>

              {!isAnyOpen && (
                <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <div className="font-semibold mb-0.5">Estamos cerrados ahora</div>
                  {(pickupService?.nextOpenLabel || deliveryService?.nextOpenLabel) && (
                    <div>
                      Abrimos {pickupService?.nextOpenLabel || deliveryService?.nextOpenLabel}. Tu carrito queda guardado — volvé entonces para terminar el pedido.
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep("cart")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={() => setStep("info")}
                  disabled={!isAnyOpen}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isAnyOpen ? "Continuar" : "Cerrado"}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Customer info */}
          {step === "info" && (
            <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">Nombre</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                </div>
                <PhoneInput value={phone} onChange={setPhone} label="Teléfono" placeholder="264 555 1234" required />

                {/* Location picker — only for delivery */}
                {deliveryMethod === "delivery" && (
                  <LocationPicker
                    onLocationConfirm={handleLocationConfirm}
                  />
                )}

                {/* Delivery fee result — only when zones/flat fee configured and calculated */}
                {deliveryMethod === "delivery" && deliveryResult != null && (
                  <div className={`rounded-xl p-4 ${isOutOfRange ? "border border-red-200 bg-red-50" : "border border-emerald-200 bg-emerald-50"}`}>
                    {isOutOfRange ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <div className="text-sm font-bold text-red-700">Fuera del área de delivery</div>
                          <div className="text-xs text-red-600">Estás a {deliveryResult.distanceKm.toFixed(1)} km. Podés elegir retiro en local.</div>
                          <button onClick={() => { setDeliveryMethod("pickup"); setStep("method"); }} className="mt-2 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition-colors">
                            Cambiar a Retiro en Local
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🛵</span>
                          <div>
                            <div className="text-sm font-semibold text-emerald-800">
                              Envío: ${deliveryFee.toLocaleString("es-AR")}
                            </div>
                            <div className="text-xs text-emerald-600">
                              {deliveryResult.zone === "close" ? "Zona cercana" : "Zona lejana"} ({deliveryResult.distanceKm.toFixed(1)} km)
                            </div>
                          </div>
                        </div>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${deliveryResult.zone === "close" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {deliveryResult.zone === "close" ? "Cerca" : "Lejos"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* No pricing configured — consult restaurant */}
                {deliveryMethod === "delivery" && (!hasDeliveryPricing || (address && deliveryResult === null)) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <div>
                        <div className="text-sm font-semibold text-amber-800">Costo de envío a confirmar</div>
                        <div className="text-xs text-amber-600">El restaurante te va a informar el precio del envío por WhatsApp.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pickup info */}
                {deliveryMethod === "pickup" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏪</span>
                      <div>
                        <div className="text-sm font-semibold text-emerald-800">Retiro en Local</div>
                        <div className="text-xs text-emerald-600">Sin costo de envío</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Notas de entrega <span className="text-text-muted font-normal">(opcional)</span>
                  </label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin cebolla, extra salsa, etc." rows={2}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("method")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!name.trim() || !phone.trim() || (deliveryMethod === "delivery" && !address.trim() && latitude === null) || isOutOfRange}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Revisar Pedido
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirm & Send */}
          {step === "confirm" && (
            <>
              <div className="rounded-xl border border-border/50 bg-surface-alt p-4 mb-4">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Resumen</div>
                {items.map((ci) => (
                  <div key={ci.cartKey} className="group py-1 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">{ci.quantity}x {ci.item.name}</span>
                        <span className="font-semibold text-text">${((ci.item.price + ci.optionsDelta) * ci.quantity).toLocaleString("es-AR")}</span>
                      </div>
                      {ci.selectedOptions.length > 0 && (
                        <div className="text-[10px] text-text-muted ml-4">
                          {ci.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")}
                        </div>
                      )}
                      {/* Per-component (promo slot) options on the confirm-step summary */}
                      {ci.componentSelections && ci.componentSelections.length > 0 && (
                        <div className="text-[10px] text-text-muted ml-4 space-y-0.5">
                          {ci.componentSelections.map((comp) => (
                            <div key={comp.componentId}>
                              <span className="font-semibold">↳ {comp.label}:</span>{" "}
                              {comp.selectedOptions.length > 0
                                ? comp.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")
                                : <span className="italic">sin extras</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {ci.note && (
                        <div className="text-[10px] text-text-muted ml-4 italic">
                          Nota: {ci.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { onRemove(ci.cartKey); if (items.length <= 1) setStep("cart"); }}
                      className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                      title="Quitar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {rewardPreview && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                      <span>🎁</span>
                      <span>
                        {cartHasRewardItem
                          ? `${rewardPreview.rewardItemName} gratis (canje)`
                          : `${rewardPreview.rewardItemName} de regalo`}
                      </span>
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {cartHasRewardItem && rewardDiscount > 0
                        ? `−$${rewardDiscount.toLocaleString("es-AR")}`
                        : "GRATIS"}
                    </span>
                  </div>
                )}

                <div className="mt-2 border-t border-border/50 pt-2 flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="font-semibold text-text">${total.toLocaleString("es-AR")}</span>
                </div>

                {/* Gift code entry — collapsed by default. Owner sends the
                    code via WhatsApp; customer types it here. */}
                {codeState.status === "ok" ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">🎁 Código aplicado: {codeState.code}</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">{codeState.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCode}
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2"
                      aria-label="Quitar código"
                    >
                      Quitar
                    </button>
                  </div>
                ) : codeOpen ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onBlur={() => validateCode(codeInput)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validateCode(codeInput); } }}
                        placeholder="XXXX-XXXX"
                        maxLength={9}
                        className="flex-1 rounded-lg border border-border/50 bg-surface-alt px-3 py-2 text-sm uppercase tracking-widest text-text"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => validateCode(codeInput)}
                        disabled={codeState.status === "checking" || !codeInput.trim()}
                        className="rounded-lg bg-primary text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        {codeState.status === "checking" ? "…" : "Aplicar"}
                      </button>
                    </div>
                    {codeState.status === "error" && (
                      <div className="text-[11px] text-red-500">{codeState.message}</div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCodeOpen(true)}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    ¿Tenés un código de descuento?
                  </button>
                )}

                {codeState.status === "ok" && codeState.discountAmount > 0 && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">Descuento (regalo)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">−${codeState.discountAmount.toLocaleString("es-AR")}</span>
                  </div>
                )}

                {deliveryMethod === "delivery" && deliveryFee > 0 && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-text-secondary">Envío ({deliveryResult?.zone === "close" ? "zona cercana" : "zona lejana"})</span>
                    <span className="font-semibold text-text">${deliveryFee.toLocaleString("es-AR")}</span>
                  </div>
                )}
                {deliveryMethod === "delivery" && !hasDeliveryPricing && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-text-secondary">Envío</span>
                    <span className="font-semibold text-amber-500">A confirmar</span>
                  </div>
                )}
                {deliveryMethod === "pickup" && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-text-secondary">Retiro en local</span>
                    <span className="font-semibold text-emerald-600">Gratis</span>
                  </div>
                )}
                <div className="mt-2 border-t border-border/50 pt-2 flex justify-between">
                  <span className="font-bold text-text">Total</span>
                  <span className="text-lg font-extrabold text-text tracking-tight">${grandTotal.toLocaleString("es-AR")}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-surface-alt p-4 mb-6">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Datos de entrega</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Nombre</span>
                    <span className="font-medium text-text">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Teléfono</span>
                    <span className="font-medium text-text">{phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Entrega</span>
                    <span className="font-medium text-text">{deliveryMethod === "pickup" ? "Retiro en local" : "Delivery"}</span>
                  </div>
                  {deliveryMethod === "delivery" && address && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Dirección</span>
                      <span className="font-medium text-text text-right max-w-[60%]">{address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment intent picker */}
              <div className="rounded-xl border border-border/50 bg-surface-alt p-4 mb-4">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">¿Cómo vas a pagar?</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {([
                    { value: "cash" as const, emoji: "💵", label: "Efectivo" },
                    { value: "transfer" as const, emoji: "🏦", label: "Transferencia" },
                    { value: "mercadopago" as const, emoji: "📲", label: "Mercado Pago" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPaymentIntent(opt.value);
                        if (opt.value === "cash") setCheckoutReceiptUrl(null);
                      }}
                      className={`rounded-xl border-2 px-2 py-3 text-center transition-all ${
                        paymentIntent === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="text-2xl mb-0.5">{opt.emoji}</div>
                      <div className="text-[11px] font-semibold text-text leading-tight">{opt.label}</div>
                    </button>
                  ))}
                </div>

                {(paymentIntent === "transfer" || paymentIntent === "mercadopago") && (
                  <div className="mt-3 space-y-3">
                    {/* Alias / CVU / bank info display */}
                    {(mercadoPagoAlias || mercadoPagoCvu || bankInfo) ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                          Datos para transferir
                        </div>
                        {mercadoPagoAlias && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-emerald-700/70">Alias</div>
                              <div className="text-sm font-mono font-bold text-emerald-900 truncate">{mercadoPagoAlias}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(mercadoPagoAlias)}
                              className="shrink-0 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              {copiedAlias ? "✓ Copiado" : "Copiar"}
                            </button>
                          </div>
                        )}
                        {mercadoPagoCvu && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-emerald-700/70">CVU / CBU</div>
                              <div className="text-xs font-mono font-bold text-emerald-900 truncate">{mercadoPagoCvu}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(mercadoPagoCvu)}
                              className="shrink-0 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                        {bankInfo && (
                          <div className="text-[11px] text-emerald-900 leading-relaxed whitespace-pre-wrap">
                            {bankInfo}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                        El restaurante te va a pasar los datos para transferir por WhatsApp.
                      </div>
                    )}

                    {/* Comprobante area — three states:
                          1) canUpload  → full uploader (customer can submit proof now)
                          2) intent is transfer/MP but the resta has no alias/CVU/bankInfo,
                             OR the delivery cost isn't finalized → show a "send it later"
                             explanation instead of asking for an upload that doesn't make
                             sense yet (nothing to transfer to / final total unknown)
                          3) cash → render nothing here, no comprobante involved */}
                    {(() => {
                      const hasPayeeInfo = !!(mercadoPagoAlias || mercadoPagoCvu || bankInfo);
                      const deliveryCostFinalized = !(deliveryMethod === "delivery" && !hasDeliveryPricing);
                      const canUpload = hasPayeeInfo && deliveryCostFinalized;

                      if (canUpload) {
                        return (
                          <div ref={uploadSectionRef}>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                              Comprobante de pago
                            </div>
                            <ComprobanteUploader
                              mode="checkout"
                              initialUrl={checkoutReceiptUrl}
                              onUploaded={(url) => setCheckoutReceiptUrl(url)}
                              onClear={() => setCheckoutReceiptUrl(null)}
                            />
                            <div className="text-[10px] text-text-muted mt-1.5">
                              Subiendo tu comprobante ahora, el restaurante confirma tu pedido sin demoras.
                            </div>
                          </div>
                        );
                      }

                      // State 2 — explain WHY we're not asking for an upload yet + what
                      // happens instead. Pick the reason that applies so the message is
                      // specific (alias missing vs envío sin precio confirmado).
                      const reason = !hasPayeeInfo
                        ? "una vez que el restaurante te pase los datos para transferir"
                        : "una vez que el restaurante te confirme el costo del envío";
                      return (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900">
                          <div className="font-semibold mb-1">Enviar comprobante después</div>
                          <div className="leading-relaxed">
                            Podés enviar la captura del pago por WhatsApp {reason}.
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("info")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={() => {
                    // Soft-intercept: transfer/MP without receipt → nudge first.
                    // Customer can still choose "Enviar igual" — purely additive,
                    // no flow is blocked. Cash orders skip the nudge entirely.
                    // Also skip when there's nothing to transfer to (no alias /
                    // CVU / bankInfo) OR delivery cost isn't finalized — in both
                    // cases the customer literally can't upload a receipt yet, so
                    // nudging them to do so is misleading.
                    const needsReceipt = paymentIntent === "transfer" || paymentIntent === "mercadopago";
                    const hasPayeeInfo = !!(mercadoPagoAlias || mercadoPagoCvu || bankInfo);
                    const deliveryCostFinalized = !(deliveryMethod === "delivery" && !hasDeliveryPricing);
                    const canUpload = hasPayeeInfo && deliveryCostFinalized;
                    if (needsReceipt && canUpload && !checkoutReceiptUrl) {
                      setShowReceiptNudge(true);
                      return;
                    }
                    handleSendWhatsApp();
                  }}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {sending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  )}
                  {sending ? "Enviando..." : "Enviar por WhatsApp"}
                </button>
              </div>

              {/* Soft-intercept nudge — shown only when customer hits Send on a
                  transfer/MP order without an attached receipt. Customer can
                  still proceed without uploading; this is friction, not a wall. */}
              {showReceiptNudge && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={() => setShowReceiptNudge(false)}
                >
                  <div
                    className="rounded-2xl bg-surface border border-border/50 max-w-sm w-full p-5 space-y-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">🧾</div>
                      <h3 className="text-base font-bold text-text">Falta tu comprobante</h3>
                      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                        Subiendo la captura ahora, el restaurante confirma tu pedido sin demoras y empieza a prepararlo enseguida.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReceiptNudge(false);
                          handleSendWhatsApp();
                        }}
                        disabled={sending}
                        className="rounded-xl border border-border px-3 py-3 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
                      >
                        Enviar igual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReceiptNudge(false);
                          // Scroll the upload section into view + soft highlight.
                          uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="rounded-xl bg-emerald-500 px-3 py-3 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
                      >
                        Subir ahora
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 4: Tracking */}
          {step === "tracking" && (
            <div className="py-2">
              <div className="text-center mb-5">
                <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 mb-2">
                  <span className="text-lg font-extrabold text-primary tracking-tight">{trackingOrder?.orderNumber || orderNumber}</span>
                </div>
                <p className="text-xs text-text-muted">
                  {trackingData?.restaurantName || restaurantName}
                </p>
              </div>

              <div className="mb-6">
                <OrderStatusStepper status={trackingStatus as any} />
              </div>

              {/* Order summary if we have tracking data */}
              {trackingData && (
                <div className="rounded-xl border border-border/50 bg-surface-alt p-4 mb-4">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Tu pedido</div>
                  {(trackingData.items as any[])?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-text-secondary">{item.quantity}x {item.name}</span>
                      <span className="font-medium text-text">${item.total?.toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-border/50 pt-2 flex justify-between">
                    <span className="font-bold text-text">Total</span>
                    <span className="font-extrabold text-text">${trackingData.total?.toLocaleString("es-AR")}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {/* Troubleshooting banner — only if order hasn't been confirmed by restaurant */}
                {(trackingStatus === "GENERATED" || !trackingData?.whatsappSent) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-2">
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">⚠️</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-amber-800 mb-1">
                          ¿Enviaste el pedido por WhatsApp?
                        </div>
                        <div className="text-xs text-amber-700 leading-relaxed">
                          El restaurante solo recibe tu pedido cuando mandás el mensaje de WhatsApp.
                          Si WhatsApp no se abrió, o cerraste sin enviar, tocá el botón verde de abajo para reintentarlo.
                          Tu pedido queda guardado con número <strong>{trackingOrder?.orderNumber || orderNumber}</strong>.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Re-send WhatsApp — full order message if we have it, otherwise generic */}
                <button
                  onClick={() => {
                    const phone = trackingData?.restaurantPhone || restaurantPhone;
                    const cleanPhone = formatForWhatsApp(phone) || phone.replace(/[^0-9]/g, "");
                    const num = trackingOrder?.orderNumber || orderNumber;
                    // Prefer cart items if still present; otherwise use snapshot or tracking data
                    const itemsForMessage = items.length > 0 ? items : sentItemsSnapshot;
                    let msg: string;
                    const oidForLink = trackingOrder?.orderId || orderId;
                    const tokForLink = trackingOrder?.token || orderToken;
                    if (num && itemsForMessage.length > 0) {
                      msg = encodeURIComponent(buildWhatsAppMessageFor(num, itemsForMessage, {
                        orderIdForLink: oidForLink,
                        tokenForLink: tokForLink,
                        receiptUploadedAtCheckout: !!checkoutReceiptUrl,
                      }));
                    } else if (num && trackingData?.items) {
                      // Rebuild from tracking data (persisted in DB)
                      msg = encodeURIComponent(buildWhatsAppFromTracking(num, trackingData));
                    } else {
                      msg = encodeURIComponent(`Hola! Consulto por mi pedido en ${trackingData?.restaurantName || restaurantName}`);
                    }
                    window.location.href = `https://wa.me/${cleanPhone}?text=${msg}`;
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  {orderNumber ? "Enviar pedido por WhatsApp" : "Contactar por WhatsApp"}
                </button>

                {/* Close / new order */}
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  {trackingStatus === "DELIVERED" || trackingStatus === "CANCELLED" ? "Cerrar" : "Seguir viendo el menú"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
