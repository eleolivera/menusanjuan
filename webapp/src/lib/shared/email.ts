/**
 * Shared email utilities for San Juan projects.
 *
 * USAGE:
 *   import { sendEmail, generateCode, verificationEmail, resetPasswordEmail } from "@/lib/shared/email";
 *
 * SETUP:
 *   Set RESEND_API_KEY env var for production email sending.
 *   Without it, emails are logged to console (dev mode).
 *
 * Copy this file into your project at: src/lib/shared/email.ts
 */

export interface EmailConfig {
  fromEmail: string;           // "AutoSanJuan <noreply@autosanjuan.com>"
  brandName: string;           // "AutoSanJuan"
  brandColor: string;          // "#4f46e5"
  brandGradient: string;       // "#4f46e5, #7c3aed"
  brandLetter: string;         // "A"
}

const DEFAULT_CONFIG: EmailConfig = {
  fromEmail: "SanJuan <noreply@sanjuan.com>",
  brandName: "SanJuan",
  brandColor: "#4f46e5",
  brandGradient: "#4f46e5, #7c3aed",
  brandLetter: "S",
};

export async function sendEmail({
  to,
  subject,
  html,
  config,
}: {
  to: string;
  subject: string;
  html: string;
  config?: EmailConfig;
}): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const from = config?.fromEmail || DEFAULT_CONFIG.fromEmail;

  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      return res.ok;
    } catch {
      console.error(`[EMAIL] Failed to send to ${to}`);
      return false;
    }
  }

  console.log(`\n📧 EMAIL TO: ${to}`);
  console.log(`   SUBJECT: ${subject}`);
  console.log(`   BODY: ${html.replace(/<[^>]*>/g, "").substring(0, 200)}`);
  return true;
}

function brandedEmailTemplate(config: EmailConfig, title: string, body: string): string {
  return `
    <div style="font-family: Inter, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
      <div style="background: linear-gradient(135deg, ${config.brandGradient}); border-radius: 12px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <span style="color: white; font-weight: bold; font-size: 24px;">${config.brandLetter}</span>
      </div>
      <h2 style="margin: 0 0 8px; color: #0f172a;">${title}</h2>
      ${body}
    </div>
  `;
}

function codeBlock(code: string, color: string): string {
  return `
    <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: ${color}; font-family: monospace;">${code}</span>
    </div>
  `;
}

export function verificationEmail(code: string, config: EmailConfig = DEFAULT_CONFIG): { subject: string; html: string } {
  return {
    subject: `${code} — Codigo de verificacion ${config.brandName}`,
    html: brandedEmailTemplate(config, "Verificar tu email", `
      <p style="color: #475569; font-size: 14px;">Usa este codigo para verificar tu cuenta en ${config.brandName}:</p>
      ${codeBlock(code, config.brandColor)}
      <p style="color: #94a3b8; font-size: 12px;">Este codigo expira en 10 minutos.</p>
    `),
  };
}

export function resetPasswordEmail(code: string, config: EmailConfig = DEFAULT_CONFIG): { subject: string; html: string } {
  return {
    subject: `${code} — Restablecer contrasena ${config.brandName}`,
    html: brandedEmailTemplate(config, "Restablecer contrasena", `
      <p style="color: #475569; font-size: 14px;">Usa este codigo para cambiar tu contrasena:</p>
      ${codeBlock(code, config.brandColor)}
      <p style="color: #94a3b8; font-size: 12px;">Este codigo expira en 10 minutos.</p>
    `),
  };
}

export function claimCodeEmail(code: string, businessName: string, config: EmailConfig = DEFAULT_CONFIG): { subject: string; html: string } {
  return {
    subject: `${code} — Codigo de verificacion para ${businessName}`,
    html: brandedEmailTemplate(config, `Verificar ${businessName}`, `
      <p style="color: #475569; font-size: 14px;">Usa este codigo para vincular <strong>${businessName}</strong> a tu cuenta en ${config.brandName}:</p>
      ${codeBlock(code, config.brandColor)}
      <p style="color: #94a3b8; font-size: 12px;">Si no solicitaste esto, ignora este email.</p>
    `),
  };
}
