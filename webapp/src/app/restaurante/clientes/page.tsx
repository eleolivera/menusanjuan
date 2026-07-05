"use client";

// Customer CRM — one row per customer of THIS restaurant.
//
// Owner sees name / phone / totals / LTV / last-order gap / rewards progress
// + a per-row WhatsApp button that opens their WhatsApp Desktop with a
// pre-filled message via wa.me.
//
// No automated outbound. Every message is a human click.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MessageCircle, Search, Eye, EyeOff, Gift, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { WhatsAppComposerModal, type ComposerCustomer, type ComposerProgram } from "@/components/restaurante/WhatsAppComposerModal";
import type { CustomersResponse, CustomerRow } from "@/app/api/restaurante/customers/route";

type Filter = "all" | "vip" | "recurring" | "new" | "dormant" | "near" | "eligible" | "ready";
type SortKey = "name" | "orders" | "ltv" | "recent" | "punches";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

// Default direction when switching TO this column — for numerics + dates you
// almost always want the "biggest / most recent first" view, but names read
// A→Z by default.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  orders: "desc",
  ltv: "desc",
  recent: "desc",
  punches: "desc",
};

export default function ClientesPage() {
  const router = useRouter();
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [composerFor, setComposerFor] = useState<CustomerRow | null>(null);
  const [page, setPage] = useState(0);

  // Any change to filter/sort/search resets pagination to page 1 so the
  // user isn't stranded on an empty page N after narrowing the list.
  useEffect(() => { setPage(0); }, [filter, sortKey, sortDir, search]);

  // Click same header → toggle direction; click a new one → switch key and
  // reset to that column's natural default direction (numbers desc, names asc).
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  useEffect(() => {
    fetch("/api/restaurante/customers")
      .then(async (r) => {
        if (r.status === 401) { router.push("/restaurante/login"); return null; }
        if (!r.ok) throw new Error(`load failed (${r.status})`);
        return r.json() as Promise<CustomersResponse>;
      })
      .then((d) => { if (d) setData(d); })
      .catch((e) => setError(e instanceof Error ? e.message : "error"));

    // Fetch restaurant name for template variables.
    fetch("/api/restaurante/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (p?.name) setRestaurantName(p.name); })
      .catch(() => {});
  }, [router]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let rows = data.customers;
    if (q) {
      rows = rows.filter((r) => {
        const name = (r.displayName || r.lastCustomerName || "").toLowerCase();
        return name.includes(q) || r.phone.includes(q);
      });
    }
    const needed = data.program?.punchesNeeded ?? Infinity;
    switch (filter) {
      case "vip":
        rows = rows.filter((r) => r.totalOrders >= 5);
        break;
      case "recurring":
        rows = rows.filter((r) => r.totalOrders >= 2 && (r.daysSinceLastOrder ?? Infinity) <= 60);
        break;
      case "new":
        rows = rows.filter((r) => r.totalOrders === 1 && (r.daysSinceLastOrder ?? Infinity) <= 30);
        break;
      case "dormant":
        rows = rows.filter((r) => (r.daysSinceLastOrder ?? 0) >= 30);
        break;
      case "near":
        rows = rows.filter((r) => Number.isFinite(needed) && r.punches >= needed * 0.8 && r.punches < needed);
        break;
      case "eligible":
        rows = rows.filter((r) => Number.isFinite(needed) && r.punches >= needed);
        break;
      case "ready":
        rows = rows.filter((r) => r.redemptionsReady > 0);
        break;
    }
    const sorted = [...rows].sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "ltv": return (a.ltv - b.ltv) * mult;
        case "orders": return (a.totalOrders - b.totalOrders) * mult;
        case "punches": return (a.punches - b.punches) * mult;
        case "name": {
          const an = (a.displayName || a.lastCustomerName || "").toLocaleLowerCase("es-AR");
          const bn = (b.displayName || b.lastCustomerName || "").toLocaleLowerCase("es-AR");
          return an.localeCompare(bn, "es-AR") * mult;
        }
        default: // recent
          return (a.lastOrderAt || "").localeCompare(b.lastOrderAt || "") * mult;
      }
    });
    return sorted;
  }, [data, filter, sortKey, sortDir, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE);

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Clientes</h1>
        <p className="text-red-400">No pude cargar los clientes: {error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="h-full p-8 text-slate-400">Cargando…</div>;
  }
  if (data.customers.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-8 max-w-2xl mx-auto">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2">
          <Users className="h-6 w-6 text-primary" strokeWidth={2} />
          Clientes
        </h1>
        <p className="text-slate-400">Todavía no hay clientes. En cuanto llegue el primer pedido, vas a verlo acá.</p>
      </div>
    );
  }

  const composerProgram: ComposerProgram = data.program
    ? { punchesNeeded: data.program.punchesNeeded, rewardItemName: data.program.rewardItemName }
    : null;

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="p-6 sm:p-8 space-y-6">
      <header>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Users className="h-6 w-6 text-primary" strokeWidth={2} />
          Clientes
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Los que más piden. Un click te abre WhatsApp Desktop con un mensaje listo para revisar y enviar.
        </p>
      </header>

      {/* Analytics header */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Clientes únicos" value={data.totals.uniqueCustomers.toLocaleString("es-AR")} />
        <Stat
          label="Recurrentes"
          value={
            data.totals.uniqueCustomers === 0
              ? "—"
              : `${Math.round((data.totals.recurring / data.totals.uniqueCustomers) * 100)}%`
          }
          hint={`${data.totals.recurring} con 2+ pedidos`}
        />
        <Stat
          label="Pedidos promedio"
          value={data.totals.avgOrdersPerCustomer.toFixed(1)}
          hint="por cliente"
        />
        <Stat
          label="Última compra (mediana)"
          value={data.totals.medianDaysSinceLastOrder == null ? "—" : `${data.totals.medianDaysSinceLastOrder}d`}
          hint="días desde el último pedido"
        />
      </section>

      {data.program && (
        <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <div className="flex items-start gap-3">
            <Gift className="h-5 w-5 text-primary mt-0.5" strokeWidth={2} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                Rewards: {data.program.name}
                {!data.program.enabled && <span className="ml-2 text-xs font-normal text-slate-400">(pausado)</span>}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {data.program.punchesNeeded} pedidos → {data.program.rewardItemName}
                {data.program.qualifyingCount != null && data.program.qualifyingCount > 0 && (
                  <> · restringido a {data.program.qualifyingCount} ítem{data.program.qualifyingCount === 1 ? "" : "s"}</>
                )}
              </div>
            </div>
            <div className="hidden sm:flex gap-6 text-xs text-slate-300">
              <div><span className="font-bold text-white">{data.totals.rewardsEnrolled}</span> con puntos</div>
              <div><span className="font-bold text-white">{data.totals.rewardsHalfway}</span> a mitad</div>
              <div><span className="font-bold text-white">{data.totals.rewardsEligible}</span> listos</div>
              <div><span className="font-bold text-white">{data.totals.redemptionsTotal}</span> canjes</div>
            </div>
          </div>
        </section>
      )}

      {/* Filters + search */}
      <section className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-full rounded-lg bg-slate-900/60 border border-white/10 pl-10 pr-3 py-2 text-sm text-white"
          />
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Ordená clickeando las columnas
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={`Todos (${data.totals.uniqueCustomers})`} />
        <FilterPill active={filter === "vip"} onClick={() => setFilter("vip")} label="VIP (5+ pedidos)" />
        <FilterPill active={filter === "recurring"} onClick={() => setFilter("recurring")} label="Recurrentes" />
        <FilterPill active={filter === "new"} onClick={() => setFilter("new")} label="Nuevos" />
        <FilterPill active={filter === "dormant"} onClick={() => setFilter("dormant")} label="Dormidos (30d+)" />
        {data.program && (
          <>
            <FilterPill active={filter === "near"} onClick={() => setFilter("near")} label={`Cerca del premio (${Math.max(0, data.totals.rewardsHalfway - data.totals.rewardsEligible)})`} />
            <FilterPill active={filter === "eligible"} onClick={() => setFilter("eligible")} label={`Elegibles (${data.totals.rewardsEligible})`} />
            <FilterPill active={filter === "ready"} onClick={() => setFilter("ready")} label="Con premio activo" />
          </>
        )}
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <SortableTh label="Cliente" col="name" active={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
                <th className="text-left px-4 py-3">Teléfono</th>
                <SortableTh label="Pedidos" col="orders" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="LTV" col="ltv" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Último" col="recent" active={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
                {data.program && (
                  <SortableTh label="Progreso" col="punches" active={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
                )}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageRows.map((row) => {
                const isRevealed = revealed.has(row.customerId);
                const name = row.displayName || row.lastCustomerName || "Sin nombre";
                const progress = data.program
                  ? Math.min(1, row.punches / data.program.punchesNeeded)
                  : 0;
                return (
                  <tr key={row.customerId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{name}</div>
                      {row.deliveredOrders !== row.totalOrders && (
                        <div className="text-[11px] text-slate-500">{row.deliveredOrders} entregado{row.deliveredOrders === 1 ? "" : "s"}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRevealed((s) => new Set(s).add(row.customerId))}
                        className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white"
                        disabled={isRevealed}
                        title={isRevealed ? "" : "Click para revelar"}
                      >
                        {isRevealed ? row.phone : maskPhoneFront(row.phone)}
                        {!isRevealed ? <Eye className="h-3.5 w-3.5 opacity-60" /> : <EyeOff className="h-3.5 w-3.5 opacity-40" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">{row.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-white">${row.ltv.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-slate-300">{relativeDays(row.daysSinceLastOrder)}</td>
                    {data.program && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {row.punches}/{data.program.punchesNeeded}
                          </span>
                          {row.redemptionsReady > 0 && (
                            <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5">listo</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setComposerFor(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-1.5 text-xs font-medium"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={data.program ? 7 : 6} className="px-4 py-10 text-center text-slate-500 text-sm">
                    {emptyStateCopy(filter)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination bar */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-xs text-slate-400">
            <div>
              {rangeStart}–{rangeEnd} de {filtered.length.toLocaleString("es-AR")}
              {filtered.length !== data.customers.length && (
                <span className="text-slate-500"> · filtrando {data.customers.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="px-2 text-slate-500">
                Página {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-500">
        Los teléfonos se muestran ocultos por defecto. Usalos solo para atender a tu cliente — no compartas ni exportes esta información.
      </p>

      {composerFor && (
        <WhatsAppComposerModal
          customer={{
            phone: composerFor.phone,
            displayName: composerFor.displayName,
            lastCustomerName: composerFor.lastCustomerName,
            punches: composerFor.punches,
            daysSinceLastOrder: composerFor.daysSinceLastOrder,
            redemptionsReady: composerFor.redemptionsReady,
          } satisfies ComposerCustomer}
          restaurantName={restaurantName}
          program={composerProgram}
          onClose={() => setComposerFor(null)}
        />
      )}
      </div>
    </div>
  );
}

function emptyStateCopy(filter: Filter): string {
  switch (filter) {
    case "vip": return "Todavía no hay clientes con 5+ pedidos.";
    case "recurring": return "No hay recurrentes en este momento.";
    case "new": return "No hay clientes nuevos con pedidos en los últimos 30 días.";
    case "dormant": return "¡Buenas noticias! Ningún cliente lleva más de 30 días sin pedir.";
    case "near": return "Nadie está cerca del premio todavía.";
    case "eligible": return "Todavía no hay clientes que hayan juntado los puntos.";
    case "ready": return "No hay premios activos por canjear.";
    default: return "No hay clientes con este filtro.";
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function SortableTh({
  label, col, active, dir, onClick, align,
}: {
  label: string;
  col: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  align: "left" | "right";
}) {
  const isActive = active === col;
  const alignClass = align === "right" ? "text-right justify-end" : "text-left justify-start";
  return (
    <th className={`${align === "right" ? "text-right" : "text-left"} px-4 py-3`}>
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 ${alignClass} w-full hover:text-white transition-colors ${isActive ? "text-white" : ""}`}
      >
        <span>{label}</span>
        {isActive ? (
          dir === "asc"
            ? <ArrowUp className="h-3 w-3 text-primary" strokeWidth={2.5} />
            : <ArrowDown className="h-3 w-3 text-primary" strokeWidth={2.5} />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" strokeWidth={2} />
        )}
      </button>
    </th>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-primary text-white" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
      }`}
    >
      {label}
    </button>
  );
}

function maskPhoneFront(phone: string): string {
  if (!phone) return "—";
  if (phone.startsWith("google:")) return "—";
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 4)}••••${phone.slice(-3)}`;
}

function relativeDays(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)}m`;
  return `hace ${Math.floor(days / 365)}a`;
}

