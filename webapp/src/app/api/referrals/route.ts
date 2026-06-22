// Public lead-capture endpoint. Anyone can POST a referral. Rate-limited
// by IP to prevent spam.
//
// Body shape (JSON):
// {
//   referrerName, referrerEmail?, referrerPhone, referrerMpAlias?,
//   restaName, restaAddress?, restaPhone?, restaInstagram?, restaNotes?,
//   menuFiles: [{ url, kind: "image"|"pdf", filename }]
// }
//
// Side effects: persists ReferralLead row, fires confirmation email to
// referrer (if email provided) + notification email to admin.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { isValidPhone, formatForWhatsApp } from "@/lib/phone";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "magnicommerce@gmail.com";

export async function POST(request: NextRequest) {
  // Rate limit BEFORE parsing the body so spammers get cheap rejects.
  const limit = authLimiter(getClientIp(request));
  if (!limit.allowed) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const referrerName = str("referrerName").slice(0, 100);
  const referrerEmail = str("referrerEmail").slice(0, 120) || null;
  const referrerPhoneRaw = str("referrerPhone");
  const referrerMpAlias = str("referrerMpAlias").slice(0, 80) || null;
  const restaName = str("restaName").slice(0, 120);
  const restaAddress = str("restaAddress").slice(0, 250) || null;
  const restaPhoneRaw = str("restaPhone");
  const restaInstagram = str("restaInstagram").slice(0, 100) || null;
  const restaNotes = str("restaNotes").slice(0, 1000) || null;

  if (!referrerName) return NextResponse.json({ error: "missing_referrerName" }, { status: 400 });
  if (!referrerPhoneRaw || !isValidPhone(referrerPhoneRaw)) {
    return NextResponse.json({ error: "invalid_referrerPhone" }, { status: 400 });
  }
  if (!restaName) return NextResponse.json({ error: "missing_restaName" }, { status: 400 });

  // Resta phone is optional; if provided, validate.
  if (restaPhoneRaw && !isValidPhone(restaPhoneRaw)) {
    return NextResponse.json({ error: "invalid_restaPhone" }, { status: 400 });
  }

  // Normalize phones to a consistent format. formatForWhatsApp returns digits
  // with country code, suitable for wa.me deep links + payout reference.
  const referrerPhone = formatForWhatsApp(referrerPhoneRaw) || referrerPhoneRaw;
  const restaPhone = restaPhoneRaw ? formatForWhatsApp(restaPhoneRaw) || restaPhoneRaw : null;

  // Validate menuFiles. Accept only URLs from our own R2 bucket — anyone could
  // craft an array, so we don't allow arbitrary domains.
  const rawFiles = Array.isArray(body.menuFiles) ? (body.menuFiles as unknown[]) : [];
  const menuFiles: Array<{ url: string; kind: "image" | "pdf"; filename: string }> = [];
  for (const f of rawFiles.slice(0, 8)) {
    if (!f || typeof f !== "object") continue;
    const ff = f as Record<string, unknown>;
    const url = typeof ff.url === "string" ? ff.url : null;
    const kindRaw = ff.kind === "pdf" ? "pdf" : "image";
    const filename = typeof ff.filename === "string" ? ff.filename.slice(0, 80) : "menu";
    if (!url || !url.startsWith("https://images.menusanjuan.com/")) continue;
    menuFiles.push({ url, kind: kindRaw, filename });
  }
  if (menuFiles.length === 0) {
    return NextResponse.json({ error: "missing_menu" }, { status: 400 });
  }

  const accessToken = crypto.randomBytes(16).toString("hex");

  const lead = await prisma.referralLead.create({
    data: {
      referrerName,
      referrerEmail,
      referrerPhone,
      referrerMpAlias,
      restaName,
      restaAddress,
      restaPhone,
      restaInstagram,
      restaNotes,
      menuFiles: menuFiles as unknown as object,
      accessToken,
    },
    select: { id: true, accessToken: true },
  });

  // Fire-and-forget notifications. Don't block the response on email failures.
  notifyAdminAndReferrer({
    leadId: lead.id,
    referrerName,
    referrerEmail,
    referrerPhone,
    restaName,
    restaAddress,
    restaPhone,
    restaInstagram,
    restaNotes,
    menuFiles,
  }).catch((e) => console.error("referral notification failed:", e));

  return NextResponse.json({ ok: true, id: lead.id, accessToken: lead.accessToken }, { status: 201 });
}

async function notifyAdminAndReferrer(p: {
  leadId: string;
  referrerName: string;
  referrerEmail: string | null;
  referrerPhone: string;
  restaName: string;
  restaAddress: string | null;
  restaPhone: string | null;
  restaInstagram: string | null;
  restaNotes: string | null;
  menuFiles: Array<{ url: string; kind: string; filename: string }>;
}) {
  const menuLinks = p.menuFiles
    .map((f, i) => `<li><a href="${f.url}">${f.filename || `Menu ${i + 1}`} (${f.kind})</a></li>`)
    .join("");

  // 1. Admin notification — direct line so the GF / admin sees new leads right away
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🆕 Nuevo referido: ${p.restaName} (de ${p.referrerName})`,
    html: `
      <h2>Nuevo referido</h2>
      <p><strong>Referido por:</strong> ${escape(p.referrerName)} — ${escape(p.referrerPhone)}${p.referrerEmail ? ` — ${escape(p.referrerEmail)}` : ""}</p>
      <hr>
      <h3>Restaurante</h3>
      <p><strong>Nombre:</strong> ${escape(p.restaName)}</p>
      ${p.restaAddress ? `<p><strong>Dirección:</strong> ${escape(p.restaAddress)}</p>` : ""}
      ${p.restaPhone ? `<p><strong>WhatsApp:</strong> ${escape(p.restaPhone)}</p>` : ""}
      ${p.restaInstagram ? `<p><strong>Instagram:</strong> ${escape(p.restaInstagram)}</p>` : ""}
      ${p.restaNotes ? `<p><strong>Notas:</strong> ${escape(p.restaNotes)}</p>` : ""}
      <h3>Menú</h3>
      <ul>${menuLinks}</ul>
      <hr>
      <p><a href="https://menusanjuan.com/admin/leads">Ver en /admin/leads</a></p>
    `,
  }).catch(() => false);

  // 2. Confirmation to the referrer (only if they gave us an email)
  if (p.referrerEmail) {
    await sendEmail({
      to: p.referrerEmail,
      subject: `Recibimos tu referido — ${p.restaName}`,
      html: `
        <p>¡Hola ${escape(p.referrerName)}!</p>
        <p>Recibimos tu referido de <strong>${escape(p.restaName)}</strong>. Nuestro equipo lo va a revisar y armar un kit de venta personalizado para que se lo puedas mostrar al dueño.</p>
        <p>Te escribimos en las próximas 24-48 hs con los materiales listos.</p>
        <p>Saludos,<br>MenuSanJuan</p>
      `,
    }).catch(() => false);
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}
