import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId requis." }, { status: 400 });
  }

  const auth = await getPlanningAuth();
  if (!auth.ok) {
    const session = await getPlayerSession();
    if (!session || session.playerId !== playerId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
    if (!player || player.formationId !== auth.formationId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const ratings = await prisma.criterionRating.findMany({ where: { playerId } });
  const values: Record<string, string> = {};
  for (const r of ratings) values[`${r.criterionId}:${r.day}`] = r.value;

  return NextResponse.json({ ok: true, values });
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const criterionId = String(body.criterionId ?? "");
  const day = Number(body.day);
  const value = String(body.value ?? "");

  if (!playerId || !criterionId || !Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const [player, criterion, state] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.criterion.findUnique({ where: { id: criterionId } }),
    prisma.criterionState.findUnique({ where: { id: value } }),
  ]);
  if (!player || !criterion || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  if (!state) {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }

  const rating = await prisma.criterionRating.upsert({
    where: { playerId_criterionId_day: { playerId, criterionId, day } },
    update: { value },
    create: { playerId, criterionId, day, value },
  });

  return NextResponse.json({ ok: true, rating });
}

export async function DELETE(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const criterionId = String(body.criterionId ?? "");
  const day = Number(body.day);

  if (!playerId || !criterionId || !Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
  if (!player || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  await prisma.criterionRating.deleteMany({ where: { playerId, criterionId, day } });

  return NextResponse.json({ ok: true });
}
