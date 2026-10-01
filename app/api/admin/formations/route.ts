import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { generateUniqueFormationCode } from "@/lib/formationCode";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, code: true, active: true, createdAt: true, _count: { select: { players: true } } },
  });

  return NextResponse.json({ ok: true, formations });
}

// Nouvelle formation : seulement son nom. Le type, les dates et le lieu se règlent ensuite dans sa
// fiche, l'équipe s'ajoute par comptes BafaPilot (Équipe → Ajouter un membre) et les stagiaires
// la rejoignent avec le QR code. Le code interne de la formation n'est plus communiqué à personne.
export async function POST(req: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const formation = await prisma.formation.create({
    data: { name, code: await generateUniqueFormationCode(), active: true },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, formation });
}
