import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { setFormationCookie } from "@/lib/formationSession";

export const runtime = "nodejs";

// Pose le cookie de contexte formation pour un admin/gestionnaire (session /admin) sans session joueur,
// utilisé quand plusieurs formations sont actives en même temps et qu'il faut lever l'ambiguïté.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const formationId = String(body.formationId ?? "");
  if (!formationId) {
    return NextResponse.json({ error: "formationId requis." }, { status: 400 });
  }

  const formation = await prisma.formation.findUnique({ where: { id: formationId }, select: { id: true, active: true } });
  if (!formation || !formation.active) {
    return NextResponse.json({ error: "Formation introuvable ou inactive." }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  setFormationCookie(res, formation.id);
  return res;
}
