-- CreateTable
CREATE TABLE "PlanningBlock" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningBlock_day_idx" ON "PlanningBlock"("day");
