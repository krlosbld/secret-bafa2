-- Temps de formation propres à chaque compte (et à chaque famille BAFA / BAFD). Ajouts uniquement.
ALTER TABLE "PosteType" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "PosteType" ADD COLUMN "family" TEXT NOT NULL DEFAULT 'BAFA';
ALTER TABLE "PosteType" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "seededPosteFamilies" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "PosteType_ownerUserId_family_idx" ON "PosteType"("ownerUserId", "family");

ALTER TABLE "PosteType" ADD CONSTRAINT "PosteType_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
