-- CreateTable
CREATE TABLE "FormationInvite" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAGIAIRE',
    "joinCount" INTEGER NOT NULL DEFAULT 0,
    "createdByLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FormationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormationInvite_token_key" ON "FormationInvite"("token");

-- CreateIndex
CREATE INDEX "FormationInvite_formationId_idx" ON "FormationInvite"("formationId");

-- AddForeignKey
ALTER TABLE "FormationInvite" ADD CONSTRAINT "FormationInvite_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

