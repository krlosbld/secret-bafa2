import Link from "next/link";
import { peekAuthToken } from "@/lib/authTokens";
import ResetForm from "./ResetForm";

export const metadata = { title: "Nouveau mot de passe — BafaPilot" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; text: string }> = {
  invalid: { title: "Lien invalide", text: "Ce lien de réinitialisation n'est pas valide." },
  used: { title: "Lien déjà utilisé", text: "Ce lien a déjà servi ou a été remplacé par un lien plus récent." },
  expired: { title: "Lien expiré", text: "Les liens de réinitialisation sont valables 1 heure." },
};

// Le lien est seulement vérifié ici (sans être consommé) : il n'est utilisé qu'à l'envoi du
// nouveau mot de passe, pour qu'un antivirus de messagerie qui pré-ouvre le lien ne le grille pas.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const check = token ? await peekAuthToken(token, "RESET_PASSWORD") : ({ ok: false, reason: "invalid" } as const);

  if (check.ok && token) return <ResetForm token={token} />;

  const msg = MESSAGES[check.ok ? "invalid" : check.reason];
  return (
    <div className="bp-auth">
      <div className="bp-card bp-status">
        <div className="bp-status__icon bp-status__icon--error" aria-hidden>
          ⚠️
        </div>
        <h1 className="bp-status__title">{msg.title}</h1>
        <p className="bp-status__text">{msg.text} Demandez un nouveau lien pour choisir votre mot de passe.</p>
        <Link href="/forgot-password" className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg">
          Demander un nouveau lien
        </Link>
      </div>
    </div>
  );
}
