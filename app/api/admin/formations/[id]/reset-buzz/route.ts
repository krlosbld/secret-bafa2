import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  const { id: formationId } = await params;
  if (!auth.ok || (auth.formationId && auth.formationId !== formationId)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { count } = await prisma.player.updateMany({
    where: { formationId },
    data: { buzzCount: 0 },
  });

  return NextResponse.json({ ok: true, updated: count });
}
