-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "publicNumber" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "authorFirstName" TEXT NOT NULL,
    "status" "SecretStatus" NOT NULL DEFAULT 'PENDING',
    "isRevealed" BOOLEAN NOT NULL DEFAULT false,
    "buzzCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buzz" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buzz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secret_publicNumber_key" ON "Secret"("publicNumber");

-- CreateIndex
CREATE INDEX "Buzz_secretId_idx" ON "Buzz"("secretId");

-- CreateIndex
CREATE UNIQUE INDEX "Buzz_secretId_visitorHash_key" ON "Buzz"("secretId", "visitorHash");

-- AddForeignKey
ALTER TABLE "Buzz" ADD CONSTRAINT "Buzz_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;
