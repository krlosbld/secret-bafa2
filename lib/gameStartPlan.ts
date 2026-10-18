import type { ParticipantRow } from "@/lib/gameReadiness";

// Ce que fait « Commencer le jeu » : les secrets en attente des inscrits sont validés et publiés ;
// les inscrits sans secret (ou dont le secret a été refusé) et ceux qui n'ont pas répondu à
// l'invitation sont exclus. Le démarrage n'est possible que s'il reste au moins un joueur.
export type StartPlan = { publish: ParticipantRow[]; alreadyReady: ParticipantRow[]; excludeNoSecret: ParticipantRow[]; excludeNoAnswer: ParticipantRow[]; players: number };

export function startPlan(participants: ParticipantRow[]): StartPlan {
  const active = participants.filter((p) => p.participation === "ACCEPTED");
  const publish = active.filter((p) => p.secretStatus === "PENDING");
  const alreadyReady = active.filter((p) => p.secretStatus === "PUBLISHED" || p.secretStatus === "FOUND");
  const excludeNoSecret = active.filter((p) => !p.secretStatus || p.secretStatus === "REJECTED" || p.secretStatus === "WITHDRAWN");
  const excludeNoAnswer = participants.filter((p) => !p.participation);
  return { publish, alreadyReady, excludeNoSecret, excludeNoAnswer, players: publish.length + alreadyReady.length };
}
