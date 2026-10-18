// Registre des règles de jeu optionnelles, activables par formation via Config (clé = r.key,
// valeur "true"/"false"). Pour ajouter une règle : un nouvel élément ici + son effet câblé où il
// s'applique (ex. app/api/buzz/route.ts) — le bouton "⚙️ Changement de règle" les liste automatiquement.
//
// Paramètres chiffrés (params) : stockés dans Config sous la clé « <règle>:<paramètre> », propres à la
// session ; lus côté serveur par lib/gameRuleSettings.ts (valeur par défaut si rien n'est réglé).
// available: false = règle déclarée mais pas encore livrée : invisible partout et refusée par l'API.
export type GameRuleParam = { key: string; label: string; min: number; max: number; default: number; unit?: string };

export type GameRule = {
  key: string;
  label: string;
  description: string;
  section: "classique" | "pouvoirs";
  available: boolean;
  params?: GameRuleParam[];
  incompatibleWith?: string[];
};

export const ALL_GAME_RULES: GameRule[] = [
  {
    key: "rule_lockPendingCorrect",
    label: "Verrouiller un secret dès qu'une bonne réponse est en attente",
    description:
      "Dès qu'un buzz correct arrive pour un secret (même pas encore validé), plus personne ne peut buzzer ce secret avec un autre prénom, ni buzzer ce prénom pour un autre secret. Le buzz reste à valider — les points ne sont attribués qu'après ta validation.",
    section: "classique",
    available: true,
  },
  {
    key: "rule_paidSecretHistory",
    label: "Les joueurs peuvent débloquer l'historique d'un secret contre 5 points",
    description:
      "Sur un secret pas encore trouvé, un joueur peut payer 5 points pour voir les prénoms déjà devinés à tort dessus (pas qui a buzzé).",
    section: "classique",
    available: true,
  },
  // Pouvoirs et événements stratégiques — livrés lot par lot (L1 à L5).
  {
    key: "rule_mysteryBuzz",
    label: "Buzz mystère ❓",
    description:
      "Une fois par partie, chaque joueur pose au maître du jeu une question fermée (oui / non) sur un secret, de 9 h à 18 h, sans jamais viser l'identité de son auteur. Tu peux refuser une question avec un motif : le joueur la reformule. Ne consomme pas le quota de buzz.",
    section: "pouvoirs",
    available: true,
  },
  {
    key: "rule_fakeIdentity",
    label: "Fausse identité 🎭",
    description: "Un joueur achète 24 h de camouflage : sur son secret, son vrai prénom comme le prénom emprunté sont jugés faux. Une fois par partie.",
    section: "pouvoirs",
    available: false,
    params: [{ key: "cost", label: "Coût", min: 1, max: 30, default: 5, unit: "points" }],
    incompatibleWith: ["rule_bounty"],
  },
  {
    key: "rule_bounty",
    label: "Secret mis à prix 🎯",
    description: "Un joueur met une mise en réserve pendant 24 h : chaque adversaire qui propose à tort son prénom lui en verse le montant ; si son secret est trouvé, la mise revient à celui qui l'a trouvé. Une fois par partie.",
    section: "pouvoirs",
    available: false,
    params: [{ key: "maxStake", label: "Mise maximale", min: 1, max: 5, default: 5, unit: "points" }],
    incompatibleWith: ["rule_fakeIdentity"],
  },
  {
    key: "rule_leaderPrivilege",
    label: "Privilège quotidien du leader 👑",
    description: "Chaque matin à 9 h, le ou les premiers du classement choisissent un privilège avant 18 h : un buzz de plus, une question au maître du jeu, ou un historique gratuit.",
    section: "pouvoirs",
    available: false,
  },
  {
    key: "rule_leaderHunt",
    label: "Chasse au leader 🎯👑",
    description: "Trouver le secret d'un leader du jour (relevé à 9 h) rapporte une prime, révélée seulement après la découverte.",
    section: "pouvoirs",
    available: false,
    params: [{ key: "bonus", label: "Prime", min: 1, max: 20, default: 3, unit: "points" }],
  },
];

// Règles livrées : les seules visibles et activables.
export const GAME_RULES = ALL_GAME_RULES.filter((r) => r.available);

export function paramConfigKey(ruleKey: string, paramKey: string): string {
  return `${ruleKey}:${paramKey}`;
}

export type GameRuleKey = string;
