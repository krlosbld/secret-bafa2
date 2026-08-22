import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLAIM_FAKE_GUESS_LABEL, historyRevealCost } from "@/lib/buzzResolution";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id: secretId } = await params;
  const body = await req.json().catch(() => ({}));
  const fromCode = String(body.fromCode ?? "").trim();
  if (!fromCode) {
    return NextResponse.json({ error: "Code manquant." }, { status: 400 });
  }

  const formation = await getFormationFromCookie();
  if (!formation) {
    return NextResponse.json({ error: "Code de session manquant. Retourne sur la page d'accueil." }, { status: 400 });
  }
  if (!formation.active) {
    return NextResponse.json(
      {
        error: hasNotStartedYet(formation)
          ? "Cette formation n'a pas encore commencé."
          : "Cette formation est terminée.",
      },
      { status: 403 }
    );
  }
  const formationId = formation.id;

  const ruleConfig = await prisma.config.findUnique({
    where: { formationId_key: { formationId, key: "rule_paidSecretHistory" } },
  });
  if (ruleConfig?.value !== "true") {
    return NextResponse.json({ error: "Cette option n'est pas activée." }, { status: 403 });
  }

  const player = await prisma.player.findUnique({ where: { formationId_code: { formationId, code: fromCode } } });
  if (!player) {
    return NextResponse.json({ error: "Code invalide. Vérifie ton code personnel." }, { status: 400 });
  }

  const secret = await prisma.secret.findUnique({ where: { id: secretId } });
  if (!secret || secret.formationId !== formationId || secret.status === "PENDING") {
    return NextResponse.json({ error: "Secret introuvable." }, { status: 404 });
  }
  if (secret.status === "FOUND") {
    return NextResponse.json({ error: "Ce secret a déjà été trouvé." }, { status: 400 });
  }

  const cost = historyRevealCost(secret);
  if (player.points < cost) {
    return NextResponse.json({ error: `Il te faut au moins ${cost} points.` }, { status: 400 });
  }

  await prisma.player.update({ where: { id: player.id }, data: { points: { decrement: cost } } });

  const wrongBuzzes = await prisma.buzz.findMany({
    where: { secretId, isCorrect: false, guessedName: { not: CLAIM_FAKE_GUESS_LABEL } },
    select: { guessedName: true },
  });
  const wrongNames = [...new Set(wrongBuzzes.map((b) => b.guessedName))];

  const updated = await prisma.player.findUnique({ where: { id: player.id }, select: { points: true } });

  return NextResponse.json({ ok: true, wrongNames, pointsRemaining: updated?.points ?? 0 });
}
