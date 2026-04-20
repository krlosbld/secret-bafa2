import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE() {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Supprime tout dans l'ordre (buzz → secrets → players)
  await prisma.buzz.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.player.deleteMany();

  return NextResponse.json({ ok: true });
}
