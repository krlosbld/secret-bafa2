import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getPlayerNotes } from "@/lib/playerNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function checkAccess(id: string) {
  const session = await getPlayerSession();
  const isSelf = session?.playerId === id;

  const auth = await getPlanningAuth();
  let staff = false;
  if (auth.ok) {
    const player = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
    staff = !!player && player.formationId === auth.formationId;
  }

  // Le compte de connexion (formateur/directeur) attribué comme auteur des cases modifiées — null si
  // c'est un accès super-admin/gestionnaire sans compte joueur, auquel cas l'auteur reste inconnu.
  const authorId = staff ? session?.playerId ?? null : null;

  return { staff, isSelf, allowed: staff || isSelf, authorId };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { staff, allowed } = await checkAccess(id);
  if (!allowed) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const notes = await getPlayerNotes(id, staff);
  if (!notes) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, notes });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { staff, isSelf, allowed, authorId } = await checkAccess(id);
  if (!allowed) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (isSelf && typeof body.personalNote === "string") {
    data.personalNote = body.personalNote.slice(0, 4000);
  }

  if (staff) {
    if (typeof body.ems === "string") {
      data.ems = body.ems.slice(0, 4000);
      data.emsAuthorId = authorId;
    }
    if (typeof body.emsVisible === "boolean") data.emsVisible = body.emsVisible;
    if (typeof body.retourEms === "string") {
      data.retourEms = body.retourEms.slice(0, 4000);
      data.retourEmsAuthorId = authorId;
    }
    if (typeof body.retourEmsVisible === "boolean") data.retourEmsVisible = body.retourEmsVisible;
    if (typeof body.complementaryNote === "string") {
      data.complementaryNote = body.complementaryNote.slice(0, 4000);
      data.complementaryNoteAuthorId = authorId;
    }
    if (typeof body.complementaryVisible === "boolean") data.complementaryVisible = body.complementaryVisible;
    if (
      typeof body.finalOpinion === "string" &&
      ["EN_ATTENTE", "FAVORABLE", "DEFAVORABLE"].includes(body.finalOpinion)
    ) {
      data.finalOpinion = body.finalOpinion;
    }
    if (typeof body.finalAppraisal === "string") {
      data.finalAppraisal = body.finalAppraisal.slice(0, 4000);
      data.finalAppraisalAuthorId = authorId;
    }
    if (typeof body.finalAppraisalVisible === "boolean") data.finalAppraisalVisible = body.finalAppraisalVisible;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  await prisma.player.update({ where: { id }, data }).catch(() => null);
  return NextResponse.json({ ok: true });
}
