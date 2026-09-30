import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/authTokens";
import { hashToken } from "@/lib/userSession";
import { ResendVerification } from "../_components/ui";

export const metadata = { title: "Confirmation de l'adresse email — BafaPilot" };
export const dynamic = "force-dynamic";

type Outcome = { kind: "ok" } | { kind: "already" } | { kind: "expired"; email: string } | { kind: "invalid" };

async function verify(token: string): Promise<Outcome> {
  const result = await consumeAuthToken(token, "VERIFY_EMAIL");
  if (result.ok) {
    await prisma.user.updateMany({ where: { id: result.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    return { kind: "ok" };
  }
  if (result.reason === "invalid") return { kind: "invalid" };

  // Lien déjà utilisé ou expiré : si l'adresse est déjà confirmée (ex. lien ouvert une 2e fois, ou
  // pré-ouvert par un antivirus de messagerie), on le dit simplement.
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { user: { select: { email: true, emailVerifiedAt: true } } },
  });
  if (row?.user.emailVerifiedAt) return { kind: "already" };
  if (result.reason === "expired" && row) return { kind: "expired", email: row.user.email };
  return { kind: "invalid" };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const outcome: Outcome = token ? await verify(token) : { kind: "invalid" };

  const ok = outcome.kind === "ok" || outcome.kind === "already";
  return (
    <div className="bp-auth">
      <div className="bp-card bp-status">
        <div className={`bp-status__icon${ok ? "" : " bp-status__icon--error"}`} aria-hidden>
          {ok ? "✅" : "⚠️"}
        </div>

        {outcome.kind === "ok" && (
          <>
            <h1 className="bp-status__title">Adresse email confirmée</h1>
            <p className="bp-status__text">Votre compte BafaPilot est activé. Vous pouvez maintenant vous connecter.</p>
          </>
        )}
        {outcome.kind === "already" && (
          <>
            <h1 className="bp-status__title">Adresse déjà confirmée</h1>
            <p className="bp-status__text">Votre adresse email a déjà été confirmée. Vous pouvez vous connecter.</p>
          </>
        )}
        {outcome.kind === "expired" && (
          <>
            <h1 className="bp-status__title">Ce lien a expiré</h1>
            <p className="bp-status__text">
              Les liens de confirmation sont valables 24 heures. Demandez-en un nouveau : il sera envoyé à <strong>{outcome.email}</strong>.
            </p>
            <ResendVerification email={outcome.email} />
          </>
        )}
        {outcome.kind === "invalid" && (
          <>
            <h1 className="bp-status__title">Lien de confirmation invalide</h1>
            <p className="bp-status__text">
              Ce lien n&apos;est pas valide ou a été remplacé par un lien plus récent. Utilisez le dernier email reçu, ou connectez-vous pour en demander un
              nouveau.
            </p>
          </>
        )}

        {ok ? (
          <Link href="/login?notice=verified" className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg">
            Se connecter
          </Link>
        ) : (
          <p className="bp-links">
            <Link href="/login" className="bp-link">
              Aller à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
