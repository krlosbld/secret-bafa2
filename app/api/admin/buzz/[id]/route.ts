import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// PATCH : valider ou rejeter un buzz
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json(); // "validate" | "reject"

  const buzz = await prisma.buzz.findUnique({
    where: { id },
    include: { secret: true },
  });
  if (!buzz) return NextResponse.json({ error: "Buzz introuvable." }, { status: 404 });
  if (auth.formationId && buzz.secret.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (buzz.status !== "PENDING") {
    return NextResponse.json({ error: "Buzz déjà traité." }, { status: 400 });
  }

  if (action === "reject") {
    await prisma.buzz.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "validate") {
    await prisma.buzz.update({ where: { id }, data: { status: "VALIDATED" } });

    if (buzz.isCorrect && buzz.secret.status !== "FOUND") {
      await prisma.$transaction([
        prisma.player.update({
          where: { id: buzz.fromPlayerId },
          data: { points: { increment: 2 + buzz.secret.bonus } },
        }),
        prisma.secret.update({
          where: { id: buzz.secretId },
          data: { status: "FOUND", foundByPlayerId: buzz.fromPlayerId },
        }),
        // Rejeter tous les autres buzz en attente sur ce secret
        prisma.buzz.updateMany({
          where: { secretId: buzz.secretId, status: "PENDING" },
          data: { status: "REJECTED" },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}

// DELETE : supprimer un buzz
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const buzz = await prisma.buzz.findUnique({ where: { id }, select: { secret: { select: { formationId: true } } } });
  if (!buzz) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (auth.formationId && buzz.secret.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    await prisma.buzz.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
