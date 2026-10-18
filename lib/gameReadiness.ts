import { prisma } from "@/lib/prisma";
import { PROPOSAL_DELAY_MS, expireOverdueParticipants } from "@/lib/gameAccess";
import { startPlan } from "@/lib/gameStartPlan";

// Où en sont les inscriptions d'une session : qui est prêt (secret validé), ce qui attend une
// décision, ce qui bloque le démarrage. Participants potentiels : les stagiaires et les membres de
// l'équipe avec un compte, sauf le maître du jeu. Ceux qui ont refusé, été exclus ou expirés ne
// bloquent jamais ; ceux qui n'ont pas répondu non plus (ils ne pourront plus rejoindre la partie).
export type ParticipantRow = {
  id: string;
  firstName: string;
  participation: string | null;
  secretStatus: string | null; // PENDING | PUBLISHED | FOUND | REJECTED | WITHDRAWN | null
  acceptedAt: string | null;
  deadline: string | null; // fin des 24 h pour une première proposition
  exitAt: string | null;
  exitBy: string | null;
  lastReason: string | null;
};

export async function loadReadiness(formationId: string) {
  await expireOverdueParticipants(formationId);
  const rows = await prisma.player.findMany({
    where: { formationId, active: true, isGameMaster: false, OR: [{ role: "STAGIAIRE" }, { member: { isNot: null } }] },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      role: true,
      gameParticipation: true,
      gameParticipationAt: true,
      gameExitAt: true,
      gameExitBy: true,
      secret: { select: { status: true, rejections: { orderBy: { rejectedAt: "desc" }, take: 1, select: { reason: true } } } },
    },
  });
  const participants: ParticipantRow[] = rows.map((p) => ({
    id: p.id,
    firstName: p.role === "STAGIAIRE" ? p.firstName : `${p.firstName} (${p.role === "DIRECTEUR" ? "directeur" : "formateur"})`,
    participation: p.gameParticipation,
    secretStatus: p.secret?.status ?? null,
    acceptedAt: p.gameParticipation === "ACCEPTED" ? p.gameParticipationAt?.toISOString() ?? null : null,
    deadline:
      p.gameParticipation === "ACCEPTED" && !p.secret && p.gameParticipationAt
        ? new Date(p.gameParticipationAt.getTime() + PROPOSAL_DELAY_MS).toISOString()
        : null,
    exitAt: p.gameExitAt?.toISOString() ?? null,
    exitBy: p.gameExitBy,
    lastReason: p.secret?.rejections[0]?.reason ?? null,
  }));
  const active = participants.filter((p) => p.participation === "ACCEPTED");
  const ready = active.filter((p) => p.secretStatus === "PUBLISHED");
  const blockers = active.filter((p) => p.secretStatus !== "PUBLISHED");
  return { participants, active, ready, blockers, canStart: active.length > 0 && blockers.length === 0, startPlan: startPlan(participants) };
}
