-- AlterTable
ALTER TABLE "PlanningBlock" ADD COLUMN     "responsibleStaffId" TEXT;

-- AddForeignKey
ALTER TABLE "PlanningBlock" ADD CONSTRAINT "PlanningBlock_responsibleStaffId_fkey" FOREIGN KEY ("responsibleStaffId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
