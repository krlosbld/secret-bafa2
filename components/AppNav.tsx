import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import { getVerifiedUser } from "@/lib/userSession";
import NavTabs from "@/components/NavTabs";
import LogoutButton from "@/components/LogoutButton";

// Barre du haut commune à tout BafaPilot : Accueil · Ma session · Formation · Jeu, puis les accès
// selon les droits (Gestion, Administration) et « Se déconnecter » dès qu'on est connecté.
export default async function AppNav() {
  const [user, adminSession, playerSession, directorAccountSession] = await Promise.all([
    getVerifiedUser(),
    getSession(),
    getPlayerSession(),
    getDirectorAccountSession(),
  ]);
  const loggedIn = !!user || !!adminSession || !!playerSession || !!directorAccountSession;

  let adminHref: string | null = adminSession ? "/admin" : null;
  if (!adminHref && playerSession) {
    const player = await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true } });
    if (player?.role === "DIRECTEUR") adminHref = "/bafa?tab=admin";
  }
  const isGestionnaire = user?.platformRole === "GESTIONNAIRE" && !user.impersonatorId;

  return (
    <header className="app-nav">
      <div className="app-nav__inner">
        <Link href="/" className="app-nav__brand" aria-label="BafaPilot — accueil">
          <span className="app-nav__mark" aria-hidden>
            ✦
          </span>
          <span className="app-nav__brand-text">BafaPilot</span>
        </Link>

        <NavTabs />

        <div className="app-nav__actions">
          {isGestionnaire && (
            <Link href="/gestion" className="app-nav__action">
              Gestion
            </Link>
          )}
          {directorAccountSession && (
            <Link href="/bafa/choisir-formation" className="app-nav__action" title="Changer de formation">
              🔀
            </Link>
          )}
          {adminHref && (
            <Link href={adminHref} className="app-nav__action" title="Administration" aria-label="Administration">
              ⚙️
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
