import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setFormationCookie, clearFormationCookie } from "@/lib/formationSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();

  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Code invalide." }, { status: 400 });
  }

  const formation = await prisma.formation.findUnique({ where: { code }, select: { id: true, name: true, active: true } });
  if (!formation) {
    return NextResponse.json({ ok: false, error: "Code inconnu." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, formation });
  setFormationCookie(res, formation.id);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearFormationCookie(res);
  return res;
}
