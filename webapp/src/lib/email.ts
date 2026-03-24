const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "MenuSanJuan <noreply@menusanjuan.com>";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL DEV] Would send email but RESEND_API_KEY not set`);
    return true; // Pretend success in dev
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      console.error("Email send failed:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email error:", err);
    return false;
  }
}

export function verificationEmailHtml(name: string, code: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; font-size: 24px; font-weight: bold; line-height: 48px;">M</div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 12px 0 4px;">MenuSanJuan</h1>
      </div>
      <p style="font-size: 15px; color: #475569;">Hola <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #475569;">Tu código de verificación es:</p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #fff7ed; border: 2px solid #f97316; border-radius: 12px; padding: 16px 32px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #f97316;">${code}</span>
        </div>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">Este código es válido por 30 minutos. Si no solicitaste esto, ignorá este email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #cbd5e1; text-align: center;">menusanjuan.com</p>
    </div>
  `;
}

export function resetPasswordEmailHtml(name: string, code: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; font-size: 24px; font-weight: bold; line-height: 48px;">M</div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 12px 0 4px;">MenuSanJuan</h1>
      </div>
      <p style="font-size: 15px; color: #475569;">Hola <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #475569;">Recibimos un pedido para restablecer tu contraseña. Tu código es:</p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #fff7ed; border: 2px solid #f97316; border-radius: 12px; padding: 16px 32px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #f97316;">${code}</span>
        </div>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">Este código vence en 10 minutos. Si no lo solicitaste, ignorá este email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #cbd5e1; text-align: center;">menusanjuan.com</p>
    </div>
  `;
}
