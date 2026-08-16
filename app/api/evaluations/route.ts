import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { resolveAuthorNames } from "@/lib/authorNames";
import { mergeOnConflict } from "@/lib/conflictMerge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId requis." }, { status: 400 });
  }

  const auth = await getPlanningAuth();
  const isStaff = auth.ok;
  if (!auth.ok) {
    const session = await getPlayerSession();
    if (!session || session.playerId !== playerId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
    if (!player || player.formationId !== auth.formationId) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const evaluations = await prisma.evaluation.findMany({ where: { playerId } });
  const notes: Record<string, string> = {};
  for (const e of evaluations) notes[e.blockId] = e.note;

  // L'auteur n'est renvoyé que côté staff — jamais exposé au stagiaire lui-même.
  let authors: Record<string, string | null> = {};
  if (isStaff) {
    const authorNames = await resolveAuthorNames(evaluations.map((e) => e.authorId));
    authors = Object.fromEntries(evaluations.map((e) => [e.blockId, e.authorId ? authorNames.get(e.authorId) ?? null : null]));
  }

  return NextResponse.json({ ok: true, notes, authors });
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const blockId = String(body.blockId ?? "");
  const draft = String(body.note ?? "").slice(0, 2000);
  const base = typeof body.base === "string" ? body.base : draft;

  if (!playerId || !blockId) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const [player, block, session, existing] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.planningBlock.findUnique({ where: { id: blockId } }),
    getPlayerSession(),
    prisma.evaluation.findUnique({ where: { playerId_blockId: { playerId, blockId } }, select: { note: true } }),
  ]);
  if (!player || !block || player.formationId !== auth.formationId || block.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const authorId = session?.playerId ?? null;
  const { value: note, merged } = mergeOnConflict(existing?.note ?? "", base, draft);

  const evaluation = await prisma.evaluation.upsert({
    where: { playerId_blockId: { playerId, blockId } },
    update: { note, authorId },
    create: { playerId, blockId, note, authorId },
  });

  return NextResponse.json({ ok: true, evaluation, merged });
}
