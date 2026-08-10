import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";

export async function DELETE() {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formationId = await getActiveFormationId();

  // Supprime tout dans l'ordre (buzz → secrets → players), uniquement pour la formation active
  await prisma.buzz.deleteMany({ where: { secret: { formationId } } });
  await prisma.secret.deleteMany({ where: { formationId } });
  await prisma.player.deleteMany({ where: { formationId } });

  return NextResponse.json({ ok: true });
}
