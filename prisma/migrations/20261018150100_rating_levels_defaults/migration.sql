-- Refonte du suivi pédagogique, phase 1 : les trois appréciations de chaque session existante
-- (Point d'appui = 3, Satisfaisant = 2, À consolider = 1). Ajout seul, idempotent : une session qui
-- a déjà un niveau le garde (contrainte unique session + niveau). Les nouvelles sessions les
-- reçoivent à la création (lib/ratingLevels.ts). Aucune donnée existante n'est modifiée.
INSERT INTO "RatingLevel" ("id", "formationId", "level", "label", "createdAt", "updatedAt")
SELECT 'rl_' || md5(f."id" || ':' || d."level"::text), f."id", d."level", d."label", NOW(), NOW()
FROM "Formation" f
CROSS JOIN (VALUES (3, 'Point d''appui'), (2, 'Satisfaisant'), (1, 'À consolider')) AS d("level", "label")
ON CONFLICT ("formationId", "level") DO NOTHING;
