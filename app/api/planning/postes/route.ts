import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { resolveViewFormationId } from "@/lib/formation";
import { DEFAULT_POSTE_CATEGORY, isValidPosteCategory } from "@/lib/planningConfig";
import { getSessionPostes, libraryOwnerId, sessionFamily } from "@/lib/posteLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temps de formation de la session ouverte : la liste du compte (mine) + ceux posés par d'autres.
// Lecture seule (stagiaire) : seulement ceux posés au planning.
export async function GET() {
  const auth = await getPlanningAuth();
  if (auth.ok) {
    const { postes } = await getSessionPostes(auth.formationId);
    return NextResponse.json({ ok: true, postes });
  }
  const view = await resolveViewFormationId();
  if (!view.ok) return NextResponse.json({ ok: true, postes: [] });
  const usedIds = (
    await prisma.planningBlock.findMany({ where: { formationId: view.formationId }, select: { type: true }, distinct: ["type"] })
  ).map((b) => b.type);
  const postes = await prisma.posteType.findMany({ where: { id: { in: usedIds } }, orderBy: { order: "asc" } });
  return NextResponse.json({ ok: true, postes: postes.map((p) => ({ ...p, mine: false })) });
}

// « Créer un temps de formation » : ajouté à la liste du compte, pour la famille de la session.
export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const [ownerUserId, family] = await Promise.all([libraryOwnerId(auth.formationId), sessionFamily(auth.formationId)]);
  if (!ownerUserId) {
    return NextResponse.json({ error: "Aucun compte auquel rattacher ce temps de formation." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 40);
  const color = String(body.color ?? "").trim();
  const evaluable = body.evaluable === true;
  const countedInHours = body.countedInHours !== false;
  const category =
    typeof body.category === "string" && isValidPosteCategory(body.category) ? body.category : DEFAULT_POSTE_CATEGORY;

  if (!label) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 400 });
  }

  // La liste existe (copie des modèles) avant d'y ajouter quoi que ce soit.
  await getSessionPostes(auth.formationId);
  const count = await prisma.posteType.count({ where: { ownerUserId, family, isTemplate: false } });
  const poste = await prisma.posteType.create({
    data: { label, color, order: count, evaluable, category, countedInHours, ownerUserId, family },
  });

  return NextResponse.json({ ok: true, poste: { ...poste, mine: true } });
}
