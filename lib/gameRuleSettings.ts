import { prisma } from "@/lib/prisma";
import { ALL_GAME_RULES, GAME_RULES, paramConfigKey } from "@/lib/gameRules";

// Réglages des règles d'une session : interrupteurs et paramètres chiffrés (valeur par défaut si
// rien n'est réglé, valeur bornée au min / max déclarés). Une règle non livrée est toujours inactive.
export type RuleSettings = { enabled: Record<string, boolean>; params: Record<string, number> };

export async function getRuleSettings(formationId: string): Promise<RuleSettings> {
  const keys = GAME_RULES.flatMap((r) => [r.key, ...(r.params ?? []).map((p) => paramConfigKey(r.key, p.key))]);
  const rows = await prisma.config.findMany({ where: { formationId, key: { in: keys } } });
  const values = new Map(rows.map((r) => [r.key, r.value]));
  const enabled: Record<string, boolean> = {};
  const params: Record<string, number> = {};
  for (const r of ALL_GAME_RULES) {
    enabled[r.key] = r.available && values.get(r.key) === "true";
    for (const p of r.params ?? []) {
      const k = paramConfigKey(r.key, p.key);
      const n = Number(values.get(k));
      params[k] = Number.isInteger(n) && n >= p.min && n <= p.max ? n : p.default;
    }
  }
  return { enabled, params };
}
