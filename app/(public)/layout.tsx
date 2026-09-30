import Link from "next/link";
import { getVerifiedUser } from "@/lib/userSession";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import "./public.css";

export const dynamic = "force-dynamic";

// Mise en page de l'espace public BafaPilot (accueil, compte, connexion) — volontairement
// distincte de celle du jeu et du BAFA Manager : pas de barre du jeu, pas de fenêtre de règles.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getVerifiedUser();
  // Connexion sans compte BafaPilot (admin du .env, code stagiaire, compte directeur) : on propose
  // quand même de se déconnecter.
  const otherSession = !user && (!!(await getSession()) || !!(await getPlayerSession()) || !!(await getDirectorAccountSession()));

  return (
    <div className="bp">
      <ImpersonationBanner />
      <header className="bp-header">
        <div className="bp-header__inner">
          <Link href="/" className="bp-logo" aria-label="BafaPilot — accueil">
            <span className="bp-logo__mark" aria-hidden>
              ✦
            </span>
            BafaPilot
          </Link>
          <nav className="bp-nav">
            {user ? (
              <>
                {user.platformRole === "GESTIONNAIRE" && !user.impersonatorId && (
                  <Link href="/gestion" className="bp-btn bp-btn--ghost bp-nav__optional">
                    Gestion
                  </Link>
                )}
                {user.platformRole === "SUPERADMIN" && (
                  <Link href="/admin" className="bp-btn bp-btn--ghost bp-nav__optional">
                    Administration
                  </Link>
                )}
                <Link href="/sessions" className="bp-btn bp-btn--ghost">
                  Mes sessions
                </Link>
                <Link href="/logout" className="bp-btn bp-btn--outline">
                  Se déconnecter
                </Link>
              </>
            ) : (
              <>
                {otherSession ? (
                  <Link href="/logout" className="bp-btn bp-btn--outline">
                    Se déconnecter
                  </Link>
                ) : (
                  <Link href="/login" className="bp-btn bp-btn--ghost">
                    Se connecter
                  </Link>
                )}
                <Link href="/register" className="bp-btn bp-btn--primary bp-nav__optional">
                  Créer mon compte
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="bp-main">{children}</main>
      <footer className="bp-footer">BafaPilot · Suivi et pilotage de sessions BAFA</footer>
    </div>
  );
}
