// Règle unique : quels créneaux montrer pour un stagiaire (fiche, jauge, PDF). Un créneau est montré
// s'il est « applicable » au stagiaire (créneau évaluable, de son groupe ou sans groupe, et — si des
// stagiaires y sont affectés — affecté à lui), OU s'il porte déjà une évaluation remplie pour lui :
// une évaluation ne disparaît jamais d'une fiche parce que le groupe, le type du créneau ou les
// affectations ont changé depuis.
export type ScopeBlock = { id: string; day: number; type: string; groupId: string | null };

export function blockApplies(
  block: ScopeBlock,
  ctx: { evaluableTypeIds: Set<string>; playerGroupIds: Set<string>; assignedPlayerIds: Set<string> | undefined; playerId: string }
): boolean {
  if (!ctx.evaluableTypeIds.has(block.type)) return false;
  if (block.groupId) return ctx.playerGroupIds.has(block.groupId);
  return !ctx.assignedPlayerIds || ctx.assignedPlayerIds.has(ctx.playerId);
}

export function blockShownForPlayer(
  block: ScopeBlock,
  ctx: {
    evaluableTypeIds: Set<string>;
    playerGroupIds: Set<string>;
    assignedPlayerIds: Set<string> | undefined;
    playerId: string;
    evaluatedBlockIds: Set<string>; // créneaux où ce stagiaire a une évaluation remplie
    dayCount: number;
  }
): boolean {
  if (block.day >= ctx.dayCount) return false;
  return ctx.evaluatedBlockIds.has(block.id) || blockApplies(block, ctx);
}
