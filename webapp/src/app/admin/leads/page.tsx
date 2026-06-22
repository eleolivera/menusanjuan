import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// MVP admin view for referral leads. Simple table sorted by createdAt desc.
// Kanban + drag-drop + per-stage queues ship in the next iteration per plan;
// for now this just gives the admin a single page to scan + click into details.
export default async function AdminLeadsPage() {
  const session = await verifyAdminSession();
  if (!session) redirect("/admin");

  const leads = await prisma.referralLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stages = leads.reduce(
    (acc, l) => {
      acc[l.stage] = (acc[l.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referidos</h1>
            <p className="text-sm text-slate-400">
              {leads.length} leads · {stages.SUBMITTED || 0} pendientes
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
          >
            ← Admin
          </Link>
        </header>

        {leads.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-10 text-center text-slate-400">
            Todavía no hay referidos. Compartí{" "}
            <code className="text-primary">menusanjuan.com/referidos/nuevo</code> con sales reps.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Resta</th>
                  <th className="px-4 py-3 text-left">Referido por</th>
                  <th className="px-4 py-3 text-left">Stage</th>
                  <th className="px-4 py-3 text-left">Menú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((l) => {
                  const menu = Array.isArray(l.menuFiles)
                    ? (l.menuFiles as Array<{ url: string; kind: string; filename: string }>)
                    : [];
                  return (
                    <tr key={l.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("es-AR", {
                          timeZone: "America/Argentina/Buenos_Aires",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{l.restaName}</div>
                        {l.restaAddress && (
                          <div className="text-[11px] text-slate-400">{l.restaAddress}</div>
                        )}
                        {(l.restaPhone || l.restaInstagram) && (
                          <div className="text-[11px] text-slate-500">
                            {l.restaPhone && (
                              <a
                                href={`https://wa.me/${l.restaPhone.replace(/[^0-9]/g, "")}`}
                                className="text-emerald-400 hover:underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                WA
                              </a>
                            )}
                            {l.restaPhone && l.restaInstagram && " · "}
                            {l.restaInstagram && (
                              <a
                                href={`https://instagram.com/${l.restaInstagram.replace(/^@/, "")}`}
                                className="text-pink-400 hover:underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                IG
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">{l.referrerName}</div>
                        <a
                          href={`https://wa.me/${l.referrerPhone.replace(/[^0-9]/g, "")}`}
                          className="text-[11px] text-emerald-400 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {l.referrerPhone}
                        </a>
                        {l.referrerMpAlias && (
                          <div className="text-[11px] text-slate-500">MP: {l.referrerMpAlias}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StagePill stage={l.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {menu.slice(0, 4).map((m, i) =>
                            m.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a
                                key={i}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={m.url}
                                  alt={m.filename}
                                  className="h-10 w-10 rounded object-cover border border-white/10"
                                />
                              </a>
                            ) : (
                              <a
                                key={i}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="h-10 w-10 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 border border-white/10"
                              >
                                PDF
                              </a>
                            ),
                          )}
                          {menu.length > 4 && (
                            <span className="self-center text-xs text-slate-500">+{menu.length - 4}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StagePill({ stage }: { stage: string }) {
  const styles: Record<string, string> = {
    SUBMITTED: "bg-amber-500/15 text-amber-300",
    IN_REVIEW: "bg-blue-500/15 text-blue-300",
    DEMO_READY: "bg-purple-500/15 text-purple-300",
    CONVERTED: "bg-emerald-500/15 text-emerald-300",
    REJECTED: "bg-red-500/15 text-red-300",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${styles[stage] || "bg-slate-500/15 text-slate-300"}`}>
      {stage}
    </span>
  );
}
