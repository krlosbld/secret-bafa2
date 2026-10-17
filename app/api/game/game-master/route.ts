import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";
import { isGameLaunched } from "@/lib/gameAccess";
import { eligibleGameMaster, requireGameDirector } from "@/lib/gameDirector";

export const runtime = "nodejs";

// « Changer le maître du jeu » (directeur uniquement) : l'ancien perd ses droits immédiatement (ils
// sont recalculés à chaque requête depuis Player.isGameMaster) ; secrets, validations et réglages
// sont conservés.
export async function POST(req: Request) {
  const ctx = await requireGameDirector();
  if (ctx instanceof NextResponse) return ctx;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const { formationId, actor } = ctx;

  if (!(await isGameLaunched(formationId))) return NextResponse.json({ error: "Le jeu n'est pas encore lancé." }, { status: 409 });
  const master = await eligibleGameMaster(formationId, String(body.playerId ?? ""));
  if (!master) return NextResponse.json({ error: "Choisis le maître du jeu parmi l'équipe de la session, hors participants à la partie." }, { status: 400 });

  const previous = await prisma.player.findFirst({ where: { formationId, isGameMaster: true }, select: { firstName: true } });
  await prisma.$transaction([
    prisma.player.updateMany({ where: { formationId, isGameMaster: true }, data: { isGameMaster: false } }),
    prisma.player.update({ where: { id: master.id }, data: { isGameMaster: true } }),
  ]);
  await audit(actor, "GAME_MASTER_CHANGED", { formationId, details: `${previous?.firstName ?? "aucun"} → ${master.firstName}` });
  return NextResponse.json({ ok: true });
}
