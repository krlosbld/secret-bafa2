import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { evaluationV2Enabled } from "@/lib/features";
import { loadTrendDetail } from "@/lib/trendData";
import { DEFAULT_SESSION_TYPE, daysForType } from "@/lib/planningConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Détail d'un cercle d'évolution (un stagiaire, un jour) : l'équipe de sa session, ou le stagiaire
// lui-même. Le stagiaire voit les appréciations et les commentaires, jamais les auteurs ni l'historique.
export async function GET(req: Request) {
  if (!evaluationV2Enabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });

  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? "";
  const day = Number(url.searchParams.get("day"));
  if (!playerId || !Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
  if (!player) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const auth = await getPlanningAuth();
  let forStaff = false;
  if (auth.ok && auth.formationId === player.formationId) {
    forStaff = true;
  } else {
    const session = await getPlayerSession();
    if (!session || session.playerId !== playerId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const typeRow = await prisma.config.findUnique({
    where: { formationId_key: { formationId: player.formationId, key: "planningSessionType" } },
  });
  const dayCount = daysForType(typeRow?.value ?? DEFAULT_SESSION_TYPE);
  if (day >= dayCount) return NextResponse.json({ error: "Jour invalide." }, { status: 400 });

  const detail = await loadTrendDetail({ formationId: player.formationId, playerId, day, dayCount, forStaff });
  return NextResponse.json({ ok: true, detail });
}
