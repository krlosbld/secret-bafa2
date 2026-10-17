-- Critères d'évaluation propres à chaque session. Ajouts uniquement.
ALTER TABLE "Criterion" ADD COLUMN "formationId" TEXT;
ALTER TABLE "Criterion" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Criterion_formationId_idx" ON "Criterion"("formationId");

ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
