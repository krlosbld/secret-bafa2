import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { matchesName } from "@/lib/nameCollision";

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

      await prisma.$transaction([
        prisma.buzz.update({ where: { id: winner.id }, data: { status: "VALIDATED" } }),
        prisma.player.update({
          where: { id: winner.fromPlayerId },
          // Un faux secret porte directement, dans `bonus`, le nombre total de points choisi par
          // l'admin à sa création — pas le "+2" de base des vrais secrets.
          data: { points: { increment: buzz.secret.isDecoy ? buzz.secret.bonus : 2 + buzz.secret.bonus } },
        }),
        prisma.secret.update({
          where: { id: buzz.secretId },
          data: { status: "FOUND", foundByPlayerId: winner.fromPlayerId },
        }),
        // Rejeter tous les autres buzz sur ce secret (en attente, ou déjà traités par erreur avant
        // que celui-ci soit reconnu comme le bon) — dès que le bon est validé, plus aucun autre buzz
        // sur ce même secret ne doit rester visible comme "à valider".
        prisma.buzz.updateMany({
          where: { secretId: buzz.secretId, id: { not: winner.id } },
          data: { status: "REJECTED" },
        }),
      ]);

      // Chaque personne n'a qu'un seul secret : une fois le sien trouvé, tout autre buzz en attente
      // (sur n'importe quel autre secret de la formation) qui devinait son prénom ne peut plus être
      // correct nulle part — on ne laisse pas ces buzz traîner dans la file à valider.
      const otherPending = await prisma.buzz.findMany({
        where: { status: "PENDING", secretId: { not: buzz.secretId }, secret: { formationId: buzz.secret.formationId } },
        select: { id: true, guessedName: true },
      });
      const staleIds = otherPending
        .filter((b) => matchesName(buzz.secret.player.firstName, b.guessedName))
        .map((b) => b.id);
      if (staleIds.length > 0) {
        await prisma.buzz.updateMany({ where: { id: { in: staleIds } }, data: { status: "REJECTED" } });
      }
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
