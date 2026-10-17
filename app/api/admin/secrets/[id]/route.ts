import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { getGameMasterAuth } from "@/lib/gameAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const secret = await prisma.secret.findUnique({ where: { id }, select: { formationId: true, status: true, content: true, bonus: true, isDecoy: true } });
  if (!secret) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (auth.formationId && secret.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // Refus d'une proposition : l'auteur pourra en proposer une autre ; la proposition refusée est gardée.
  if (body.status === "REJECTED") {
    if (secret.status !== "PENDING") return NextResponse.json({ error: "Seul un secret en attente peut être refusé." }, { status: 409 });
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!reason && !secret.isDecoy) return NextResponse.json({ error: "Indique le motif du refus : il sera transmis au joueur." }, { status: 400 });
    const master = await getGameMasterAuth();
    await prisma.$transaction([
      prisma.secretRejection.create({
        data: { secretId: id, content: secret.content, bonus: secret.bonus, reason: reason || null, rejectedBy: master.ok ? master.label : null },
      }),
      prisma.secret.update({ where: { id }, data: { status: "REJECTED", limitedVisibility: false } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "PENDING" || body.status === "PUBLISHED" || body.status === "FOUND") {
    data.status = body.status;
  }
  // Les joueurs se limitent à 1-5 en soumettant leur secret (app/api/submit/route.ts) — l'admin peut
  // dépasser ce plafond pour ajuster un bonus après coup si besoin.
  if (typeof body.bonus === "number" && Number.isInteger(body.bonus) && body.bonus >= 1 && body.bonus <= 30) {
    data.bonus = body.bonus;
  }
  if (typeof body.content === "string" && body.content.trim().length > 0) {
    data.content = body.content.trim();
  }
  if (typeof body.limitedVisibility === "boolean") {
    data.limitedVisibility = body.limitedVisibility;
    data.limitedVisibilitySince = body.limitedVisibility ? new Date() : null; // ré-ancre à chaque activation
  }
  if (
    typeof body.limitedVisibilityMinutes === "number" &&
    Number.isInteger(body.limitedVisibilityMinutes) &&
    body.limitedVisibilityMinutes >= 1 &&
    body.limitedVisibilityMinutes <= 59
  ) {
    data.limitedVisibilityMinutes = body.limitedVisibilityMinutes;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  try {
    const updated = await prisma.secret.update({ where: { id }, data });
    return NextResponse.json({ ok: true, secret: updated });
  } catch (e) {
    console.error("ADMIN SECRET PATCH ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const secret = await prisma.secret.findUnique({ where: { id }, select: { formationId: true } });
  if (!secret) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (auth.formationId && secret.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    await prisma.secret.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ADMIN SECRET DELETE ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
