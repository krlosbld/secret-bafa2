import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MIN = 9 * 60; // 09:00
const DAY_MAX = 18 * 60 + 30; // 18:30

function isValidNewBlock(body: Record<string, unknown>): boolean {
  return (
    Number.isInteger(body.day) &&
    (body.day as number) >= 0 &&
    (body.day as number) <= 4 &&
    Number.isInteger(body.startMin) &&
    Number.isInteger(body.endMin) &&
    (body.startMin as number) >= DAY_MIN &&
    (body.endMin as number) <= DAY_MAX &&
    (body.endMin as number) - (body.startMin as number) >= 5 &&
    (body.startMin as number) % 5 === 0 &&
    (body.endMin as number) % 5 === 0 &&
    typeof body.type === "string" &&
    body.type.length > 0 &&
    typeof body.label === "string"
  );
}

export async function GET() {
  const blocks = await prisma.planningBlock.findMany({ orderBy: { startMin: "asc" } });
  return NextResponse.json({ ok: true, blocks });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!isValidNewBlock(body)) {
    return NextResponse.json({ error: "Créneau invalide." }, { status: 400 });
  }

  const block = await prisma.planningBlock.create({
    data: {
      day: body.day,
      startMin: body.startMin,
      endMin: body.endMin,
      label: String(body.label).trim().slice(0, 60) || "Sans titre",
      type: body.type,
    },
  });

  return NextResponse.json({ ok: true, block });
}
