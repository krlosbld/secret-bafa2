-- Jeu des secrets : participation volontaire des stagiaires et refus de secrets. Ajouts uniquement.
ALTER TABLE "Player" ADD COLUMN "gameParticipation" TEXT;
ALTER TABLE "Player" ADD COLUMN "gameParticipationAt" TIMESTAMP(3);

CREATE TABLE "SecretRejection" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecretRejection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecretRejection_secretId_idx" ON "SecretRejection"("secretId");

ALTER TABLE "SecretRejection" ADD CONSTRAINT "SecretRejection_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;
