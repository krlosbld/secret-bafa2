import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import NavTabs, { NavTabsStatic } from "@/components/NavTabs";
import LogoutButton from "@/components/LogoutButton";

// Barre du haut commune à tout BafaPilot : Accueil · Mes sessions · Formation · Jeu, puis les accès
// selon les droits (Gestion, Administration) et « Se déconnecter » dès qu'on est connecté.
// Un stagiaire (session ouverte en tant que stagiaire) a sa propre barre, plus simple :
// Accueil · Planning · Ma formation · Jeu (+ Mes sessions s'il en a plusieurs).
export default async function AppNav() {
  const [user, adminSession] = await Promise.all([getVerifiedUser(), getSession()]);
  const loggedIn = !!user || !!adminSession;

  const isGestionnaire = user?.platformRole === "GESTIONNAIRE" && !user.impersonatorId;
  // Le super-admin (compte SUPERADMIN ou accès de secours du .env) n'a pas de session : ses onglets
  // sont ceux de l'administration.
  const isSuperAdmin = !!adminSession && (!user || (user.platformRole === "SUPERADMIN" && !user.impersonatorId));

  let trainee = false;
  let manySessions = false;
  if (user && !isSuperAdmin) {
    const playerSession = await getPlayerSession();
    const [player, sessionCount] = await Promise.all([
      playerSession ? prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true } }) : null,
      prisma.formationMember.count({ where: { userId: user.id } }),
    ]);
    trainee = player?.role === "STAGIAIRE";
    manySessions = sessionCount > 1;
  }
  const variant = isSuperAdmin ? "admin" : trainee ? "trainee" : "member";

  return (
    <header className="app-nav">
      <div className="app-nav__inner">
        <Link href={trainee ? "/bafa" : "/"} className="app-nav__brand" aria-label="BafaPilot — accueil">
          <span className="app-nav__mark" aria-hidden>
            ✦
          </span>
          <span className="app-nav__brand-text">BafaPilot</span>
        </Link>

        {/* Les onglets du stagiaire dépendent de ?tab= : lu côté client, d'où le Suspense. */}
        <Suspense fallback={<NavTabsStatic variant={variant} manySessions={manySessions} />}>
          <NavTabs variant={variant} manySessions={manySessions} />
        </Suspense>

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
