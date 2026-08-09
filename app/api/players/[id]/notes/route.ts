import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getPlayerNotes } from "@/lib/playerNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function checkAccess(id: string) {
  const staff = await canEditPlanning();
  const session = await getPlayerSession();
  const isSelf = session?.playerId === id;
  return { staff, isSelf, allowed: staff || isSelf };
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
  const { staff, isSelf, allowed } = await checkAccess(id);
  if (!allowed) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (isSelf && typeof body.personalNote === "string") {
    data.personalNote = body.personalNote.slice(0, 4000);
  }

  if (staff) {
    if (typeof body.ems === "string") data.ems = body.ems.slice(0, 4000);
    if (typeof body.emsVisible === "boolean") data.emsVisible = body.emsVisible;
    if (typeof body.complementaryNote === "string") data.complementaryNote = body.complementaryNote.slice(0, 4000);
    if (typeof body.complementaryVisible === "boolean") data.complementaryVisible = body.complementaryVisible;
    if (typeof body.finalAppraisal === "string") data.finalAppraisal = body.finalAppraisal.slice(0, 4000);
    if (typeof body.finalAppraisalVisible === "boolean") data.finalAppraisalVisible = body.finalAppraisalVisible;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  await prisma.player.update({ where: { id }, data }).catch(() => null);
  return NextResponse.json({ ok: true });
}
