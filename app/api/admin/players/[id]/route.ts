import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function canManagePlayer(targetFormationId: string): Promise<boolean> {
  const session = await getSession();
  if (isSuperAdmin(session)) return true;

  const playerSession = await getPlayerSession();
  if (!playerSession) return false;
  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true, formationId: true },
  });
  return player?.role === "DIRECTEUR" && player.formationId === targetFormationId;
}

// PATCH : modifier points ou reset buzz
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const target = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
  if (!target) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (!(await canManagePlayer(target.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.points === "number" && Number.isFinite(body.points)) {
    data.points = Math.max(0, body.points);
  }
  if (body.resetBuzz === true) {
    data.buzzCount = 0;
  }
  if (typeof body.firstName === "string" && body.firstName.trim().length > 0) {
    data.firstName = body.firstName.trim();
  }
  if (body.role === "STAGIAIRE" || body.role === "FORMATEUR" || body.role === "DIRECTEUR") {
    data.role = body.role;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const updated = await prisma.player.update({ where: { id }, data });
  return NextResponse.json({ ok: true, player: updated });
}

// DELETE : supprimer un joueur (cascade sur secret et buzz)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const target = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
  if (!target) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (!(await canManagePlayer(target.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
