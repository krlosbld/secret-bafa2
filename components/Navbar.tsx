import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import { prisma } from "@/lib/prisma";
import NavSubmitButton from "@/components/NavSubmitButton";
import BrandLink from "@/components/BrandLink";

export default async function Navbar() {
  const isAdmin = !!(await getSession());

  let gearHref = "/admin";
  if (!isAdmin) {
    const playerSession = await getPlayerSession();
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
        </div>
      </div>
    </header>
  );
}
