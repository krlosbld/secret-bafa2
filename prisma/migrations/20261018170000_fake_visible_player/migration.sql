-- Jeu des secrets : le prénom d'un faux secret peut apparaître comme un joueur (classement, points de
-- nuit), révélé en fin de partie. Colonne ajoutée, désactivée par défaut : rien d'existant ne change.
ALTER TABLE "Player" ADD COLUMN "fakeVisible" BOOLEAN NOT NULL DEFAULT false;
