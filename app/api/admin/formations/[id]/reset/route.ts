import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id: formationId } = await params;

  // Supprime tout dans l'ordre (buzz → secrets → players), uniquement pour cette formation
  await prisma.buzz.deleteMany({ where: { secret: { formationId } } });
  await prisma.secret.deleteMany({ where: { formationId } });
  await prisma.player.deleteMany({ where: { formationId } });

  return NextResponse.json({ ok: true });
}
