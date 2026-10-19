-- Transformation d'un vrai secret en faux secret par le maître du jeu : ancien auteur + date. Ajouts seuls ; rien d'existant n'est modifié.
-- AlterTable
ALTER TABLE "Secret" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedFromPlayerId" TEXT;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_convertedFromPlayerId_fkey" FOREIGN KEY ("convertedFromPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

