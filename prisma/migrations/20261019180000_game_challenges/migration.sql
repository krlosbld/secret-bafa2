-- Défis du maître du jeu : messages acceptés ou refusés par les joueurs. Ajouts seuls ; rien d'existant n'est modifié.
-- CreateTable
CREATE TABLE "GameChallenge" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "GameChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameChallengeRecipient" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "mailStatus" TEXT,

    CONSTRAINT "GameChallengeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameChallenge_formationId_createdAt_idx" ON "GameChallenge"("formationId", "createdAt");

-- CreateIndex
CREATE INDEX "GameChallengeRecipient_playerId_status_idx" ON "GameChallengeRecipient"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GameChallengeRecipient_challengeId_playerId_key" ON "GameChallengeRecipient"("challengeId", "playerId");

-- AddForeignKey
ALTER TABLE "GameChallenge" ADD CONSTRAINT "GameChallenge_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChallengeRecipient" ADD CONSTRAINT "GameChallengeRecipient_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GameChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChallengeRecipient" ADD CONSTRAINT "GameChallengeRecipient_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

