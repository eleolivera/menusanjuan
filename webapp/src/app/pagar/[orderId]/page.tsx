"use client";

import { useState, useEffect, use as usePromise } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ComprobanteUploader } from "@/components/ComprobanteUploader";

type PaymentStatus = "UNPAID" | "PAID_UNVERIFIED" | "PAID";

type OrderInfo = {
  id: string;
  orderNumber: string;
  restaurantName: string;
  restauranteSlug: string;
  restaurantLogo: string | null;
  total: number;
  deliveryMethod: string;
  deliveryFee: number;
  paymentStatus: PaymentStatus;
  paymentIntent: string | null;
  paymentReceiptUrl: string | null;
  mercadoPagoAlias: string | null;
  mercadoPagoCvu: string | null;
  bankInfo: string | null;
  items: { quantity: number; name: string; total: number }[];
};

/**
 * /pagar/[orderId]?t=<customerAccessToken>
 *
 * Focused single-purpose page for the customer to upload the comprobante after
 * the order has been placed. We get here either from:
 *   - The WhatsApp confirmation message ("🧾 Mandar el comprobante: ...")
 *   - The "Subir comprobante" CTA in /mis-pedidos
 *
 * We do NOT show the full menu / cart — only the resta payment details, totals,
 * and the upload widget.
 */
export default function PagarPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = usePromise(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/track?id=${orderId}&token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No pudimos cargar el pedido. ¿El link es correcto?");
        return;
      }
      const data = await res.json();
      setOrder(data);
    } catch {
      setError("Error de red. Reintentá en unos segundos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setError("Link inválido. Falta el token de acceso.");
      setLoading(false);
      return;
    }
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white p-6">
        <div className="max-w-sm w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h1 className="text-base font-bold text-red-800 mb-1">No pudimos abrir tu pedido</h1>
          <p className="text-xs text-red-700">{error || "Pedido no encontrado."}</p>
          <Link href="/mis-pedidos" className="mt-4 inline-block rounded-lg bg-white border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
            Volver a mis pedidos
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = order.total - (order.deliveryFee || 0);
  const isAlreadyPaid = order.paymentStatus === "PAID";
  const totalFinalized = order.deliveryMethod === "pickup" || (order.deliveryFee != null && order.deliveryFee > 0) || order.deliveryMethod !== "delivery";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="mx-auto max-w-lg flex items-center gap-3 px-4 py-3">
          <Link href="/mis-pedidos" className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            <svg className="h-5 w-5 text-text" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-text">Pagar pedido</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Restaurant + order id */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-4 shadow-sm">
          <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-amber-100">
            {order.restaurantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.restaurantLogo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-lg font-bold text-primary">
                {order.restaurantName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text truncate">{order.restaurantName}</div>
            <div className="text-xs text-text-muted">Pedido {order.orderNumber}</div>
          </div>
        </div>

        {/* Totals breakdown */}
        <div className="rounded-2xl border border-border/50 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">A pagar</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-medium text-text">${subtotal.toLocaleString("es-AR")}</span>
            </div>
            {order.deliveryFee != null && order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Envío</span>
                <span className="font-medium text-text">${order.deliveryFee.toLocaleString("es-AR")}</span>
              </div>
            )}
            {order.deliveryMethod === "pickup" && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Retiro en local</span>
                <span className="font-medium text-emerald-600">Gratis</span>
              </div>
            )}
            <div className="mt-2 border-t border-border/50 pt-2 flex justify-between">
              <span className="font-bold text-text">Total</span>
              <span className="text-lg font-extrabold text-text tracking-tight">${order.total.toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>

        {/* Already paid state */}
        {isAlreadyPaid && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-sm font-bold text-emerald-800">Pago confirmado</div>
            <div className="text-xs text-emerald-700 mt-0.5">El restaurante ya validó tu pago. Ya no hace falta hacer nada más.</div>
          </div>
        )}

        {/* Not finalized — restaurant still owes the customer a delivery quote */}
        {!totalFinalized && !isAlreadyPaid && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-bold text-amber-800 mb-1">⏳ Esperando confirmación de envío</div>
            <div className="text-xs text-amber-700">
              El restaurante todavía no confirmó el costo del envío. Una vez que te lo informe por WhatsApp, vas a poder mandar el comprobante desde acá.
            </div>
          </div>
        )}

        {/* Payment details + uploader */}
        {!isAlreadyPaid && totalFinalized && (
          <>
            {(order.mercadoPagoAlias || order.mercadoPagoCvu || order.bankInfo) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Datos para transferir
                </div>
                {order.mercadoPagoAlias && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-emerald-700/70">Alias</div>
                      <div className="text-base font-mono font-bold text-emerald-900 truncate">{order.mercadoPagoAlias}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(order.mercadoPagoAlias!, "alias")}
                      className="shrink-0 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      {copied === "alias" ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
                {order.mercadoPagoCvu && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-emerald-700/70">CVU / CBU</div>
                      <div className="text-xs font-mono font-bold text-emerald-900 truncate">{order.mercadoPagoCvu}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(order.mercadoPagoCvu!, "cvu")}
                      className="shrink-0 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      {copied === "cvu" ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
                {order.bankInfo && (
                  <div className="text-[12px] text-emerald-900 leading-relaxed whitespace-pre-wrap border-t border-emerald-200 pt-2">
                    {order.bankInfo}
                  </div>
                )}
                <div className="text-[11px] text-emerald-800/70 pt-1 border-t border-emerald-200">
                  Después de transferir, subí la captura del comprobante acá abajo. El restaurante lo va a validar antes de despachar tu pedido.
                </div>
              </div>
            )}

            {/* Uploader */}
            <div className="rounded-2xl border border-border/50 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                {order.paymentStatus === "PAID_UNVERIFIED" ? "Comprobante enviado" : "Subir comprobante"}
              </div>
              {order.paymentStatus === "PAID_UNVERIFIED" && order.paymentReceiptUrl ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={order.paymentReceiptUrl} alt="Comprobante" className="w-full max-h-72 rounded-lg object-contain bg-black/5" />
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                    El restaurante está revisando tu comprobante. Apenas lo confirme vas a recibir la confirmación por WhatsApp.
                  </div>
                  <div className="text-[11px] text-text-muted">¿Subiste la imagen equivocada? Podés reemplazarla:</div>
                  <ComprobanteUploader
                    mode="post-order"
                    orderId={order.id}
                    customerAccessToken={token}
                    onUploaded={() => loadOrder()}
                  />
                </div>
              ) : (
                <ComprobanteUploader
                  mode="post-order"
                  orderId={order.id}
                  customerAccessToken={token}
                  onUploaded={() => loadOrder()}
                />
              )}
            </div>
          </>
        )}

        <Link
          href="/mis-pedidos"
          className="block text-center rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-text hover:bg-surface-hover transition-colors"
        >
          Volver a mis pedidos
        </Link>
      </div>
    </div>
  );
}
