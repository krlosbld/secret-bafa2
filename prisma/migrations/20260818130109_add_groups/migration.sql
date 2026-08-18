-- AlterTable
ALTER TABLE "PlanningBlock" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStaff" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "GroupStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_formationId_idx" ON "Group"("formationId");

-- CreateIndex
CREATE INDEX "GroupMember_playerId_idx" ON "GroupMember"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_playerId_key" ON "GroupMember"("groupId", "playerId");

-- CreateIndex
CREATE INDEX "GroupStaff_playerId_idx" ON "GroupStaff"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStaff_groupId_playerId_key" ON "GroupStaff"("groupId", "playerId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStaff" ADD CONSTRAINT "GroupStaff_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStaff" ADD CONSTRAINT "GroupStaff_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningBlock" ADD CONSTRAINT "PlanningBlock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
