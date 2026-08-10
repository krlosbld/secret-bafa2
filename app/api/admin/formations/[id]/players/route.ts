import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { generateUniquePlayerCode } from "@/lib/playerCode";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// POST : créer un code (stagiaire/formateur/directeur) directement dans cette formation
export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id: formationId } = await params;
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName ?? "").trim();
  const role = body.role === "STAGIAIRE" || body.role === "FORMATEUR" || body.role === "DIRECTEUR" ? body.role : "DIRECTEUR";

  if (!firstName) {
    return NextResponse.json({ error: "Prénom requis." }, { status: 400 });
  }

  const code = await generateUniquePlayerCode(formationId);
  const player = await prisma.player.create({
    data: { firstName, code, role, formationId },
    select: { id: true, firstName: true, code: true, role: true },
  });

  return NextResponse.json({ ok: true, player });
}
