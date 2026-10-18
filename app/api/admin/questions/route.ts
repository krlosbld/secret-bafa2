import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Questions des joueurs (maître du jeu de la session) : en attente, puis les 30 dernières traitées.
export async function GET() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const select = {
    id: true,
    source: true,
    text: true,
    status: true,
    answer: true,
    refusalReason: true,
    answeredBy: true,
    createdAt: true,
    answeredAt: true,
    player: { select: { firstName: true } },
    secret: { select: { content: true, isDecoy: true, player: { select: { firstName: true } } } },
  } as const;
  const [pending, done] = await Promise.all([
    prisma.secretQuestion.findMany({ where: { formationId, status: "PENDING" }, orderBy: { createdAt: "asc" }, select }),
    prisma.secretQuestion.findMany({ where: { formationId, status: { not: "PENDING" } }, orderBy: { answeredAt: "desc" }, take: 30, select }),
  ]);
  return NextResponse.json({ ok: true, pending, done });
}
