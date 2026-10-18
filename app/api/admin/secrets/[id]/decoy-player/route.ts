import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { findNameCollision, nameCollisionError } from "@/lib/nameCollision";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Prénom d'un faux secret (maître du jeu) : le modifier en fait un « faux joueur » visible, qui
// apparaît dans le classement et gagne les points de nuit comme un vrai, jusqu'à la fin de la partie
// où il est révélé. « visible: false » le retire du classement (ses points restent enregistrés).
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const { id } = await params;
  const secret = await prisma.secret.findUnique({ where: { id }, select: { formationId: true, isDecoy: true, playerId: true } });
  if (!secret || secret.formationId !== formationId || !secret.isDecoy) {
    return NextResponse.json({ error: "Faux secret introuvable." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { firstName?: string; fakeVisible?: boolean } = {};
  if (typeof body.firstName === "string") {
    const firstName = body.firstName.trim();
    if (!firstName || firstName.length > 40) return NextResponse.json({ error: "Prénom requis (40 caractères maximum)." }, { status: 400 });
    const collision = await findNameCollision(formationId, firstName, secret.playerId);
    if (collision) return NextResponse.json({ error: nameCollisionError(collision, firstName) }, { status: 409 });
    data.firstName = firstName;
    data.fakeVisible = true; // modifier le prénom le fait apparaître comme un joueur
  }
  if (typeof body.visible === "boolean") data.fakeVisible = body.visible;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucune modification." }, { status: 400 });

  const player = await prisma.player.update({ where: { id: secret.playerId }, data, select: { firstName: true, fakeVisible: true } });
  return NextResponse.json({ ok: true, player });
}
