import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
type SnapshotBlock = { id: string; day: number; startMin: number; endMin: number; label: string; type: string };

// Restauration purement additive : ne supprime et ne modifie jamais un créneau existant, ne fait
// que recréer (avec son id d'origine) ceux de la photo qui ont disparu depuis. Jamais destructif.
export async function POST(_req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const snapshot = await prisma.planningSnapshot.findUnique({ where: { id } });
  if (!snapshot || snapshot.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let snapshotBlocks: SnapshotBlock[];
  try {
    snapshotBlocks = JSON.parse(snapshot.blocks);
  } catch {
    return NextResponse.json({ error: "Historique corrompu." }, { status: 500 });
  }

  const existing = await prisma.planningBlock.findMany({
    where: { id: { in: snapshotBlocks.map((b) => b.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((b) => b.id));
  const missing = snapshotBlocks.filter((b) => !existingIds.has(b.id));

  if (missing.length > 0) {
    await prisma.planningBlock.createMany({
      data: missing.map((b) => ({
        id: b.id,
        day: b.day,
        startMin: b.startMin,
        endMin: b.endMin,
        label: b.label,
        type: b.type,
        formationId: auth.formationId,
      })),
    });
  }

  return NextResponse.json({ ok: true, restored: missing.length });
}
