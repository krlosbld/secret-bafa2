-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "complementaryNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "complementaryVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ems" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emsVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finalAppraisal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "finalAppraisalVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "personalNote" TEXT NOT NULL DEFAULT '';
