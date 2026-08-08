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

  const evaluations = await prisma.evaluation.findMany({ where: { playerId } });
  const notes: Record<string, string> = {};
  for (const e of evaluations) notes[e.blockId] = e.note;

  return NextResponse.json({ ok: true, notes });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const blockId = String(body.blockId ?? "");
  const note = String(body.note ?? "").slice(0, 2000);

  if (!playerId || !blockId) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const [player, block] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.planningBlock.findUnique({ where: { id: blockId } }),
  ]);
  if (!player || !block) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const evaluation = await prisma.evaluation.upsert({
    where: { playerId_blockId: { playerId, blockId } },
    update: { note },
    create: { playerId, blockId, note },
  });

  return NextResponse.json({ ok: true, evaluation });
}
