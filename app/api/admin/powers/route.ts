import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pouvoirs de la session (maître du jeu uniquement) : véritables auteurs, identités empruntées, dates.
export async function GET() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const now = new Date();
  const rows = await prisma.gamePower.findMany({
    where: { formationId },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      kind: true,
      status: true,
      cost: true,
      aliasLabel: true,
      startsAt: true,
      endsAt: true,
      endedAt: true,
      endReason: true,
      player: { select: { firstName: true } },
    },
  });
  const powers = rows.map((p) => ({
    ...p,
    // L'effet dépend de l'heure de fin, même si le traitement automatique n'est pas encore passé.
    status: p.status === "ACTIVE" && p.endsAt <= now ? "EXPIRED" : p.status,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    endedAt: p.endedAt?.toISOString() ?? null,
  }));
  const camouflagedBuzzes = await prisma.buzz.count({ where: { camouflagePowerId: { in: rows.map((r) => r.id) } } });
  return NextResponse.json({ ok: true, powers, camouflagedBuzzes });
}
