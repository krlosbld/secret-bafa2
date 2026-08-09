import { prisma } from "@/lib/prisma";

export type PlayerNotes = {
  personalNote: string;
  ems: string;
  emsVisible: boolean;
  complementaryNote: string;
  complementaryVisible: boolean;
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
      complementaryNote: true,
      complementaryVisible: true,
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
    complementaryNote: player.complementaryVisible ? player.complementaryNote : "",
    complementaryVisible: player.complementaryVisible,
    finalAppraisal: player.finalAppraisalVisible ? player.finalAppraisal : "",
    finalAppraisalVisible: player.finalAppraisalVisible,
  };
}
