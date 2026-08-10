-- AlterTable: add nullable code column, backfill, then enforce NOT NULL + UNIQUE
ALTER TABLE "Formation" ADD COLUMN "code" TEXT;
UPDATE "Formation" SET "code" = FLOOR(1000 + RANDOM() * 9000)::TEXT WHERE "code" IS NULL;
ALTER TABLE "Formation" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Formation_code_key" ON "Formation"("code");
