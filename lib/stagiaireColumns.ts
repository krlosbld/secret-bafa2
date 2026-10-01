import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/fuzzy";

// Colonnes configurables de la vue « Stagiaires » (tableau), propres à chaque session et rangées
// dans ses réglages (Config « stagiaireColumns »). Deux familles :
// - « poste » : nombre de fois où le stagiaire est EXPLICITEMENT affecté (BlockAssignment) à un
//   créneau du planning de ce type (ex. GJ = Grand jeu) ;
// - indicateurs de la fiche : EMS, Retour EMS, Entretien complémentaire, Appréciation finale.

export const INDICATOR_KINDS = {
  ems: { label: "EMS (entretien de mi-stage)", abbr: "EMS", field: "ems" },
  retourEms: { label: "Retour EMS", abbr: "RE", field: "retourEms" },
  complementary: { label: "Entretien complémentaire", abbr: "EC", field: "complementaryNote" },
  finalAppraisal: { label: "Appréciation finale", abbr: "AF", field: "finalAppraisal" },
} as const;
export type IndicatorKind = keyof typeof INDICATOR_KINDS;

export type StagiaireColumn =
  | { id: string; kind: "poste"; posteTypeId: string; label: string; abbr: string; visible: boolean }
  | { id: string; kind: IndicatorKind; label: string; abbr: string; visible: boolean };

const CONFIG_KEY = "stagiaireColumns";
const MAX_COLUMNS = 16;

// Colonnes de créneau proposées par défaut si ces types existent dans le planning.
const SUGGESTED_POSTES = [
  { match: "grand jeu", abbr: "GJ" },
  { match: "etude de situation", abbr: "EDS" },
  { match: "accueil echelonne", abbr: "AE" },
  { match: "petit jeu", abbr: "PJ" },
];

const newId = () => crypto.randomBytes(6).toString("base64url");

function defaultColumns(posteTypes: { id: string; label: string }[]): StagiaireColumn[] {
  const postes: StagiaireColumn[] = [];
  for (const s of SUGGESTED_POSTES) {
    const pt = posteTypes.find((p) => normalize(p.label) === s.match);
    if (pt) postes.push({ id: newId(), kind: "poste", posteTypeId: pt.id, label: pt.label, abbr: s.abbr, visible: true });
  }
  const indicators: StagiaireColumn[] = (Object.keys(INDICATOR_KINDS) as IndicatorKind[]).map((kind) => ({
    id: kind,
    kind,
    label: INDICATOR_KINDS[kind].label,
    abbr: INDICATOR_KINDS[kind].abbr,
    // Maquette validée : EMS et AF affichés ; RE et EC disponibles, masqués par défaut.
    visible: kind === "ems" || kind === "finalAppraisal",
  }));
  return [...postes, ...indicators];
}

// Valide une liste de colonnes (venant du formulaire ou de la base) ; lève une erreur lisible.
export class ColumnsError extends Error {}

function sanitize(raw: unknown, posteTypeIds: Set<string>): StagiaireColumn[] {
  if (!Array.isArray(raw)) throw new ColumnsError("Format de colonnes invalide.");
  if (raw.length > MAX_COLUMNS) throw new ColumnsError(`${MAX_COLUMNS} colonnes au maximum.`);
  const seenIndicators = new Set<string>();
  const seenIds = new Set<string>();
  return raw.map((c) => {
    if (!c || typeof c !== "object") throw new ColumnsError("Colonne invalide.");
    const col = c as Record<string, unknown>;
    const label = typeof col.label === "string" ? col.label.trim().slice(0, 40) : "";
    const abbr = typeof col.abbr === "string" ? col.abbr.trim().slice(0, 5) : "";
    const visible = col.visible !== false;
    if (!label || !abbr) throw new ColumnsError("Chaque colonne doit avoir un libellé et une abréviation (5 caractères au plus).");
    let id = typeof col.id === "string" && col.id.length <= 20 ? col.id : newId();
    if (seenIds.has(id)) id = newId();
    seenIds.add(id);

    if (col.kind === "poste") {
      const posteTypeId = typeof col.posteTypeId === "string" ? col.posteTypeId : "";
      if (!posteTypeIds.has(posteTypeId)) throw new ColumnsError(`Type de créneau introuvable pour la colonne « ${abbr} ».`);
      return { id, kind: "poste", posteTypeId, label, abbr, visible };
    }
    if (typeof col.kind === "string" && col.kind in INDICATOR_KINDS) {
      if (seenIndicators.has(col.kind)) throw new ColumnsError("Un indicateur ne peut apparaître qu'une fois.");
      seenIndicators.add(col.kind);
      return { id: col.kind, kind: col.kind as IndicatorKind, label, abbr, visible };
    }
    throw new ColumnsError("Type de colonne invalide.");
  });
}

export async function getStagiaireColumns(formationId: string): Promise<StagiaireColumn[]> {
  const [row, posteTypes] = await Promise.all([
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: CONFIG_KEY } } }),
    prisma.posteType.findMany({ select: { id: true, label: true } }),
  ]);
  if (!row) return defaultColumns(posteTypes);
  try {
    // Un type de créneau supprimé depuis : sa colonne disparaît simplement.
    const ids = new Set(posteTypes.map((p) => p.id));
    const parsed = JSON.parse(row.value) as unknown[];
    return sanitize(Array.isArray(parsed) ? parsed.filter((c) => (c as { kind?: string })?.kind !== "poste" || ids.has((c as { posteTypeId?: string }).posteTypeId ?? "")) : parsed, ids);
  } catch {
    return defaultColumns(posteTypes);
  }
}

export async function saveStagiaireColumns(formationId: string, raw: unknown): Promise<StagiaireColumn[]> {
  const posteTypes = await prisma.posteType.findMany({ select: { id: true } });
  const columns = sanitize(raw, new Set(posteTypes.map((p) => p.id)));
  const value = JSON.stringify(columns);
  await prisma.config.upsert({
    where: { formationId_key: { formationId, key: CONFIG_KEY } },
    update: { value },
    create: { formationId, key: CONFIG_KEY, value },
  });
  return columns;
}

// Nombre d'affectations explicites par stagiaire et par type de créneau, sur le planning de la
// session (jours valides uniquement). Les participants non affectés ne comptent pas.
export async function countPosteAssignments(formationId: string, dayCount: number, posteTypeIds: string[]) {
  const counts = new Map<string, Map<string, number>>(); // playerId → posteTypeId → n
  if (posteTypeIds.length === 0) return counts;
  const rows = await prisma.blockAssignment.findMany({
    where: { block: { formationId, type: { in: posteTypeIds }, day: { lt: dayCount } } },
    select: { playerId: true, block: { select: { type: true } } },
  });
  for (const r of rows) {
    const byType = counts.get(r.playerId) ?? new Map<string, number>();
    byType.set(r.block.type, (byType.get(r.block.type) ?? 0) + 1);
    counts.set(r.playerId, byType);
  }
  return counts;
}
