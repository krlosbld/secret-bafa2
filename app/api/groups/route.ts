import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "stagiaireGroups";

export async function GET() {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formationId = await getActiveFormationId();
  const config = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: KEY } } });
  if (!config) return NextResponse.json({ ok: true, assignment: null });

  try {
    return NextResponse.json({ ok: true, assignment: JSON.parse(config.value) });
  } catch {
    return NextResponse.json({ ok: true, assignment: null });
  }
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const formationId = await getActiveFormationId();

  // Répartition manuelle : { groups: string[][] } (tableaux d'ids de stagiaires)
  if (Array.isArray(body.groups)) {
    const ids = body.groups as unknown[];
    if (!ids.every((g) => Array.isArray(g) && g.every((id) => typeof id === "string"))) {
      return NextResponse.json({ error: "Format de groupes invalide." }, { status: 400 });
    }
    const manualGroups = body.groups as string[][];
    const allIds = manualGroups.flat();
    if (allIds.length === 0) {
      return NextResponse.json({ error: "Aucun stagiaire assigné." }, { status: 400 });
    }

    const players = await prisma.player.findMany({
      where: { id: { in: allIds }, role: "STAGIAIRE", active: true, formationId },
      select: { id: true, firstName: true },
    });
    const byId = new Map(players.map((p) => [p.id, p]));

    const groups: { id: string; firstName: string }[][] = manualGroups.map((ids) =>
      ids.map((id) => byId.get(id)).filter((p): p is { id: string; firstName: string } => !!p)
    );

    const assignment = { groupCount: groups.length, groups, generatedAt: new Date().toISOString() };
    await prisma.config.upsert({
      where: { formationId_key: { formationId, key: KEY } },
      update: { value: JSON.stringify(assignment) },
      create: { formationId, key: KEY, value: JSON.stringify(assignment) },
    });

    return NextResponse.json({ ok: true, assignment });
  }

  // Répartition aléatoire : { groupCount: number }
  const groupCount = Number(body.groupCount);
  if (!Number.isInteger(groupCount) || groupCount < 1) {
    return NextResponse.json({ error: "Nombre de groupes invalide." }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    where: { role: "STAGIAIRE", active: true, formationId },
    select: { id: true, firstName: true },
  });

  if (players.length === 0) {
    return NextResponse.json({ error: "Aucun stagiaire trouvé." }, { status: 400 });
  }
  if (groupCount > players.length) {
    return NextResponse.json(
      { error: `Pas assez de stagiaires (${players.length}) pour ${groupCount} groupes.` },
      { status: 400 }
    );
  }

  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: { id: string; firstName: string }[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((p, idx) => {
    groups[idx % groupCount].push(p);
  });

  const assignment = { groupCount, groups, generatedAt: new Date().toISOString() };
  await prisma.config.upsert({
    where: { formationId_key: { formationId, key: KEY } },
    update: { value: JSON.stringify(assignment) },
    create: { formationId, key: KEY, value: JSON.stringify(assignment) },
  });

  return NextResponse.json({ ok: true, assignment });
}
