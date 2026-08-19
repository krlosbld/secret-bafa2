-- CreateTable
CREATE TABLE "BlockStaff" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "BlockStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockStaff_playerId_idx" ON "BlockStaff"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockStaff_blockId_playerId_key" ON "BlockStaff"("blockId", "playerId");

-- AddForeignKey
ALTER TABLE "BlockStaff" ADD CONSTRAINT "BlockStaff_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlanningBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockStaff" ADD CONSTRAINT "BlockStaff_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
