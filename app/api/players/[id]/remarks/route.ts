import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { resolveAuthorNames } from "@/lib/authorNames";
import { mergeOnConflict } from "@/lib/conflictMerge";
import { logTextEdit } from "@/lib/textHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const auth = await getPlanningAuth();
  const isStaff = auth.ok;
  if (!auth.ok) {
    const session = await getPlayerSession();
    if (!session || session.playerId !== id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else {
    const player = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
    if (!player || player.formationId !== auth.formationId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const remarks = await prisma.dailyRemark.findMany({ where: { playerId: id } });
  const notes: Record<number, string> = {};
  for (const r of remarks) notes[r.day] = r.note;

  // L'auteur n'est renvoyé que côté staff — jamais exposé au stagiaire lui-même.
  let authors: Record<number, string | null> = {};
  if (isStaff) {
    const authorNames = await resolveAuthorNames(remarks.map((r) => r.authorId));
    authors = Object.fromEntries(remarks.map((r) => [r.day, r.authorId ? authorNames.get(r.authorId) ?? null : null]));
  }

  return NextResponse.json({ ok: true, notes, authors });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const day = Number(body.day);
  const draft = String(body.note ?? "").slice(0, 2000);
  const base = typeof body.base === "string" ? body.base : draft;

  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "Jour invalide." }, { status: 400 });
  }

  const [player, session, existing] = await Promise.all([
    prisma.player.findUnique({ where: { id } }),
    getPlayerSession(),
    prisma.dailyRemark.findUnique({ where: { playerId_day: { playerId: id, day } }, select: { note: true } }),
  ]);
  if (!player || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const authorId = session?.playerId ?? null;
  const { value: note, merged } = mergeOnConflict(existing?.note ?? "", base, draft);

  const remark = await prisma.dailyRemark.upsert({
    where: { playerId_day: { playerId: id, day } },
    update: { note, authorId },
    create: { playerId: id, day, note, authorId },
  });

  await logTextEdit({
    formationId: auth.formationId,
    entityType: "dailyRemark",
    entityKey: `${id}:${day}`,
    previousValue: existing?.note ?? "",
    newValue: note,
    authorId,
  });

  return NextResponse.json({ ok: true, remark, merged });
}
