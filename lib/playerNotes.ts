import { prisma } from "@/lib/prisma";
import { resolveAuthorNames } from "@/lib/authorNames";

export type PlayerNotes = {
  personalNote: string;
  ems: string;
  emsVisible: boolean;
  emsAuthor: string | null;
  retourEms: string;
  retourEmsVisible: boolean;
  retourEmsAuthor: string | null;
  complementaryNote: string;
  complementaryVisible: boolean;
  complementaryNoteAuthor: string | null;
  finalOpinion: string;
  finalAppraisal: string;
  finalAppraisalVisible: boolean;
  finalAppraisalAuthor: string | null;
};

export async function getPlayerNotes(playerId: string, staff: boolean): Promise<PlayerNotes | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      personalNote: true,
      ems: true,
      emsVisible: true,
      emsAuthorId: true,
      retourEms: true,
      retourEmsVisible: true,
      retourEmsAuthorId: true,
      complementaryNote: true,
      complementaryVisible: true,
      complementaryNoteAuthorId: true,
      finalOpinion: true,
      finalAppraisal: true,
      finalAppraisalVisible: true,
      finalAppraisalAuthorId: true,
    },
  });
  if (!player) return null;

  // L'auteur n'est un renseignement utile que pour le staff — jamais exposé au stagiaire lui-même.
  const authorNames = staff
    ? await resolveAuthorNames([player.emsAuthorId, player.retourEmsAuthorId, player.complementaryNoteAuthorId, player.finalAppraisalAuthorId])
    : new Map<string, string>();

  if (staff) {
    return {
      personalNote: player.personalNote,
      ems: player.ems,
      emsVisible: player.emsVisible,
      emsAuthor: player.emsAuthorId ? authorNames.get(player.emsAuthorId) ?? null : null,
      retourEms: player.retourEms,
      retourEmsVisible: player.retourEmsVisible,
      retourEmsAuthor: player.retourEmsAuthorId ? authorNames.get(player.retourEmsAuthorId) ?? null : null,
      complementaryNote: player.complementaryNote,
      complementaryVisible: player.complementaryVisible,
      complementaryNoteAuthor: player.complementaryNoteAuthorId ? authorNames.get(player.complementaryNoteAuthorId) ?? null : null,
      finalOpinion: player.finalOpinion,
      finalAppraisal: player.finalAppraisal,
      finalAppraisalVisible: player.finalAppraisalVisible,
      finalAppraisalAuthor: player.finalAppraisalAuthorId ? authorNames.get(player.finalAppraisalAuthorId) ?? null : null,
    };
  }

  return {
    personalNote: player.personalNote,
    ems: player.emsVisible ? player.ems : "",
    emsVisible: player.emsVisible,
    emsAuthor: null,
    retourEms: player.retourEmsVisible ? player.retourEms : "",
    retourEmsVisible: player.retourEmsVisible,
    retourEmsAuthor: null,
    complementaryNote: player.complementaryVisible ? player.complementaryNote : "",
    complementaryVisible: player.complementaryVisible,
    complementaryNoteAuthor: null,
    finalOpinion: player.finalAppraisalVisible ? player.finalOpinion : "EN_ATTENTE",
    finalAppraisal: player.finalAppraisalVisible ? player.finalAppraisal : "",
    finalAppraisalVisible: player.finalAppraisalVisible,
    finalAppraisalAuthor: null,
  };
}
