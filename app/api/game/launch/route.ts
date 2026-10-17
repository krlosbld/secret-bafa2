import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";
import { GAME_RULES } from "@/lib/gameRules";
import { GAME_LAUNCHED_BY_KEY, GAME_LAUNCHED_KEY, isGameLaunched } from "@/lib/gameAccess";
import { eligibleGameMaster, requireGameDirector } from "@/lib/gameDirector";

export const runtime = "nodejs";

// « Lancer le jeu » (directeur) : réglages du jeu + maître du jeu, puis les stagiaires sont invités à participer.
export async function POST(req: Request) {
  const ctx = await requireGameDirector();
  if (ctx instanceof NextResponse) return ctx;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const { formationId, actor } = ctx;

  if (await isGameLaunched(formationId)) return NextResponse.json({ error: "Le jeu est déjà lancé." }, { status: 409 });

  const quota = Number(body.buzzQuota);
  if (!Number.isInteger(quota) || quota < 1 || quota > 20) return NextResponse.json({ error: "Quota de buzz invalide (1 à 20)." }, { status: 400 });
  const master = await eligibleGameMaster(formationId, String(body.gameMasterPlayerId ?? ""));
  if (!master) return NextResponse.json({ error: "Choisis le maître du jeu parmi l'équipe de la session." }, { status: 400 });
  const rules = (body.rules ?? {}) as Record<string, unknown>;

  const setConfig = (key: string, value: string) =>
    prisma.config.upsert({ where: { formationId_key: { formationId, key } }, update: { value }, create: { formationId, key, value } });

  await prisma.$transaction([
    setConfig("buzzQuota", String(quota)),
    ...GAME_RULES.map((r) => setConfig(r.key, String(rules[r.key] === true))),
    prisma.player.updateMany({ where: { formationId, isGameMaster: true }, data: { isGameMaster: false } }),
    prisma.player.update({ where: { id: master.id }, data: { isGameMaster: true } }),
    setConfig(GAME_LAUNCHED_BY_KEY, actor.label),
    setConfig(GAME_LAUNCHED_KEY, new Date().toISOString()),
  ]);
  await audit(actor, "GAME_LAUNCHED", { formationId, details: `maître du jeu : ${master.firstName}` });
  return NextResponse.json({ ok: true });
}
