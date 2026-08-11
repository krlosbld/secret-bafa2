-- CreateTable
CREATE TABLE "DirectorAccount" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectorAccount_username_key" ON "DirectorAccount"("username");

-- AlterTable: nullable, additive only (username/passwordHash dropped in a later migration after backfill)
ALTER TABLE "Player" ADD COLUMN "directorAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Player_directorAccountId_idx" ON "Player"("directorAccountId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_directorAccountId_fkey" FOREIGN KEY ("directorAccountId") REFERENCES "DirectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
