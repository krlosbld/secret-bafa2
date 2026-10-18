import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getEvaluationActor } from "@/lib/evaluationActor";
import { evaluationV2Enabled } from "@/lib/features";
import { getSessionLevels, JUSTIFICATION_LEVEL } from "@/lib/ratingLevels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Appréciations par critère. Chaque écriture enregistre son auteur, incrémente la version de la note
// et laisse une trace dans l'historique (réservé à l'équipe). Une saisie qui porte « expectedVersion »
// est refusée (409) si quelqu'un a modifié la note entre-temps, au lieu d'écraser silencieusement.
// Tant que la refonte n'est pas activée (EVALUATION_V2), seule l'ancienne échelle est acceptée.

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId requis." }, { status: 400 });
  }

  const auth = await getPlanningAuth();
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

  const ratings = await prisma.criterionRating.findMany({ where: { playerId } });
  const values: Record<string, string> = {};
  for (const r of ratings) values[`${r.criterionId}:${r.day}`] = r.value;
  if (!auth.ok) return NextResponse.json({ ok: true, values });

  // Équipe : version (pour les saisies concurrentes) et auteur de la version actuelle.
  const meta: Record<string, { version: number; author: string | null }> = {};
  for (const r of ratings) meta[`${r.criterionId}:${r.day}`] = { version: r.version, author: r.authorLabel };
  return NextResponse.json({ ok: true, values, meta });
}

function readKey(body: Record<string, unknown>) {
  const playerId = String(body.playerId ?? "");
  const criterionId = String(body.criterionId ?? "");
  const day = Number(body.day);
  const expectedVersion = body.expectedVersion === undefined || body.expectedVersion === null ? null : Number(body.expectedVersion);
  const valid = !!playerId && !!criterionId && Number.isInteger(day) && day >= 0 && (expectedVersion === null || Number.isInteger(expectedVersion));
  return { playerId, criterionId, day, expectedVersion, valid };
}

function conflict(current: { version: number; authorLabel: string | null } | null) {
  return NextResponse.json(
    {
      error: `Cette appréciation vient d'être modifiée${current?.authorLabel ? ` par ${current.authorLabel}` : ""}. Recharge pour voir la version actuelle.`,
      conflict: true,
      currentVersion: current?.version ?? null,
    },
    { status: 409 }
  );
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { playerId, criterionId, day, expectedVersion, valid } = readKey(body);
  if (!valid) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const [player, criterion] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.criterion.findUnique({ where: { id: criterionId } }),
  ]);
  if (!player || !criterion || player.formationId !== auth.formationId || criterion.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Valeur saisie : nouvelle échelle (niveau de la session) une fois la refonte activée, sinon
  // ancienne échelle (état global), comme aujourd'hui.
  let next: { value: string; level: number | null; levelLabel: string | null; comment: string | null };
  if (body.level !== undefined && body.level !== null) {
    if (!evaluationV2Enabled()) {
      return NextResponse.json({ error: "La nouvelle échelle n'est pas encore activée." }, { status: 400 });
    }
    const levels = await getSessionLevels(auth.formationId);
    const level = levels.find((l) => l.level === Number(body.level));
    if (!level) return NextResponse.json({ error: "Appréciation invalide." }, { status: 400 });
    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
    // La justification dépend du niveau technique, jamais de l'intitulé choisi par le directeur.
    if (level.level === JUSTIFICATION_LEVEL && !comment) {
      return NextResponse.json({ error: "Précise ce que le stagiaire doit approfondir." }, { status: 400 });
    }
    next = { value: level.id, level: level.level, levelLabel: level.label, comment: comment || null };
  } else {
    const value = String(body.value ?? "");
    const state = value ? await prisma.criterionState.findUnique({ where: { id: value } }) : null;
    if (!state) {
      return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
    }
    next = { value, level: null, levelLabel: null, comment: null };
  }

  const actor = await getEvaluationActor(auth.formationId);
  const key = { playerId_criterionId_day: { playerId, criterionId, day } };

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.criterionRating.findUnique({ where: key });
    if (expectedVersion !== null && (current?.version ?? 0) !== expectedVersion) return { conflict: current };
    if (current && current.value === next.value && current.comment === next.comment) return { rating: current };

    let rating;
    if (current) {
      // Mise à jour conditionnelle : si une autre saisie est passée entre la lecture et l'écriture,
      // rien n'est écrasé.
      const done = await tx.criterionRating.updateMany({
        where: { id: current.id, version: current.version },
        data: { ...next, authorId: actor.authorId, authorLabel: actor.authorLabel, version: current.version + 1 },
      });
      if (done.count === 0) return { conflict: await tx.criterionRating.findUnique({ where: key }) };
      rating = await tx.criterionRating.findUniqueOrThrow({ where: key });
    } else {
      rating = await tx.criterionRating.create({
        data: { playerId, criterionId, day, ...next, authorId: actor.authorId, authorLabel: actor.authorLabel, version: 1 },
      });
    }
    await tx.criterionRatingHistory.create({
      data: {
        ratingId: rating.id,
        formationId: auth.formationId,
        playerId,
        criterionId,
        day,
        action: current ? "UPDATE" : "CREATE",
        previousValue: current?.value ?? null,
        newValue: rating.value,
        previousLevel: current?.level ?? null,
        newLevel: rating.level,
        previousLabel: current?.levelLabel ?? null,
        newLabel: rating.levelLabel,
        previousComment: current?.comment ?? null,
        newComment: rating.comment,
        authorId: actor.authorId,
        authorLabel: actor.authorLabel,
      },
    });
    return { rating };
  }).catch((e: unknown) => {
    // Deux créations simultanées de la même note : la seconde voit un conflit, pas une erreur.
    if ((e as { code?: string }).code === "P2002") return { conflict: null };
    throw e;
  });

  if ("conflict" in result) return conflict(result.conflict ?? null);
  return NextResponse.json({ ok: true, rating: result.rating });
}

export async function DELETE(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { playerId, criterionId, day, expectedVersion, valid } = readKey(body);
  if (!valid) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { formationId: true } });
  if (!player || player.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const actor = await getEvaluationActor(auth.formationId);
  const key = { playerId_criterionId_day: { playerId, criterionId, day } };
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.criterionRating.findUnique({ where: key });
    if (!current) return { ok: true };
    if (expectedVersion !== null && current.version !== expectedVersion) return { conflict: current };
    const done = await tx.criterionRating.deleteMany({ where: { id: current.id, version: current.version } });
    if (done.count === 0) return { conflict: await tx.criterionRating.findUnique({ where: key }) };
    // La trace survit à la note effacée (ratingId vidé par la base, clé conservée).
    await tx.criterionRatingHistory.create({
      data: {
        formationId: auth.formationId,
        playerId,
        criterionId,
        day,
        action: "DELETE",
        previousValue: current.value,
        previousLevel: current.level,
        previousLabel: current.levelLabel,
        previousComment: current.comment,
        authorId: actor.authorId,
        authorLabel: actor.authorLabel,
      },
    });
    return { ok: true };
  });

  if ("conflict" in result) return conflict(result.conflict ?? null);
  return NextResponse.json({ ok: true });
}
