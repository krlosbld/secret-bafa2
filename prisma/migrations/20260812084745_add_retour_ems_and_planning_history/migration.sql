-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "retourEms" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "retourEmsVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanningSnapshot" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "blocks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningSnapshot_formationId_createdAt_idx" ON "PlanningSnapshot"("formationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanningSnapshot" ADD CONSTRAINT "PlanningSnapshot_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
