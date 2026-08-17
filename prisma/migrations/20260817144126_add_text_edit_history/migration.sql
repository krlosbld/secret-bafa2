-- CreateTable
CREATE TABLE "TextEditHistory" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextEditHistory_formationId_entityType_entityKey_createdAt_idx" ON "TextEditHistory"("formationId", "entityType", "entityKey", "createdAt");

-- AddForeignKey
ALTER TABLE "TextEditHistory" ADD CONSTRAINT "TextEditHistory_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
