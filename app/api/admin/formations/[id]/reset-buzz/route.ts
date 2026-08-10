import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id: formationId } = await params;
  const { count } = await prisma.player.updateMany({
    where: { formationId },
    data: { buzzCount: 0 },
  });

  return NextResponse.json({ ok: true, updated: count });
}
