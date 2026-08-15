import { prisma } from "@/lib/prisma";

export type PlayerNotes = {
  personalNote: string;
  ems: string;
  emsVisible: boolean;
  retourEms: string;
  retourEmsVisible: boolean;
  complementaryNote: string;
  complementaryVisible: boolean;
  finalOpinion: string;
  finalAppraisal: string;
  finalAppraisalVisible: boolean;
};

export async function getPlayerNotes(playerId: string, staff: boolean): Promise<PlayerNotes | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      personalNote: true,
      ems: true,
      emsVisible: true,
      retourEms: true,
      retourEmsVisible: true,
      complementaryNote: true,
      complementaryVisible: true,
      finalOpinion: true,
      finalAppraisal: true,
      finalAppraisalVisible: true,
    },
  });
  if (!player) return null;

  if (staff) return player;

  return {
    personalNote: player.personalNote,
    ems: player.emsVisible ? player.ems : "",
    emsVisible: player.emsVisible,
    retourEms: player.retourEmsVisible ? player.retourEms : "",
    retourEmsVisible: player.retourEmsVisible,
    complementaryNote: player.complementaryVisible ? player.complementaryNote : "",
    complementaryVisible: player.complementaryVisible,
    finalOpinion: player.finalAppraisalVisible ? player.finalOpinion : "EN_ATTENTE",
    finalAppraisal: player.finalAppraisalVisible ? player.finalAppraisal : "",
    finalAppraisalVisible: player.finalAppraisalVisible,
  };
}
