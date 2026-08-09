import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId requis." }, { status: 400 });
  }

  const staff = await canEditPlanning();
  if (!staff) {
    const session = await getPlayerSession();
    if (!session || session.playerId !== playerId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const ratings = await prisma.criterionRating.findMany({ where: { playerId } });
  const values: Record<string, string> = {};
  for (const r of ratings) values[`${r.criterionId}:${r.day}`] = r.value;

  return NextResponse.json({ ok: true, values });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
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
  if (!player || !criterion) {
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
