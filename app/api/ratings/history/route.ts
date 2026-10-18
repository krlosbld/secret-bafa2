import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Historique technique d'une appréciation (anciennes valeurs, commentaires, auteurs, dates) :
// réservé à l'équipe pédagogique de la session, jamais au stagiaire.
export async function GET(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? "";
  const criterionId = url.searchParams.get("criterionId") ?? "";
  const day = Number(url.searchParams.get("day"));
  if (!playerId || !criterionId || !Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
  if (!player || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const rows = await prisma.criterionRatingHistory.findMany({
    where: { formationId: auth.formationId, playerId, criterionId, day },
    orderBy: { changedAt: "desc" },
    take: 50,
  });
  // Anciens états (ancienne échelle) : on montre leur intitulé plutôt que leur identifiant.
  const stateIds = [...new Set(rows.flatMap((r) => [r.previousValue, r.newValue]).filter((v): v is string => !!v))];
  const states = await prisma.criterionState.findMany({ where: { id: { in: stateIds } }, select: { id: true, label: true } });
  const stateLabel = new Map(states.map((s) => [s.id, s.label]));
  const label = (value: string | null, levelLabel: string | null) => levelLabel ?? (value ? stateLabel.get(value) ?? null : null);

  return NextResponse.json({
    ok: true,
    history: rows.map((r) => ({
      id: r.id,
      action: r.action,
      previous: label(r.previousValue, r.previousLabel),
      next: label(r.newValue, r.newLabel),
      previousComment: r.previousComment,
      newComment: r.newComment,
      author: r.authorLabel,
      changedAt: r.changedAt.toISOString(),
    })),
  });
}
