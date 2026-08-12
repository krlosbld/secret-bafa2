import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "stagiaireGroups";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formationId = auth.formationId;
  const config = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: KEY } } });
  if (!config) return NextResponse.json({ ok: true, assignment: null });

  try {
    return NextResponse.json({ ok: true, assignment: JSON.parse(config.value) });
  } catch {
    return NextResponse.json({ ok: true, assignment: null });
  }
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.groups)) {
    return NextResponse.json({ error: "Format de groupes invalide." }, { status: 400 });
  }

  const rawGroups = body.groups as unknown[];
  const valid = rawGroups.every(
    (g) =>
      g && typeof g === "object" &&
      typeof (g as { name?: unknown }).name === "string" &&
      Array.isArray((g as { ids?: unknown }).ids) &&
      (g as { ids: unknown[] }).ids.every((id) => typeof id === "string")
  );
  if (!valid) {
    return NextResponse.json({ error: "Format de groupes invalide." }, { status: 400 });
  }
  const inputGroups = rawGroups as { name: string; ids: string[] }[];
  const baseGeneratedAt = typeof body.baseGeneratedAt === "string" ? body.baseGeneratedAt : null;

  const formationId = auth.formationId;

  // Détecte un enregistrement concurrent : si quelqu'un d'autre a sauvegardé entre le chargement
  // de cette session et maintenant, on refuse d'écraser silencieusement son travail.
  const existing = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: KEY } } });
  if (existing) {
    let existingGeneratedAt: string | null = null;
    try {
      existingGeneratedAt = JSON.parse(existing.value)?.generatedAt ?? null;
    } catch {
      existingGeneratedAt = null;
    }
    if (existingGeneratedAt && existingGeneratedAt !== baseGeneratedAt) {
      return NextResponse.json(
        {
          error: "Quelqu'un d'autre a modifié les groupes entre-temps. Recharge la page avant d'enregistrer à nouveau.",
          conflict: true,
        },
        { status: 409 }
      );
    }
  }

  const allIds = inputGroups.flatMap((g) => g.ids);
  const players = await prisma.player.findMany({
    where: { id: { in: allIds }, role: "STAGIAIRE", active: true, formationId },
    select: { id: true, firstName: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));

  const groups = inputGroups.map((g) => ({
    name: g.name.trim().slice(0, 60) || "Groupe",
    members: g.ids.map((id) => byId.get(id)).filter((p): p is { id: string; firstName: string } => !!p),
  }));

  const assignment = { groups, generatedAt: new Date().toISOString() };
  await prisma.config.upsert({
    where: { formationId_key: { formationId, key: KEY } },
    update: { value: JSON.stringify(assignment) },
    create: { formationId, key: KEY, value: JSON.stringify(assignment) },
  });

  return NextResponse.json({ ok: true, assignment });
}
