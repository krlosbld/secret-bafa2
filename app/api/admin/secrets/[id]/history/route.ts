import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const secret = await prisma.secret.findUnique({ where: { id }, select: { formationId: true } });
  if (!secret) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (auth.formationId && secret.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const buzzes = await prisma.buzz.findMany({
    where: { secretId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      guessedName: true,
      isCorrect: true,
      status: true,
      createdAt: true,
      fromPlayer: { select: { firstName: true, code: true } },
    },
  });

  return NextResponse.json({ ok: true, buzzes });
}
