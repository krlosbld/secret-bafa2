-- Jeu des secrets, lot L3 (secret mis à prix) : règlement de la mise + transferts. Ajouts seuls ; rien d'existant n'est modifié.
-- AlterTable
ALTER TABLE "GamePower" ADD COLUMN     "stakeOutcome" TEXT,
ADD COLUMN     "stakeSettledAt" TIMESTAMP(3),
ADD COLUMN     "stakeWinnerId" TEXT;

-- CreateTable
CREATE TABLE "BountyHit" (
    "id" TEXT NOT NULL,
    "powerId" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "buzzId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BountyHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BountyHit_powerId_fromPlayerId_key" ON "BountyHit"("powerId", "fromPlayerId");

-- AddForeignKey
ALTER TABLE "BountyHit" ADD CONSTRAINT "BountyHit_powerId_fkey" FOREIGN KEY ("powerId") REFERENCES "GamePower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

