import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import { verifyCookie } from "@/lib/signedCookie";
import { ensureMemberPlayer } from "@/lib/team";

// Fiche Player de la personne connectée dans la session ouverte. Tout passe par le compte
// BafaPilot : la fiche est celle du rattachement (FormationMember) du compte à la session ouverte
// (cookie de formation posé par « Ouvrir »). Aucune connexion par code n'existe plus.
export const getPlayerSession = cache(async (): Promise<{ playerId: string } | null> => {
  const user = await getVerifiedUser();
  if (!user) return null;

  const store = await cookies();
  const formation = verifyCookie<{ f: string; u: number }>("bp_formation", store.get("bp_formation")?.value);
  if (!formation || typeof formation.f !== "string" || !Number.isFinite(formation.u) || Date.now() >= formation.u) return null;

  const member = await prisma.formationMember.findUnique({
    where: { formationId_userId: { formationId: formation.f, userId: user.id } },
    select: { id: true, playerId: true },
  });
  if (!member) return null;
  return { playerId: member.playerId ?? (await ensureMemberPlayer(member.id)) };
});

// Anciennes connexions par code (stagiaire/formateur et compte directeur) : leurs cookies sont
// simplement effacés à la connexion et à la déconnexion.
export function clearLegacyLoginCookies(res: NextResponse) {
  for (const name of ["bp_player", "bp_director"]) res.cookies.set(name, "", { maxAge: 0, path: "/" });
}
