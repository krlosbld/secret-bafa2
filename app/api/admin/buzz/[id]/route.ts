import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// PATCH : valider ou rejeter un buzz
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json(); // "validate" | "reject"

  const buzz = await prisma.buzz.findUnique({
    where: { id },
    include: { secret: true },
  });
  if (!buzz) return NextResponse.json({ error: "Buzz introuvable." }, { status: 404 });
  if (buzz.status !== "PENDING") {
    return NextResponse.json({ error: "Buzz déjà traité." }, { status: 400 });
  }

  if (action === "reject") {
    await prisma.buzz.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "validate") {
    await prisma.buzz.update({ where: { id }, data: { status: "VALIDATED" } });

    if (buzz.isCorrect) {
      await prisma.$transaction([
        prisma.player.update({
          where: { id: buzz.fromPlayerId },
          data: { points: { increment: 2 + buzz.secret.bonus } },
        }),
        prisma.secret.update({
          where: { id: buzz.secretId },
          data: { status: "FOUND", foundByPlayerId: buzz.fromPlayerId },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}

// DELETE : supprimer un buzz
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.buzz.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
