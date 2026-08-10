-- CreateTable
CREATE TABLE "DailyRemark" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRemark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyRemark_playerId_day_key" ON "DailyRemark"("playerId", "day");

-- AddForeignKey
ALTER TABLE "DailyRemark" ADD CONSTRAINT "DailyRemark_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
