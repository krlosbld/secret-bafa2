import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { getEvaluationActor } from "@/lib/evaluationActor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Un critère ne se modifie que dans sa propre session, par un directeur de cette session (ou l'admin).
async function sessionCriterion(id: string) {
  const auth = await getPlanningAuth();
  if (!auth.ok || !(await canEditSessionSettings(auth.formationId))) {
    return { ok: false as const, res: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  }
  const criterion = await prisma.criterion.findUnique({ where: { id } });
  if (!criterion || criterion.formationId !== auth.formationId) {
    return { ok: false as const, res: NextResponse.json({ error: "Introuvable." }, { status: 404 }) };
  }
  return { ok: true as const, criterion, formationId: auth.formationId };
}

// Modifications d'un critère :
// - { label } : renommage. S'il porte déjà des notes, le directeur choisit explicitement :
//   renameMode "correct" (simple correction d'intitulé, même critère, l'ancien intitulé est
//   historisé) ou "archive_and_create" (critère différent : l'ancien est archivé avec ses notes, un
//   nouveau critère est créé). Sans choix : 409 avec le nombre de notes concernées.
// - { archived: true|false } : archiver / réactiver.
// - { move: "up"|"down" } : changer l'ordre parmi les critères actifs.
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await sessionCriterion(id);
  if (!check.ok) return check.res;
  const { criterion, formationId } = check;
  const body = await req.json().catch(() => ({}));
  const actor = await getEvaluationActor(formationId);

  if (body.move === "up" || body.move === "down") {
    if (criterion.archivedAt) return NextResponse.json({ error: "Un critère archivé n'a pas de place dans l'ordre." }, { status: 400 });
    const list = await prisma.criterion.findMany({
      where: { formationId, archivedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = list.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = body.move === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= ids.length) return NextResponse.json({ ok: true });
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await prisma.$transaction(ids.map((cid, order) => prisma.criterion.update({ where: { id: cid }, data: { order } })));
    return NextResponse.json({ ok: true });
  }

  if (typeof body.archived === "boolean") {
    const updated = await prisma.criterion.update({
      where: { id },
      data: body.archived ? { archivedAt: new Date(), archivedBy: actor.authorLabel } : { archivedAt: null, archivedBy: null },
    });
    return NextResponse.json({ ok: true, criterion: updated });
  }

  if (typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  const label = body.label.trim().slice(0, 100);
  if (label === criterion.label) return NextResponse.json({ ok: true, criterion });

  const ratingCount = await prisma.criterionRating.count({ where: { criterionId: id } });
  const mode = ratingCount === 0 ? "correct" : body.renameMode;
  if (mode !== "correct" && mode !== "archive_and_create") {
    return NextResponse.json(
      { error: `Ce critère a déjà ${ratingCount} appréciation(s).`, needsChoice: true, ratingCount },
      { status: 409 }
    );
  }

  if (mode === "archive_and_create") {
    const created = await prisma.$transaction(async (tx) => {
      await tx.criterion.update({ where: { id }, data: { archivedAt: new Date(), archivedBy: actor.authorLabel } });
      return tx.criterion.create({ data: { label, order: criterion.order, formationId } });
    });
    return NextResponse.json({ ok: true, archivedId: id, criterion: created });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.criterionLabelHistory.create({
      data: { criterionId: id, previousLabel: criterion.label, newLabel: label, authorId: actor.authorId, authorLabel: actor.authorLabel },
    });
    return tx.criterion.update({ where: { id }, data: { label } });
  });
  return NextResponse.json({ ok: true, criterion: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const check = await sessionCriterion(id);
  if (!check.ok) return check.res;

  // Le critère appartient à cette seule session : ses notes sont celles de cette session. Un critère
  // déjà utilisé ne se supprime jamais (les appréciations resteraient orphelines) : on l'archive.
  const inUse = await prisma.criterionRating.count({ where: { criterionId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Ce critère a déjà ${inUse} appréciation(s) dans cette session : il ne peut pas être supprimé. Archive-le pour ne plus le proposer.` },
      { status: 409 }
    );
  }

  await prisma.criterion.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
