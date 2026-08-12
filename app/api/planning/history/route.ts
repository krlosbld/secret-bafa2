import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const snapshots = await prisma.planningSnapshot.findMany({
    where: { formationId: auth.formationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, blocks: true },
  });

  const history = snapshots.map((s) => {
    let count = 0;
    try {
      count = (JSON.parse(s.blocks) as unknown[]).length;
    } catch {
      count = 0;
    }
    return { id: s.id, createdAt: s.createdAt, blockCount: count };
  });

  return NextResponse.json({ ok: true, history });
}
