import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { getFormationFromCookie } from "@/lib/formationSession";
import { resolveSessionToOpen, openSessionPath } from "@/lib/mySessions";

// Accès à une page de session (Formation, Jeu, Classement) sans session ouverte. Tout passe par le
// compte : connecté → on rouvre sa session (ou on la choisit dans « Ma session ») ; sans session →
// il faut scanner le QR code de la session ; non connecté → se connecter ou créer son compte.
export default async function SessionAccessGate({ next, title }: { next: string; title: string }) {
  const user = await getVerifiedUser();
  if (user) {
    const last = await getFormationFromCookie();
    const target = await resolveSessionToOpen(user.id, last?.id ?? null);
    if (target.kind === "open") redirect(openSessionPath(target.formationId, next));
    if (target.kind === "choose") redirect("/sessions");
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 className="h1">{title}</h1>
        <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          {user ? (
            <>
              <p style={{ fontWeight: 800, margin: 0 }}>Aucune session ne vous est encore attribuée.</p>
              <p style={{ color: "#64748b", margin: 0 }}>Stagiaire : scannez le QR code de votre session pour la rejoindre.</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 800, margin: 0 }}>Connectez-vous avec votre compte BafaPilot.</p>
              <p style={{ color: "#64748b", margin: 0 }}>Pas encore de compte ? Scannez le QR code de votre session pour le créer.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-main" style={{ textDecoration: "none", padding: "9px 16px" }}>
                  Se connecter
                </Link>
                <Link href="/register" className="btn btn-ghost" style={{ textDecoration: "none", padding: "9px 16px" }}>
                  Créer mon compte
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
