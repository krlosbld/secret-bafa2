-- AlterTable: nullable columns, no existing data to backfill (all NULL for existing players)
ALTER TABLE "Player" ADD COLUMN "username" TEXT;
ALTER TABLE "Player" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
