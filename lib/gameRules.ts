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
  // Pour les joueurs (fenêtre « ? » et annonces de changement) : titre court et explication, avec les
  // paramètres de la session (valeurs déjà résolues, clé = « <règle>:<paramètre> »).
  player?: { title: string; text: (params: Record<string, number>) => string };
};

export const ALL_GAME_RULES: GameRule[] = [
  {
    key: "rule_lockPendingCorrect",
    label: "Verrouiller un secret dès qu'une bonne réponse est en attente",
    description:
      "Dès qu'un buzz correct arrive pour un secret (même pas encore validé), plus personne ne peut buzzer ce secret avec un autre prénom, ni buzzer ce prénom pour un autre secret. Le buzz reste à valider — les points ne sont attribués qu'après ta validation.",
    section: "classique",
    available: true,
    player: {
      title: "🔒 Verrouillage des bonnes réponses",
      text: () =>
        "Dès qu'une bonne réponse attend la validation du maître du jeu sur un secret, plus personne ne peut buzzer ce secret, ni proposer ce prénom sur un autre secret.",
    },
  },
  {
    key: "rule_paidSecretHistory",
    label: "Les joueurs peuvent débloquer l'historique d'un secret contre 5 points",
    description:
      "Sur un secret pas encore trouvé, un joueur peut payer 5 points pour voir les prénoms déjà devinés à tort dessus (pas qui a buzzé).",
    section: "classique",
    available: true,
    player: {
      title: "🔍 Historique payant",
      text: () =>
        "Sur un secret pas encore trouvé, tu peux payer quelques points (de 2 à 6 selon le secret, prix affiché sur le bouton) pour voir les prénoms déjà proposés à tort, sans savoir qui les a proposés.",
    },
  },
  // Pouvoirs et événements stratégiques — livrés lot par lot (L1 à L5).
  {
    key: "rule_mysteryBuzz",
    label: "Buzz mystère ❓",
    description:
      "Une fois par partie, chaque joueur pose au maître du jeu une question fermée (oui / non) sur un secret, de 9 h à 18 h, sans jamais viser l'identité de son auteur. Tu peux refuser une question avec un motif : le joueur la reformule. Ne consomme pas le quota de buzz.",
    section: "pouvoirs",
    available: true,
    player: {
      title: "❓ Buzz mystère",
      text: () =>
        "Une fois par partie, pose au maître du jeu une question fermée sur un secret : il répond seulement Oui ou Non. Entre 9 h et 18 h, gratuit et hors quota de buzz. Pas de question sur l'auteur (prénom, groupe, rôle, genre…) : elle serait refusée et tu pourrais la reformuler. Bouton « ❓ Buzz mystère » sous les secrets, réponse dans « Mes pouvoirs ».",
    },
  },
  {
    key: "rule_fakeIdentity",
    label: "Fausse identité 🎭",
    description:
      "Un joueur dont le secret n'est pas encore trouvé achète 24 h de camouflage en empruntant le prénom d'un autre participant : sur SON secret, un buzz proposant son vrai prénom ou le prénom emprunté est jugé faux (le buzz est consommé). Jamais révélé aux joueurs. Une fois par partie.",
    section: "pouvoirs",
    available: true,
    params: [{ key: "cost", label: "Coût", min: 1, max: 30, default: 5, unit: "points" }],
    incompatibleWith: ["rule_bounty"],
    player: {
      title: "🎭 Fausse identité",
      text: (p) =>
        `Une fois par partie, pour ${p["rule_fakeIdentity:cost"] ?? 5} points, emprunte pendant 24 h le prénom d'un autre participant : sur ton secret, ton vrai prénom comme le prénom emprunté seront jugés faux. Personne n'est prévenu, et le secret du prénom emprunté n'est pas touché. À acheter dans « Mes pouvoirs » (secret validé et pas encore trouvé).`,
    },
  },
  {
    key: "rule_bounty",
    label: "Secret mis à prix 🎯",
    description:
      "Un joueur dont le secret n'est pas encore trouvé met une mise en réserve pendant 24 h : chaque adversaire qui propose à tort son prénom (sur un autre secret) lui verse la mise, une fois par adversaire, dans la limite de son solde. Si son secret est trouvé pendant les 24 h, la mise va à celui qui l'a trouvé ; sinon elle lui est rendue. Une fois par partie.",
    section: "pouvoirs",
    available: true,
    params: [{ key: "maxStake", label: "Mise maximale", min: 1, max: 5, default: 5, unit: "points" }],
    incompatibleWith: ["rule_fakeIdentity"],
    player: {
      title: "🎯 Secret mis à prix",
      text: (p) =>
        `Une fois par partie, mets ton secret à prix pendant 24 h avec une mise de 1 à ${p["rule_bounty:maxStake"] ?? 5} points, retirée de ton score et mise en réserve. Chaque adversaire qui propose ton prénom à tort te verse ta mise (une fois chacun, dans la limite de ses points). Si ton secret est trouvé pendant ces 24 h, ta mise va à celui qui l'a trouvé ; sinon elle t'est rendue. Pas en même temps qu'une fausse identité. Dans « Mes pouvoirs ».`,
    },
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
