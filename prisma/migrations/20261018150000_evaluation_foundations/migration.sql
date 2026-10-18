-- Fondations de la refonte du suivi pédagogique : niveaux d'appréciation par session, auteur /
-- commentaire / version / historique des notes de critères, archivage et historique des critères.
-- Ajouts uniquement : aucune colonne existante n'est modifiée ni supprimée.

ALTER TABLE "Criterion" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT;

ALTER TABLE "CriterionRating" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "authorLabel" TEXT,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "level" INTEGER,
ADD COLUMN     "levelLabel" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RatingLevel" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RatingLevelLabelHistory" (
    "id" TEXT NOT NULL,
    "ratingLevelId" TEXT NOT NULL,
    "previousLabel" TEXT NOT NULL,
    "newLabel" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingLevelLabelHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CriterionRatingHistory" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT,
    "formationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "previousLevel" INTEGER,
    "newLevel" INTEGER,
    "previousLabel" TEXT,
    "newLabel" TEXT,
    "previousComment" TEXT,
    "newComment" TEXT,
    "authorId" TEXT,
    "authorLabel" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriterionRatingHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CriterionLabelHistory" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "previousLabel" TEXT NOT NULL,
    "newLabel" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriterionLabelHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatingLevel_formationId_level_key" ON "RatingLevel"("formationId", "level");

CREATE INDEX "RatingLevelLabelHistory_ratingLevelId_idx" ON "RatingLevelLabelHistory"("ratingLevelId");

CREATE INDEX "CriterionRatingHistory_formationId_playerId_criterionId_day_idx" ON "CriterionRatingHistory"("formationId", "playerId", "criterionId", "day");

CREATE INDEX "CriterionLabelHistory_criterionId_idx" ON "CriterionLabelHistory"("criterionId");

ALTER TABLE "RatingLevel" ADD CONSTRAINT "RatingLevel_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RatingLevelLabelHistory" ADD CONSTRAINT "RatingLevelLabelHistory_ratingLevelId_fkey" FOREIGN KEY ("ratingLevelId") REFERENCES "RatingLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CriterionRatingHistory" ADD CONSTRAINT "CriterionRatingHistory_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "CriterionRating"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CriterionLabelHistory" ADD CONSTRAINT "CriterionLabelHistory_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

