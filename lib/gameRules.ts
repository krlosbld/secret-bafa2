// Registre des règles de jeu optionnelles, activables par formation via Config (clé = r.key,
// valeur "true"/"false"). Pour ajouter une règle : un nouvel élément ici + son effet câblé où il
// s'applique (ex. app/api/buzz/route.ts) — le bouton "⚙️ Changement de règle" les liste automatiquement.
export const GAME_RULES = [
  {
    key: "rule_lockPendingCorrect",
    label: "Verrouiller un secret dès qu'une bonne réponse est en attente",
    description:
      "Dès qu'un buzz correct arrive pour un secret (même pas encore validé), plus personne ne peut buzzer ce secret avec un autre prénom, ni buzzer ce prénom pour un autre secret. Le buzz reste à valider — les points ne sont attribués qu'après ta validation.",
  },
] as const;

export type GameRuleKey = (typeof GAME_RULES)[number]["key"];
