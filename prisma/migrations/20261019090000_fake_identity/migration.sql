-- Jeu des secrets, lot L2 (fausse identité) : table des pouvoirs + colonne Buzz.camouflagePowerId. Ajouts seuls ; rien d'existant n'est modifié.
-- AlterTable
ALTER TABLE "Buzz" ADD COLUMN     "camouflagePowerId" TEXT;

-- CreateTable
CREATE TABLE "GamePower" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cost" INTEGER NOT NULL DEFAULT 0,
    "aliasPlayerId" TEXT,
    "aliasLabel" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamePower_formationId_kind_status_idx" ON "GamePower"("formationId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GamePower_formationId_playerId_kind_key" ON "GamePower"("formationId", "playerId", "kind");

-- AddForeignKey
ALTER TABLE "GamePower" ADD CONSTRAINT "GamePower_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePower" ADD CONSTRAINT "GamePower_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePower" ADD CONSTRAINT "GamePower_aliasPlayerId_fkey" FOREIGN KEY ("aliasPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

