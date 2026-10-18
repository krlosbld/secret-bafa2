-- Jeu des secrets, lot L1 (Buzz mystère) : questions fermées au maître du jeu. Table ajoutée seule ; rien d'existant n'est modifié.
-- CreateTable
CREATE TABLE "SecretQuestion" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "refusalReason" TEXT,
    "answeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "SecretQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecretQuestion_formationId_status_idx" ON "SecretQuestion"("formationId", "status");

-- CreateIndex
CREATE INDEX "SecretQuestion_playerId_source_idx" ON "SecretQuestion"("playerId", "source");

-- AddForeignKey
ALTER TABLE "SecretQuestion" ADD CONSTRAINT "SecretQuestion_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretQuestion" ADD CONSTRAINT "SecretQuestion_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretQuestion" ADD CONSTRAINT "SecretQuestion_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

