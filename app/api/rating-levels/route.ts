import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { evaluationV2Enabled } from "@/lib/features";
import { getSessionLevels } from "@/lib/ratingLevels";
import { getEvaluationActor } from "@/lib/evaluationActor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Intitulés des 3 appréciations de la session ouverte. Seul l'intitulé change, jamais le niveau
// technique ni l'ordre ; chaque changement est historisé ; les autres sessions ne sont pas touchées.
export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const levels = await getSessionLevels(auth.formationId);
  const history = await prisma.ratingLevelLabelHistory.findMany({
    where: { ratingLevel: { formationId: auth.formationId } },
    orderBy: { changedAt: "desc" },
    take: 30,
    include: { ratingLevel: { select: { level: true } } },
  });
  return NextResponse.json({
    ok: true,
    levels: levels.map((l) => ({ level: l.level, label: l.label })),
    history: history.map((h) => ({
      level: h.ratingLevel.level,
      previousLabel: h.previousLabel,
      newLabel: h.newLabel,
      author: h.authorLabel,
      changedAt: h.changedAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request) {
  if (!evaluationV2Enabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const auth = await getPlanningAuth();
  if (!auth.ok || !(await canEditSessionSettings(auth.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const level = Number(body.level);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : "";
  if (![1, 2, 3].includes(level)) return NextResponse.json({ error: "Niveau invalide." }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Intitulé requis." }, { status: 400 });

  const levels = await getSessionLevels(auth.formationId);
  const current = levels.find((l) => l.level === level)!;
  if (levels.some((l) => l.level !== level && l.label.toLowerCase() === label.toLowerCase())) {
    return NextResponse.json({ error: "Deux appréciations ne peuvent pas porter le même intitulé." }, { status: 400 });
  }
  if (current.label === label) return NextResponse.json({ ok: true });

  const actor = await getEvaluationActor(auth.formationId);
  await prisma.$transaction([
    prisma.ratingLevelLabelHistory.create({
      data: { ratingLevelId: current.id, previousLabel: current.label, newLabel: label, authorId: actor.authorId, authorLabel: actor.authorLabel },
    }),
    prisma.ratingLevel.update({ where: { id: current.id }, data: { label } }),
  ]);
  return NextResponse.json({ ok: true });
}
