import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Journal des points de la session (maître du jeu) : les 200 dernières opérations, filtrables par joueur.
export async function GET(req: Request) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const playerId = new URL(req.url).searchParams.get("playerId") || undefined;
  const rows = await prisma.pointTransaction.findMany({
    where: { formationId, ...(playerId ? { playerId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, playerId: true, playerLabel: true, delta: true, balanceAfter: true, kind: true, actorLabel: true, note: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, entries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}
