import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "planningHoursTablePos";

export async function GET() {
  const config = await prisma.config.findUnique({ where: { key: KEY } });
  if (!config) return NextResponse.json({ ok: true, position: null });

  try {
    return NextResponse.json({ ok: true, position: JSON.parse(config.value) });
  } catch {
    return NextResponse.json({ ok: true, position: null });
  }
}

export async function PATCH(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const x = Number(body.x);
  const y = Number(body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "Position invalide." }, { status: 400 });
  }

  const value = JSON.stringify({ x, y });
  await prisma.config.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });

  return NextResponse.json({ ok: true, position: { x, y } });
}
