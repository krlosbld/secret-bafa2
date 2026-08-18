import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: { formationId: auth.formationId },
    orderBy: { createdAt: "asc" },
    include: {
      members: { include: { player: { select: { id: true, firstName: true } } } },
      staff: { include: { player: { select: { id: true, firstName: true } } } },
    },
  });

  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: g.members.map((m) => m.player),
    staff: g.staff.map((s) => s.player),
  }));

  return NextResponse.json({ ok: true, groups: result });
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 60) || "Nouveau groupe";

  const group = await prisma.group.create({ data: { formationId: auth.formationId, name } });
  return NextResponse.json({ ok: true, group: { id: group.id, name: group.name, members: [], staff: [] } });
}
