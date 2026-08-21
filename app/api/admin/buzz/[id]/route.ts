import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveWinningBuzz } from "@/lib/buzzResolution";

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
    include: { secret: { include: { player: { select: { firstName: true } } } } },
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
    if (buzz.isCorrect && buzz.secret.status !== "FOUND") {
      // Si plusieurs buzz corrects sont en attente sur ce secret, les points vont au premier
      // chronologiquement — peu importe lequel a été cliqué ici.
      const winner =
        (await prisma.buzz.findFirst({
          where: { secretId: buzz.secretId, status: "PENDING", isCorrect: true },
          orderBy: { createdAt: "asc" },
        })) ?? buzz;

      await resolveWinningBuzz({
        buzzId: winner.id,
        secretId: buzz.secretId,
        fromPlayerId: winner.fromPlayerId,
        secretBonus: buzz.secret.bonus,
        secretIsDecoy: buzz.secret.isDecoy,
        secretPlayerFirstName: buzz.secret.player.firstName,
        formationId: buzz.secret.formationId,
      });
    } else {
      await prisma.buzz.update({ where: { id }, data: { status: "VALIDATED" } });
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
