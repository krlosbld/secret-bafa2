import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import { findActiveInvite } from "@/lib/invites";
import { formatDateRange, openSessionPath } from "@/lib/mySessions";
import JoinButton from "./JoinButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rejoindre une session — BafaPilot" };

// Page ouverte en scannant le QR code d'une session : créer son compte (ou se connecter) puis être
// rattaché automatiquement en Stagiaire.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findActiveInvite(token);

  if (!invite) {
    return (
      <div className="bp-auth">
        <div className="bp-card bp-status">
          <div className="bp-status__icon bp-status__icon--error" aria-hidden>
            ⚠️
          </div>
          <h1 className="bp-status__title">Lien d&apos;invitation invalide</h1>
          <p className="bp-status__text">Ce lien n&apos;existe pas ou a été remplacé. Demandez le nouveau QR code à votre directeur ou directrice.</p>
        </div>
      </div>
    );
  }

  const f = invite.formation;
  const user = await getVerifiedUser();
  const already = user
    ? await prisma.formationMember.findUnique({ where: { formationId_userId: { formationId: f.id, userId: user.id } }, select: { id: true } })
    : null;

  return (
    <div className="bp-auth">
      <h1 className="bp-auth__title">Rejoindre la session</h1>
      <p className="bp-auth__sub">
        Vous êtes invité(e) à rejoindre cette session en tant que {({ DIRECTEUR: "directeur", FORMATEUR: "formateur" } as Record<string, string>)[invite.role] ?? "stagiaire"}.
        {invite.email && (
          <>
            <br />
            Invitation personnelle pour <strong>{invite.email}</strong>.
          </>
        )}
      </p>
      <div className="bp-card">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{f.name}</div>
          <div style={{ color: "var(--bp-muted)", marginTop: 4 }}>
            {[f.location, formatDateRange(f.startDate, f.endDate)].filter(Boolean).join(" · ")}
          </div>
        </div>

        {user ? (
          already ? (
            <div className="bp-stack">
              <div className="bp-alert bp-alert--info">Vous faites déjà partie de cette session.</div>
              <Link href={openSessionPath(f.id)} className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg">
                Ouvrir la session
              </Link>
            </div>
          ) : (
            <div className="bp-stack">
              <p style={{ margin: 0, textAlign: "center", color: "var(--bp-muted)" }}>
                Connecté en tant que <strong style={{ color: "var(--bp-ink)" }}>{user.firstName} {user.lastName}</strong>
              </p>
              <JoinButton token={token} allowLegacyCode={!invite.email && invite.role === "STAGIAIRE"} />
            </div>
          )
        ) : (
          <div className="bp-stack">
            <Link href={`/register?invite=${encodeURIComponent(token)}`} className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg">
              Créer mon compte
            </Link>
            <Link href={`/login?next=${encodeURIComponent(`/rejoindre/${token}`)}`} className="bp-btn bp-btn--outline bp-btn--block">
              J&apos;ai déjà un compte
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
