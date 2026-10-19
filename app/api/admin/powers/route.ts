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
      stakeOutcome: true,
      stakeWinnerId: true,
      player: { select: { firstName: true } },
      bountyHits: { select: { fromPlayerId: true, amount: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  // Prénoms des gagnants de mise et des adversaires qui ont versé (maître du jeu uniquement).
  const ids = [...new Set(rows.flatMap((r) => [r.stakeWinnerId, ...r.bountyHits.map((h) => h.fromPlayerId)]).filter((x): x is string => !!x))];
  const names = new Map((await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true } })).map((p) => [p.id, p.firstName]));
  const powers = rows.map(({ stakeWinnerId, bountyHits, ...p }) => ({
    ...p,
    stakeWinner: stakeWinnerId ? names.get(stakeWinnerId) ?? "?" : null,
    hits: bountyHits.map((h) => ({ from: names.get(h.fromPlayerId) ?? "?", amount: h.amount, at: h.createdAt.toISOString() })),
    // L'effet dépend de l'heure de fin, même si le traitement automatique n'est pas encore passé.
    status:
      p.status === "ACTIVE" && p.endsAt <= now
        ? p.kind === "BOUNTY" && !p.stakeOutcome
          ? "AWAITING" // 24 h écoulées, une bonne réponse envoyée pendant la mise attend la validation
          : "EXPIRED"
        : p.status,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    endedAt: p.endedAt?.toISOString() ?? null,
  }));
  const camouflagedBuzzes = await prisma.buzz.count({ where: { camouflagePowerId: { in: rows.map((r) => r.id) } } });
  return NextResponse.json({ ok: true, powers, camouflagedBuzzes });
}
