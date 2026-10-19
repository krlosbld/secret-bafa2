import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Leaders du jour de la session (maître du jeu) : relevé de 9 h, privilège choisi, utilisation.
export async function GET() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const rows = await prisma.leaderDay.findMany({
    where: { formationId },
    orderBy: [{ day: "desc" }, { createdAt: "asc" }],
    select: { id: true, day: true, points: true, choice: true, chosenAt: true, historyUsedAt: true, historySecretId: true, player: { select: { firstName: true } } },
  });
  return NextResponse.json({ ok: true, leaders: rows.map((r) => ({ ...r, chosenAt: r.chosenAt?.toISOString() ?? null, historyUsedAt: r.historyUsedAt?.toISOString() ?? null })) });
}
