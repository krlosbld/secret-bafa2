-- Jeu des secrets : phases (inscriptions / en cours), exclusion et expiration des participants,
-- motif de refus des secrets. Ajouts uniquement.
ALTER TABLE "Player" ADD COLUMN "gameExitAt" TIMESTAMP(3);
ALTER TABLE "Player" ADD COLUMN "gameExitBy" TEXT;
ALTER TABLE "SecretRejection" ADD COLUMN "reason" TEXT;
