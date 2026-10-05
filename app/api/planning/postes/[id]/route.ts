import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { libraryOwnerId } from "@/lib/posteLibrary";
import { isValidPosteCategory } from "@/lib/planningConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Un temps de formation ne se modifie ou ne se supprime que dans la liste de son propriétaire.
async function ownPoste(id: string): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const auth = await getPlanningAuth();
  if (!auth.ok) return { ok: false, res: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  const [poste, ownerId] = await Promise.all([
    prisma.posteType.findUnique({ where: { id }, select: { ownerUserId: true, isTemplate: true } }),
    libraryOwnerId(auth.formationId),
  ]);
  if (!poste) return { ok: false, res: NextResponse.json({ error: "Introuvable." }, { status: 404 }) };
  if (poste.isTemplate || !ownerId || poste.ownerUserId !== ownerId) {
    return { ok: false, res: NextResponse.json({ error: "Ce temps de formation appartient à un autre compte." }, { status: 403 }) };
  }
  return { ok: true };
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const own = await ownPoste(id);
  if (!own.ok) return own.res;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.label === "string" && body.label.trim().length > 0) {
    data.label = body.label.trim().slice(0, 40);
  }
  if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
    data.color = body.color;
  }
  if (typeof body.evaluable === "boolean") {
    data.evaluable = body.evaluable;
  }
  if (typeof body.category === "string" && isValidPosteCategory(body.category)) {
    data.category = body.category;
  }
  if (typeof body.countedInHours === "boolean") {
    data.countedInHours = body.countedInHours;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const poste = await prisma.posteType.update({ where: { id }, data }).catch(() => null);
  if (!poste) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, poste });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const own = await ownPoste(id);
  if (!own.ok) return own.res;

  const inUse = await prisma.planningBlock.count({ where: { type: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Ce temps de formation est utilisé par ${inUse} créneau(x) du planning. Supprime-les d'abord.` },
      { status: 409 }
    );
  }

  await prisma.posteType.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
