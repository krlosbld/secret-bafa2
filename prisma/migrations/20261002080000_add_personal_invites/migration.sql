-- AlterTable
ALTER TABLE "FormationInvite" ADD COLUMN     "email" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "usedAt" TIMESTAMP(3);

