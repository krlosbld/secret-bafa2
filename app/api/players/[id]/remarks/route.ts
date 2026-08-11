import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const auth = await getPlanningAuth();
  if (!auth.ok) {
    const session = await getPlayerSession();
    if (!session || session.playerId !== id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else {
    const player = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
    if (!player || player.formationId !== auth.formationId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const remarks = await prisma.dailyRemark.findMany({ where: { playerId: id } });
  const notes: Record<number, string> = {};
  for (const r of remarks) notes[r.day] = r.note;

  return NextResponse.json({ ok: true, notes });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const day = Number(body.day);
  const note = String(body.note ?? "").slice(0, 2000);

  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Jour invalide." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const remark = await prisma.dailyRemark.upsert({
    where: { playerId_day: { playerId: id, day } },
    update: { note },
    create: { playerId: id, day, note },
  });

  return NextResponse.json({ ok: true, remark });
}
