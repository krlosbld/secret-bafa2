import Link from "next/link";
import { getVerifiedUser } from "@/lib/userSession";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import AppNav from "@/components/AppNav";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import "./public.css";

export const dynamic = "force-dynamic";

// Mise en page de l'espace public BafaPilot (accueil, compte, connexion, Ma session). Connecté —
// de n'importe quelle façon — on retrouve la barre commune Accueil · Ma session · Formation · Jeu ;
// sinon, un en-tête simple centré sur « Se connecter » / « Créer mon compte ».
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const loggedIn =
    !!(await getVerifiedUser()) || !!(await getSession()) || !!(await getPlayerSession()) || !!(await getDirectorAccountSession());

  return (
    <div className="bp">
      <ImpersonationBanner />
      {loggedIn ? (
        <AppNav />
      ) : (
        <header className="bp-header">
          <div className="bp-header__inner">
            <Link href="/" className="bp-logo" aria-label="BafaPilot — accueil">
              <span className="bp-logo__mark" aria-hidden>
                ✦
              </span>
              BafaPilot
            </Link>
            <nav className="bp-nav">
              <Link href="/login" className="bp-btn bp-btn--ghost">
                Se connecter
              </Link>
              <Link href="/register" className="bp-btn bp-btn--primary bp-nav__optional">
                Créer mon compte
              </Link>
            </nav>
          </div>
        </header>
      )}
      <main className="bp-main">{children}</main>
      <footer className="bp-footer">BafaPilot · Suivi et pilotage de sessions BAFA</footer>
    </div>
  );
}
