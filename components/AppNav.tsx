import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getVerifiedUser } from "@/lib/userSession";
import NavTabs from "@/components/NavTabs";
import LogoutButton from "@/components/LogoutButton";

// Barre du haut commune à tout BafaPilot : Accueil · Mes sessions · Formation · Jeu, puis les accès
// selon les droits (Gestion, Administration) et « Se déconnecter » dès qu'on est connecté.
export default async function AppNav() {
  const [user, adminSession] = await Promise.all([getVerifiedUser(), getSession()]);
  const loggedIn = !!user || !!adminSession;

  const isGestionnaire = user?.platformRole === "GESTIONNAIRE" && !user.impersonatorId;
  // Le super-admin (compte SUPERADMIN ou accès de secours du .env) n'a pas de session : ses onglets
  // sont ceux de l'administration.
  const isSuperAdmin = !!adminSession && (!user || (user.platformRole === "SUPERADMIN" && !user.impersonatorId));

  return (
    <header className="app-nav">
      <div className="app-nav__inner">
        <Link href="/" className="app-nav__brand" aria-label="BafaPilot — accueil">
          <span className="app-nav__mark" aria-hidden>
            ✦
          </span>
          <span className="app-nav__brand-text">BafaPilot</span>
        </Link>

        <NavTabs variant={isSuperAdmin ? "admin" : "member"} />

        <div className="app-nav__actions">
          {isGestionnaire && (
            <Link href="/gestion" className="app-nav__action">
              Gestion
            </Link>
          )}
          {loggedIn ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="app-nav__action app-nav__action--primary">
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
