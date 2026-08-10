import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const formationId = await getActiveFormationId();

  await prisma.secret.updateMany({
    where: { status: "PENDING", formationId },
    data: { status: "PUBLISHED" },
  });

  return NextResponse.json({ ok: true });
}
