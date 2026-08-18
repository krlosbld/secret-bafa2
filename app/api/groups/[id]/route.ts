import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function loadOwnedGroup(id: string, formationId: string) {
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.formationId !== formationId) return null;
  return group;
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const group = await loadOwnedGroup(id, auth.formationId);
  if (!group) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const updated = await prisma.group.update({ where: { id }, data: { name: body.name.trim().slice(0, 60) } });
  return NextResponse.json({ ok: true, group: { id: updated.id, name: updated.name } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const group = await loadOwnedGroup(id, auth.formationId);
  if (!group) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
