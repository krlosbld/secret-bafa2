import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/teamAuth";
import { readJsonBody, str } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

async function load(id: string, formationId: string) {
  const [user, formation] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { email: true, platformRole: true } }),
    prisma.formation.findUnique({ where: { id: formationId }, select: { name: true } }),
  ]);
  return { user, formation };
}

// Attribuer une session à un gestionnaire.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const formationId = str(body.formationId, 50);
  const { user, formation } = await load(id, formationId);
  if (!user || !formation) return NextResponse.json({ error: "Compte ou session introuvable." }, { status: 404 });
  if (user.platformRole !== "GESTIONNAIRE") return NextResponse.json({ error: "Ce compte n'est pas gestionnaire." }, { status: 400 });

  await prisma.managerFormation.upsert({
    where: { userId_formationId: { userId: id, formationId } },
    update: {},
    create: { userId: id, formationId },
  });
  await audit(actor, "MANAGED_FORMATION_ADD", { targetUserId: id, targetLabel: user.email, formationId, details: formation.name });
  return NextResponse.json({ ok: true });
}

// Retirer une session à un gestionnaire.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const formationId = str(body.formationId, 50);
  const { user, formation } = await load(id, formationId);
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  await prisma.managerFormation.deleteMany({ where: { userId: id, formationId } });
  await audit(actor, "MANAGED_FORMATION_REMOVE", { targetUserId: id, targetLabel: user.email, formationId, details: formation?.name ?? null });
  return NextResponse.json({ ok: true });
}
