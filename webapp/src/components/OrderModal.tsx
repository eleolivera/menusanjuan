"use client";

import { useState } from "react";
import type { MenuItemData } from "@/data/menus";
import { LocationPicker } from "./LocationPicker";
import { PhoneInput } from "./PhoneInput";
import { formatForWhatsApp } from "@/lib/phone";
import { type DeliveryConfig, calculateDeliveryFee, type DeliveryZoneResult } from "@/lib/delivery";

type CartItem = {
  item: MenuItemData;
  quantity: number;
};

export function OrderModal({
  items,
  total,
  restaurantName,
  restaurantPhone,
  restauranteSlug,
  deliveryConfig,
  onClose,
  onRemove,
  onAdd,
}: {
  items: CartItem[];
  total: number;
  restaurantName: string;
  restaurantPhone: string;
  restauranteSlug: string;
  deliveryConfig?: DeliveryConfig | null;
  onClose: () => void;
  onRemove: (itemId: string) => void;
  onAdd: (itemId: string) => void;
}) {
  const [step, setStep] = useState<"cart" | "method" | "info" | "confirm" | "sent">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderId, setOrderId] = useState("");

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [deliveryResult, setDeliveryResult] = useState<DeliveryZoneResult | null>(null);

  const hasDelivery = deliveryConfig != null && deliveryConfig.deliveryEnabled !== false;
  const deliveryFee = deliveryMethod === "pickup" ? 0 : (deliveryResult?.fee ?? 0);
  const grandTotal = total + deliveryFee;
  const isOutOfRange = deliveryMethod === "delivery" && deliveryResult?.zone === null && deliveryResult !== null;

  // Price range text for delivery option
  function getDeliveryPriceText(): string {
    if (!deliveryConfig) return "";
    if (deliveryConfig.deliveryClosePrice != null && deliveryConfig.deliveryFarPrice != null) {
      return `$${deliveryConfig.deliveryClosePrice.toLocaleString("es-AR")} — $${deliveryConfig.deliveryFarPrice.toLocaleString("es-AR")}`;
    }
    if (deliveryConfig.deliveryClosePrice != null) return `$${deliveryConfig.deliveryClosePrice.toLocaleString("es-AR")}`;
    if (deliveryConfig.deliveryFee != null) return `$${deliveryConfig.deliveryFee.toLocaleString("es-AR")}`;
    return "Gratis";
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

  function buildWhatsAppMessage(orderNum: string) {
    const itemLines = items
      .map(
        (ci) =>
          `  ${ci.quantity}x ${ci.item.name} — $${(ci.item.price * ci.quantity).toLocaleString("es-AR")}`
      )
      .join("\n");

    const methodLabel = deliveryMethod === "pickup" ? "Retiro en local" : "Delivery";
    const deliveryLine = deliveryMethod === "delivery" && deliveryFee > 0
      ? `\n🚛 *Envío:* $${deliveryFee.toLocaleString("es-AR")}${deliveryResult?.zone === "far" ? " (zona lejana)" : ""}`
      : deliveryMethod === "pickup" ? "\n🏪 *Retiro en local* (sin costo de envío)" : "";

    const msg = `🍽️ *Nuevo Pedido — ${restaurantName}*
━━━━━━━━━━━━━━━━━━
📋 *Pedido:* ${orderNum}

${itemLines}

💰 *Subtotal: $${total.toLocaleString("es-AR")}*${deliveryLine}
💰 *Total: $${grandTotal.toLocaleString("es-AR")}*
━━━━━━━━━━━━━━━━━━
👤 *Nombre:* ${name}
📱 *Teléfono:* ${phone}
📦 *Entrega:* ${methodLabel}
${deliveryMethod === "delivery" && address ? `📍 *Dirección:* ${address}` : ""}
${deliveryMethod === "delivery" && latitude && longitude ? `📌 *Mapa:* https://www.google.com/maps?q=${latitude},${longitude}` : ""}
${notes ? `📝 *Notas:* ${notes}` : ""}
━━━━━━━━━━━━━━━━━━
_Pedido realizado desde MenuSanJuan_`;

    return encodeURIComponent(msg);
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
            total: ci.item.price * ci.quantity,
          })),
          total: grandTotal,
          deliveryMethod,
          deliveryFee,
          notes,
        }),
      });

      if (!res.ok) throw new Error("Failed to create order");

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      setOrderId(order.id);

      const cleanPhone = formatForWhatsApp(restaurantPhone) || restaurantPhone.replace(/[^0-9]/g, "");
      const message = buildWhatsAppMessage(order.orderNumber);
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");

      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappSent: true }),
      });

      setStep("sent");
    } catch (err) {
      console.error(err);
      alert("Error al crear el pedido. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-surface px-5 py-4">
          <h2 className="text-lg font-bold text-text">
            {step === "cart" && "Tu Pedido"}
            {step === "method" && "Método de Entrega"}
            {step === "info" && "Tus Datos"}
            {step === "confirm" && "Confirmar Pedido"}
            {step === "sent" && "Pedido Enviado"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Cart review */}
          {step === "cart" && (
            <>
              <div className="space-y-3 mb-6">
                {items.map((ci) => (
                  <div key={ci.item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface-alt p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{ci.item.name}</div>
                      <div className="text-xs text-text-muted">${ci.item.price.toLocaleString("es-AR")} c/u</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onRemove(ci.item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-secondary hover:border-danger hover:text-danger transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                      </button>
                      <span className="min-w-[1.25rem] text-center text-sm font-bold text-text">{ci.quantity}</span>
                      <button onClick={() => onAdd(ci.item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      </button>
                    </div>
                    <div className="text-sm font-bold text-text w-20 text-right">${(ci.item.price * ci.quantity).toLocaleString("es-AR")}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-primary/5 to-orange-50 p-4 mb-5">
                <span className="text-sm font-semibold text-text">Subtotal</span>
                <span className="text-xl font-extrabold text-text tracking-tight">${total.toLocaleString("es-AR")}</span>
              </div>

              <button
                onClick={() => hasDelivery ? setStep("method") : setStep("info")}
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
                <button
                  type="button"
                  onClick={() => { setDeliveryMethod("delivery"); setDeliveryResult(null); }}
                  className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    deliveryMethod === "delivery"
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    🛵
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-text">Delivery</div>
                    <div className="text-xs text-text-muted">Te lo llevamos a tu dirección</div>
                  </div>
                  <div className="text-sm font-semibold text-primary shrink-0">
                    {getDeliveryPriceText()}
                  </div>
                </button>

                {/* Pickup option */}
                <button
                  type="button"
                  onClick={() => { setDeliveryMethod("pickup"); setDeliveryResult(null); setAddress(""); setLatitude(null); setLongitude(null); }}
                  className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    deliveryMethod === "pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">
                    🏪
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-text">Retiro en Local</div>
                    <div className="text-xs text-text-muted">Retirá tu pedido en el restaurante</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-500 shrink-0">
                    Gratis
                  </div>
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("cart")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={() => setStep("info")}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  Continuar
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
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                </div>
                <PhoneInput value={phone} onChange={setPhone} label="Teléfono" placeholder="264 555 1234" required />

                {/* Location picker — only for delivery */}
                {deliveryMethod === "delivery" && (
                  <LocationPicker
                    onLocationConfirm={handleLocationConfirm}
                  />
                )}

                {/* Delivery fee result */}
                {deliveryMethod === "delivery" && deliveryResult && (
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
                    Notas <span className="text-text-muted font-normal">(opcional)</span>
                  </label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin cebolla, extra salsa, etc." rows={2}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(hasDelivery ? "method" : "cart")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!name.trim() || !phone.trim() || (deliveryMethod === "delivery" && !address.trim()) || isOutOfRange}
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
                  <div key={ci.item.id} className="flex justify-between py-1 text-sm">
                    <span className="text-text-secondary">{ci.quantity}x {ci.item.name}</span>
                    <span className="font-semibold text-text">${(ci.item.price * ci.quantity).toLocaleString("es-AR")}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-border/50 pt-2 flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="font-semibold text-text">${total.toLocaleString("es-AR")}</span>
                </div>
                {deliveryMethod === "delivery" && deliveryFee > 0 && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-text-secondary">Envío ({deliveryResult?.zone === "close" ? "zona cercana" : "zona lejana"})</span>
                    <span className="font-semibold text-text">${deliveryFee.toLocaleString("es-AR")}</span>
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

              <div className="flex gap-3">
                <button onClick={() => setStep("info")} className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-surface-hover transition-colors">
                  Volver
                </button>
                <button
                  onClick={handleSendWhatsApp}
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
            </>
          )}

          {/* Step 4: Sent */}
          {step === "sent" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">✅</div>
              <h3 className="text-xl font-bold text-text mb-1">Pedido Enviado</h3>
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1.5 mb-3">
                <span className="text-lg font-extrabold text-primary tracking-tight">{orderNumber}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Tu pedido fue registrado y enviado por WhatsApp a <strong>{restaurantName}</strong>.
              </p>
              <button onClick={onClose} className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
