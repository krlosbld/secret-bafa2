-- DropIndex
DROP INDEX "Player_username_key";

-- AlterTable: safe now, the one row that had these was backfilled into DirectorAccount
ALTER TABLE "Player" DROP COLUMN "passwordHash",
DROP COLUMN "username";
