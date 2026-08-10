/*
  Warnings:

  - Made the column `formationId` on table `Config` required. This step will fail if there are existing NULL values in that column.
  - Made the column `formationId` on table `PlanningBlock` required. This step will fail if there are existing NULL values in that column.
  - Made the column `formationId` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Made the column `formationId` on table `Secret` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Config" ALTER COLUMN "formationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PlanningBlock" ALTER COLUMN "formationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "formationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Secret" ALTER COLUMN "formationId" SET NOT NULL;
