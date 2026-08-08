-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionRating" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterionRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CriterionRating_playerId_day_idx" ON "CriterionRating"("playerId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionRating_playerId_criterionId_day_key" ON "CriterionRating"("playerId", "criterionId", "day");

-- AddForeignKey
ALTER TABLE "CriterionRating" ADD CONSTRAINT "CriterionRating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionRating" ADD CONSTRAINT "CriterionRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
