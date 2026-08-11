import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const block = await prisma.planningBlock.findUnique({ where: { id }, select: { formationId: true } });
  if (!block || block.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Créneau introuvable." }, { status: 404 });
  }

  const [stagiaires, assignments, evaluations] = await Promise.all([
    prisma.player.findMany({
      where: { role: "STAGIAIRE", active: true, formationId: block.formationId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true },
    }),
    prisma.blockAssignment.findMany({ where: { blockId: id }, select: { playerId: true } }),
    prisma.evaluation.findMany({
      where: { blockId: id, note: { not: "" } },
      select: { playerId: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    stagiaires,
    assignedIds: assignments.map((a) => a.playerId),
    evaluatedIds: evaluations.map((e) => e.playerId),
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const block = await prisma.planningBlock.findUnique({ where: { id }, select: { formationId: true } });
  if (!block || block.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Créneau introuvable." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const rawPlayerIds = Array.isArray(body.playerIds) ? body.playerIds.filter((v: unknown) => typeof v === "string") : null;
  if (rawPlayerIds === null) {
    return NextResponse.json({ error: "playerIds requis (tableau)." }, { status: 400 });
  }

  // Ne garder que les stagiaires appartenant réellement à la formation de ce créneau.
  const validPlayers = await prisma.player.findMany({
    where: { id: { in: rawPlayerIds }, formationId: block.formationId },
    select: { id: true },
  });
  const playerIds = validPlayers.map((p) => p.id);

  await prisma.$transaction([
    prisma.blockAssignment.deleteMany({ where: { blockId: id } }),
    ...(playerIds.length > 0
      ? [
          prisma.blockAssignment.createMany({
            data: playerIds.map((playerId: string) => ({ blockId: id, playerId })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, assignedIds: playerIds });
}
