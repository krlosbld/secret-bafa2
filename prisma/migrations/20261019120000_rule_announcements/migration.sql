-- Jeu des secrets : annonces de changements de règles aux joueurs. Ajouts seuls ; rien d'existant n'est modifié.
-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "announcementsSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GameAnnouncement" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameAnnouncement_formationId_createdAt_idx" ON "GameAnnouncement"("formationId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameAnnouncement" ADD CONSTRAINT "GameAnnouncement_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

