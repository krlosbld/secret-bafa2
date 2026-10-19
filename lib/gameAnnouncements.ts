import { prisma } from "@/lib/prisma";
import { getGameStatus, GAME_LAUNCHED_KEY } from "@/lib/gameAccess";
import { ALL_GAME_RULES, GAME_RULES } from "@/lib/gameRules";
import { getRuleSettings } from "@/lib/gameRuleSettings";

// Annonces de changements de règles aux joueurs. Le maître du jeu modifie une règle (activée,
// retirée, paramètre changé) pendant les inscriptions ou la partie → une trace est enregistrée.
// À sa prochaine visite, chaque participant voit UNE fenêtre récapitulant ce qui a changé depuis sa
// dernière lecture, d'après l'état ACTUEL (une règle activée puis retirée avant qu'il la voie ne lui
// est pas annoncée ; plusieurs changements de coût n'en font qu'un).
export type RuleChange = { kind: "NOUVELLE" | "MODIFIEE" | "RETIREE"; title: string; text: string };

export async function recordRuleChange(formationId: string, ruleKey: string, kind: "ENABLED" | "DISABLED" | "PARAM") {
  const status = await getGameStatus(formationId);
  if (status !== "inscriptions_ouvertes" && status !== "en_cours") return; // avant le lancement : rien à annoncer
  await prisma.gameAnnouncement.create({ data: { formationId, ruleKey, kind } });
}

export async function getPendingRuleChanges(formationId: string, playerId: string): Promise<RuleChange[]> {
  const status = await getGameStatus(formationId);
  if (status !== "inscriptions_ouvertes" && status !== "en_cours") return [];
  const [player, launched] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { announcementsSeenAt: true } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: GAME_LAUNCHED_KEY } }, select: { value: true } }),
  ]);
  const since = player?.announcementsSeenAt ?? (launched ? new Date(launched.value) : new Date(0));
  const rows = await prisma.gameAnnouncement.findMany({ where: { formationId, createdAt: { gt: since } }, orderBy: { createdAt: "asc" } });
  if (rows.length === 0) return [];
  const settings = await getRuleSettings(formationId);
  const changes: RuleChange[] = [];
  for (const rule of ALL_GAME_RULES) {
    const mine = rows.filter((r) => r.ruleKey === rule.key);
    if (mine.length === 0 || !rule.player) continue;
    const enabledNow = settings.enabled[rule.key];
    const newlyEnabled = mine.some((r) => r.kind === "ENABLED");
    const title = rule.player.title;
    if (enabledNow) {
      changes.push({ kind: newlyEnabled ? "NOUVELLE" : "MODIFIEE", title, text: rule.player.text(settings.params) });
    } else if (!newlyEnabled && mine.some((r) => r.kind === "DISABLED")) {
      changes.push({ kind: "RETIREE", title, text: "Cette règle ne s'applique plus pour la suite de la partie." });
    }
  }
  return changes;
}

export async function markRuleChangesSeen(playerId: string) {
  await prisma.player.update({ where: { id: playerId }, data: { announcementsSeenAt: new Date() } });
}

// Règles optionnelles actives dans la session, telles que présentées aux joueurs (fenêtre « ? »).
export async function activeRulesForPlayers(formationId: string) {
  const settings = await getRuleSettings(formationId);
  return GAME_RULES.filter((r) => settings.enabled[r.key] && r.player).map((r) => ({
    key: r.key,
    section: r.section,
    title: r.player!.title,
    text: r.player!.text(settings.params),
  }));
}
