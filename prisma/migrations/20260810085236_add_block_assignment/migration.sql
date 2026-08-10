-- CreateTable
CREATE TABLE "BlockAssignment" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockAssignment_blockId_idx" ON "BlockAssignment"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockAssignment_blockId_playerId_key" ON "BlockAssignment"("blockId", "playerId");

-- AddForeignKey
ALTER TABLE "BlockAssignment" ADD CONSTRAINT "BlockAssignment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlanningBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockAssignment" ADD CONSTRAINT "BlockAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
