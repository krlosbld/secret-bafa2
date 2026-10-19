-- Jeu des secrets, lot L4 (privilège du leader) : relevés quotidiens + lien question / privilège. Ajouts seuls ; rien d'existant n'est modifié.
-- AlterTable
ALTER TABLE "SecretQuestion" ADD COLUMN     "leaderDayId" TEXT;

-- CreateTable
CREATE TABLE "LeaderDay" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "choice" TEXT,
    "chosenAt" TIMESTAMP(3),
    "historySecretId" TEXT,
    "historyResult" TEXT,
    "historyUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderDay_formationId_day_idx" ON "LeaderDay"("formationId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderDay_formationId_day_playerId_key" ON "LeaderDay"("formationId", "day", "playerId");

-- AddForeignKey
ALTER TABLE "LeaderDay" ADD CONSTRAINT "LeaderDay_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderDay" ADD CONSTRAINT "LeaderDay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

