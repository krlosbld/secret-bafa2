import nodemailer, { type Transporter } from "nodemailer";

// Service d'envoi d'emails BafaPilot. Tous les paramètres viennent de l'environnement :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL
// Port 465 = TLS direct ; tout autre port = STARTTLS obligatoire (jamais d'envoi en clair).
// Sans configuration SMTP : en développement, l'email est affiché dans la console ; en
// production, l'envoi échoue proprement (erreur journalisée, sendMail renvoie ok: false).

export type MailResult = { ok: true } | { ok: false; reason: "not_configured" | "send_failed" };

let transporter: Transporter | null = null;

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<MailResult> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[mail:dev] À : ${to}\n[mail:dev] Objet : ${subject}\n${text}\n`);
      return { ok: true };
    }
    console.error("MAIL: SMTP non configuré (SMTP_HOST/PORT/USER/PASS/FROM) — email non envoyé à", to);
    return { ok: false, reason: "not_configured" };
  }

  try {
    await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
    return { ok: true };
  } catch (e) {
    console.error("MAIL: échec d'envoi à", to, "—", e instanceof Error ? e.message : e);
    return { ok: false, reason: "send_failed" };
  }
}

// ── Modèles ────────────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, intro: string, buttonLabel: string, link: string, outro: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
        <tr><td style="font-size:20px;font-weight:800;color:#0f766e;padding-bottom:20px">BafaPilot</td></tr>
        <tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px">${intro}</td></tr>
        <tr><td style="padding-bottom:24px">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${buttonLabel}</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#475569;padding-bottom:12px">${outro}</td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(link)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function sendVerificationEmail(to: string, firstName: string, token: string): Promise<MailResult> {
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const subject = "Confirmez votre adresse email — BafaPilot";
  const text = `Bonjour ${firstName},

Bienvenue sur BafaPilot ! Pour activer votre compte, confirmez votre adresse email en ouvrant ce lien :
${link}

Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois.
Si vous n'avez pas créé de compte BafaPilot, ignorez simplement cet email.`;
  const html = layout(
    "Confirmez votre adresse email",
    `Bonjour ${escapeHtml(firstName)},<br><br>Bienvenue sur BafaPilot ! Pour activer votre compte, confirmez votre adresse email.`,
    "Confirmer mon adresse",
    link,
    "Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois. Si vous n'avez pas créé de compte BafaPilot, ignorez simplement cet email."
  );
  return sendMail(to, subject, text, html);
}

export function sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<MailResult> {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const subject = "Réinitialisation de votre mot de passe — BafaPilot";
  const text = `Bonjour ${firstName},

Vous avez demandé à réinitialiser votre mot de passe BafaPilot. Choisissez-en un nouveau en ouvrant ce lien :
${link}

Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.
Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.`;
  const html = layout(
    "Réinitialisation du mot de passe",
    `Bonjour ${escapeHtml(firstName)},<br><br>Vous avez demandé à réinitialiser votre mot de passe BafaPilot.`,
    "Choisir un nouveau mot de passe",
    link,
    "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé."
  );
  return sendMail(to, subject, text, html);
}

export function sendTeamInviteEmail(to: string, sessionName: string, roleLabel: string, token: string): Promise<MailResult> {
  const link = appUrl(`/rejoindre/${encodeURIComponent(token)}`);
  const subject = `Invitation à rejoindre « ${sessionName} » — BafaPilot`;
  const text = `Bonjour,

Vous êtes invité(e) à rejoindre la session « ${sessionName} » sur BafaPilot en tant que ${roleLabel.toLowerCase()}.
Créez votre compte (ou connectez-vous) en ouvrant ce lien : vous serez rattaché(e) automatiquement à la session.
${link}

Ce lien est personnel, valable 7 jours et utilisable une seule fois, avec l'adresse ${to}.`;
  const html = layout(
    `Invitation : ${escapeHtml(sessionName)}`,
    `Bonjour,<br><br>Vous êtes invité(e) à rejoindre la session <strong>${escapeHtml(sessionName)}</strong> sur BafaPilot en tant que <strong>${escapeHtml(roleLabel.toLowerCase())}</strong>. Créez votre compte (ou connectez-vous) : vous serez rattaché(e) automatiquement à la session.`,
    "Rejoindre la session",
    link,
    `Ce lien est personnel, valable 7 jours et utilisable une seule fois, avec l'adresse ${escapeHtml(to)}.`
  );
  return sendMail(to, subject, text, html);
}
