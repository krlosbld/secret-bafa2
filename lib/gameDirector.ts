import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameDirectorAuth } from "@/lib/gameAccess";
import { getGameFormation } from "@/lib/gameFormation";
import { getVerifiedUser } from "@/lib/userSession";
import type { AdminActor } from "@/lib/adminActor";

// Contexte commun au lancement du jeu et au changement de maître du jeu : le directeur de la
// session ouverte (ou le super-admin, sur la session qu'il a ouverte), avec son identité pour le journal.
export async function requireGameDirector(): Promise<{ formationId: string; actor: AdminActor } | NextResponse> {
  const auth = await getGameDirectorAuth();
  if (!auth.ok) return NextResponse.json({ error: "Réservé au directeur de la session." }, { status: 403 });
  const formationId = auth.formationId ?? (await getGameFormation())?.id ?? null;
  if (!formationId) return NextResponse.json({ error: "Aucune session ouverte." }, { status: 409 });
  const user = await getVerifiedUser();
  const actor: AdminActor = user
    ? { kind: auth.formationId ? "directeur" : "superadmin", userId: user.id, label: `${user.firstName} ${user.lastName} <${user.email}>` }
    : { kind: "superadmin", userId: null, label: "Super-admin (.env)" };
  return { formationId, actor };
}

// Le maître du jeu se choisit parmi les directeurs et formateurs rattachés (avec compte) à la session,
// sauf quelqu'un qui participe à la partie : il verrait tous les secrets en jouant.
export async function eligibleGameMaster(formationId: string, playerId: string) {
  const member = await prisma.formationMember.findFirst({
    where: { formationId, playerId, role: { in: ["DIRECTEUR", "FORMATEUR"] } },
    select: { player: { select: { id: true, firstName: true, gameParticipation: true } } },
  });
  if (!member?.player || member.player.gameParticipation === "ACCEPTED") return null;
  return { id: member.player.id, firstName: member.player.firstName };
}
