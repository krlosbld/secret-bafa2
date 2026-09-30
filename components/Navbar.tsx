import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import { prisma } from "@/lib/prisma";
import NavSubmitButton from "@/components/NavSubmitButton";
import BrandLink from "@/components/BrandLink";
import LogoutButton from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/userSession";

export default async function Navbar() {
  const isAdmin = !!(await getSession());
  const playerSession = await getPlayerSession();

  let gearHref = "/admin";
  if (!isAdmin) {
    if (playerSession) {
      const player = await prisma.player.findUnique({
        where: { id: playerSession.playerId },
        select: { role: true },
      });
      if (player?.role === "DIRECTEUR") {
        gearHref = "/bafa?tab=admin";
      }
    }
  }

  const directorAccountSession = await getDirectorAccountSession();
  // Connecté d'une façon ou d'une autre (compte, admin, stagiaire/formateur, compte directeur).
  const loggedIn = isAdmin || !!playerSession || !!directorAccountSession || !!(await getCurrentUser());

  return (
    <header className="navbar">
      <div className="nav-container">
        <BrandLink />

        <div className="nav-links">
          <NavSubmitButton />
          <Link className="nav-link" href="/jeu">
            Secrets
          </Link>
          <Link className="nav-link" href="/ranking">
            Classement
          </Link>
          <Link className="nav-link" href="/bafa">
            BAFA
          </Link>
          {directorAccountSession && (
            <Link className="nav-link" href="/bafa/choisir-formation" title="Changer de formation">
              🔀
            </Link>
          )}
          <Link className="nav-link" href={gearHref} title="Administration">
            ⚙️
          </Link>
          {loggedIn && <LogoutButton />}
        </div>
      </div>
    </header>
  );
}
