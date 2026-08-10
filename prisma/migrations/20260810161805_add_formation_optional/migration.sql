-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- Player: add formationId, drop global unique on code, add compound unique
ALTER TABLE "Player" ADD COLUMN "formationId" TEXT;
DROP INDEX "Player_code_key";
CREATE UNIQUE INDEX "Player_formationId_code_key" ON "Player"("formationId", "code");
ALTER TABLE "Player" ADD CONSTRAINT "Player_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Secret: add formationId
ALTER TABLE "Secret" ADD COLUMN "formationId" TEXT;
CREATE INDEX "Secret_formationId_idx" ON "Secret"("formationId");
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PlanningBlock: add formationId
ALTER TABLE "PlanningBlock" ADD COLUMN "formationId" TEXT;
CREATE INDEX "PlanningBlock_formationId_idx" ON "PlanningBlock"("formationId");
ALTER TABLE "PlanningBlock" ADD CONSTRAINT "PlanningBlock_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Config: replace key-as-PK with generated id + formationId, compound unique on (formationId, key)
ALTER TABLE "Config" ADD COLUMN "id" TEXT;
UPDATE "Config" SET "id" = 'cfg_' || "key" WHERE "id" IS NULL;
ALTER TABLE "Config" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Config" ADD COLUMN "formationId" TEXT;
ALTER TABLE "Config" DROP CONSTRAINT "Config_pkey";
ALTER TABLE "Config" ADD CONSTRAINT "Config_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "Config_formationId_key_key" ON "Config"("formationId", "key");
ALTER TABLE "Config" ADD CONSTRAINT "Config_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
