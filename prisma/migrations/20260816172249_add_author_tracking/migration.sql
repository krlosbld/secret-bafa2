-- AlterTable
ALTER TABLE "DailyRemark" ADD COLUMN     "authorId" TEXT;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "authorId" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "complementaryNoteAuthorId" TEXT,
ADD COLUMN     "emsAuthorId" TEXT,
ADD COLUMN     "finalAppraisalAuthorId" TEXT,
ADD COLUMN     "retourEmsAuthorId" TEXT;
