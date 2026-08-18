import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.formationId !== auth.formationId || !["FORMATEUR", "DIRECTEUR"].includes(player.role)) {
    return NextResponse.json({ error: "Formateur/directeur introuvable." }, { status: 404 });
  }

  await prisma.groupStaff.upsert({
    where: { groupId_playerId: { groupId: id, playerId } },
    update: {},
    create: { groupId: id, playerId },
  });

  return NextResponse.json({ ok: true, staff: { id: player.id, firstName: player.firstName } });
}
