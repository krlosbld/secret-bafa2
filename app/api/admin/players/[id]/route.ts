import { NextResponse } from "next/server";
import { applyPoints } from "@/lib/gamePoints";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { findNameCollision, nameCollisionError } from "@/lib/nameCollision";
import { getGameMasterAuth } from "@/lib/gameAccess";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Points, buzz et quota d'un joueur : le maître du jeu de cette session (ou le super-admin).
async function canManageGamePlayer(targetFormationId: string): Promise<boolean> {
  const auth = await getGameMasterAuth();
  return auth.ok && (auth.formationId === null || auth.formationId === targetFormationId);
}

// Prénom, rôle, suppression de la fiche : le directeur de la session (ou le super-admin).
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

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const touchesGame = body.points !== undefined || body.resetBuzz !== undefined || body.buzzQuotaOverride !== undefined;
  const touchesIdentity = body.firstName !== undefined || body.role !== undefined;
  if (body.isGameMaster !== undefined) {
    return NextResponse.json({ error: "Le maître du jeu se change depuis Jeu → Gestion du jeu (directeur)." }, { status: 400 });
  }
  if (touchesGame && !(await canManageGamePlayer(target.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (touchesIdentity && !(await canManagePlayer(target.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Le score passe par le journal (correction manuelle tracée), pas par une écriture directe.
  const newPoints = typeof body.points === "number" && Number.isFinite(body.points) ? Math.max(0, Math.round(body.points)) : null;
  if (body.resetBuzz === true) {
    data.buzzCount = 0;
  }
  if (body.buzzQuotaOverride === null) {
    data.buzzQuotaOverride = null;
  } else if (typeof body.buzzQuotaOverride === "number" && Number.isInteger(body.buzzQuotaOverride)) {
    data.buzzQuotaOverride = Math.min(50, Math.max(1, body.buzzQuotaOverride));
  }
  if (typeof body.firstName === "string" && body.firstName.trim().length > 0) {
    const newFirstName = body.firstName.trim();
    const collision = await findNameCollision(target.formationId, newFirstName, id);
    if (collision) {
      return NextResponse.json({ error: nameCollisionError(collision, newFirstName) }, { status: 409 });
    }
    data.firstName = newFirstName;
  }
  if (body.role === "STAGIAIRE" || body.role === "FORMATEUR" || body.role === "DIRECTEUR") {
    data.role = body.role;
  }
  if (Object.keys(data).length === 0 && newPoints === null) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const actor = newPoints === null ? null : await getGameMasterAuth();
  const updated = await prisma.$transaction(async (tx) => {
    if (newPoints !== null) {
      const [row] = await tx.$queryRaw<{ points: number }[]>`SELECT "points" FROM "Player" WHERE "id" = ${id} FOR UPDATE`;
      const delta = newPoints - (row?.points ?? 0);
      if (delta !== 0) {
        await applyPoints(tx, {
          formationId: target.formationId,
          playerId: id,
          delta,
          kind: "MANUAL_SET",
          key: `manual-set:${crypto.randomUUID()}`,
          actorLabel: actor?.ok ? actor.label : "Administration",
          note: `Score corrigé à ${newPoints}`,
        });
      }
    }
    return Object.keys(data).length > 0 ? tx.player.update({ where: { id }, data }) : tx.player.findUniqueOrThrow({ where: { id } });
  });
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
