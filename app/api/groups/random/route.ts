import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    return NextResponse.json({ error: "Nombre de groupes invalide (1 à 30)." }, { status: 400 });
  }

  const stagiaires = await prisma.player.findMany({
    where: { formationId: auth.formationId, role: "STAGIAIRE", active: true },
    select: { id: true, firstName: true },
  });

  const shuffled = [...stagiaires];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const buckets: typeof stagiaires[] = Array.from({ length: count }, () => []);
  shuffled.forEach((s, idx) => buckets[idx % count].push(s));

  const created = [];
  for (let i = 0; i < count; i++) {
    const group = await prisma.group.create({
      data: {
        formationId: auth.formationId,
        name: `Groupe ${i + 1}`,
        members: { create: buckets[i].map((s) => ({ playerId: s.id })) },
      },
    });
    created.push({ id: group.id, name: group.name, members: buckets[i], staff: [] });
  }

  return NextResponse.json({ ok: true, groups: created });
}
