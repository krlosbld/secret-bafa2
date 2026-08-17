import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getPlayerNotes } from "@/lib/playerNotes";
import { mergeOnConflict } from "@/lib/conflictMerge";
import { logTextEdit } from "@/lib/textHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function checkAccess(id: string) {
  const session = await getPlayerSession();
  const isSelf = session?.playerId === id;

  const auth = await getPlanningAuth();
  let staff = false;
  let formationId: string | null = null;
  if (auth.ok) {
    const player = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
    staff = !!player && player.formationId === auth.formationId;
    if (staff) formationId = auth.formationId;
  }

  // Le compte de connexion (formateur/directeur) attribué comme auteur des cases modifiées — null si
  // c'est un accès super-admin/gestionnaire sans compte joueur, auquel cas l'auteur reste inconnu.
  const authorId = staff ? session?.playerId ?? null : null;

  return { staff, isSelf, allowed: staff || isSelf, authorId, formationId };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { staff, allowed } = await checkAccess(id);
  if (!allowed) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const notes = await getPlayerNotes(id, staff);
  if (!notes) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, notes });
}

const TEXT_FIELDS = ["ems", "retourEms", "complementaryNote", "finalAppraisal"] as const;

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { staff, isSelf, allowed, authorId, formationId } = await checkAccess(id);
  if (!allowed) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const saved: Record<string, string> = {};
  const conflicts: string[] = [];
  const historyEntries: { field: string; previousValue: string; newValue: string }[] = [];

  if (isSelf && typeof body.personalNote === "string") {
    data.personalNote = body.personalNote.slice(0, 4000);
  }

  if (staff) {
    const touchedTextFields = TEXT_FIELDS.filter((f) => typeof body[f] === "string");
    if (touchedTextFields.length > 0) {
      const current = await prisma.player.findUnique({ where: { id }, select: { ems: true, retourEms: true, complementaryNote: true, finalAppraisal: true } });
      for (const field of touchedTextFields) {
        const draft = String(body[field]).slice(0, 4000);
        const base = typeof body[`${field}Base`] === "string" ? String(body[`${field}Base`]) : draft;
        const previousValue = current?.[field] ?? "";
        const { value, merged } = mergeOnConflict(previousValue, base, draft);
        data[field] = value;
        data[`${field}AuthorId`] = authorId;
        saved[field] = value;
        if (merged) conflicts.push(field);
        historyEntries.push({ field, previousValue, newValue: value });
      }
    }

    if (typeof body.emsVisible === "boolean") data.emsVisible = body.emsVisible;
    if (typeof body.retourEmsVisible === "boolean") data.retourEmsVisible = body.retourEmsVisible;
    if (typeof body.complementaryVisible === "boolean") data.complementaryVisible = body.complementaryVisible;
    if (
      typeof body.finalOpinion === "string" &&
      ["EN_ATTENTE", "FAVORABLE", "DEFAVORABLE"].includes(body.finalOpinion)
    ) {
      data.finalOpinion = body.finalOpinion;
    }
    if (typeof body.finalAppraisalVisible === "boolean") data.finalAppraisalVisible = body.finalAppraisalVisible;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  await prisma.player.update({ where: { id }, data }).catch(() => null);

  if (formationId) {
    for (const entry of historyEntries) {
      await logTextEdit({
        formationId,
        entityType: entry.field,
        entityKey: id,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
        authorId,
      });
    }
  }

  return NextResponse.json({ ok: true, saved, conflicts });
}
