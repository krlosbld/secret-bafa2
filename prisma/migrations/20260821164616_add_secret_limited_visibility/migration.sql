-- AlterTable
ALTER TABLE "Secret" ADD COLUMN     "limitedVisibility" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limitedVisibilityMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "limitedVisibilitySince" TIMESTAMP(3);
