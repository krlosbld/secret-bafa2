import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { generateUniquePlayerCode } from "@/lib/playerCode";
import { findNameCollision, nameCollisionError } from "@/lib/nameCollision";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName ?? "").trim();
  const content = String(body.content ?? "").trim();
  const points = Number(body.points ?? 0);

  if (!firstName || !content) {
    return NextResponse.json({ error: "Prénom et contenu obligatoires." }, { status: 400 });
  }
  if (firstName.length > 40 || content.length > 800) {
    return NextResponse.json({ error: "Texte trop long." }, { status: 400 });
  }
  if (!Number.isInteger(points) || points < 1 || points > 20) {
    return NextResponse.json({ error: "Le nombre de points doit être entre 1 et 20." }, { status: 400 });
  }

  const collision = await findNameCollision(formationId, firstName);
  if (collision) {
    return NextResponse.json({ error: nameCollisionError(collision, firstName) }, { status: 409 });
  }

  const code = await generateUniquePlayerCode(formationId);

  const player = await prisma.player.create({
    data: {
      firstName,
      code,
      formationId,
      role: "STAGIAIRE",
      active: false,
      secret: {
        create: { formationId, content, bonus: points, isDecoy: true, status: "PENDING" },
      },
    },
    include: { secret: true },
  });

  return NextResponse.json({ ok: true, secret: player.secret });
}
