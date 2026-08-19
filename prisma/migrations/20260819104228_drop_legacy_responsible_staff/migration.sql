/*
  Warnings:

  - You are about to drop the column `responsibleStaffId` on the `PlanningBlock` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PlanningBlock" DROP CONSTRAINT "PlanningBlock_responsibleStaffId_fkey";

-- AlterTable
ALTER TABLE "PlanningBlock" DROP COLUMN "responsibleStaffId";
