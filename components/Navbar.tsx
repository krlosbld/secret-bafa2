import Link from "next/link";
import { cookies } from "next/headers";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";
import NavSubmitButton from "@/components/NavSubmitButton";

export default async function Navbar() {
  const store = await cookies();
  const role = store.get("auth_role")?.value;
  const until = Number(store.get("auth_until")?.value ?? "0");
  const isAdmin = !!role && Date.now() < until;

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

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link className="brand" href="/">
          KiCéKi 🤫
        </Link>

        <div className="nav-links">
          <NavSubmitButton />
          <Link className="nav-link" href="/">
            Secrets
          </Link>
          <Link className="nav-link" href="/ranking">
            Classement
          </Link>
          <Link className="nav-link" href="/bafa">
            BAFA
          </Link>
          <Link className="nav-link" href={gearHref} title="Administration">
            ⚙️
          </Link>
        </div>
      </div>
    </header>
  );
}
