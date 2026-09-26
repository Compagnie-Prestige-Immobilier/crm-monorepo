-- +goose Up
-- La datation des rendez-vous repris le 23 septembre 2026 a été exécutée en
-- production ; sa liste de numéros réels a été retirée du dépôt (audit du
-- 25 septembre, B16), le script d'origine est dans l'historique en 2efdcbf2.
-- Reste ici la seule correction générale : « Méthode obtenue par » ne garde que
-- les méthodes réellement obtenues.
-- +goose StatementBegin

UPDATE "prospects" SET "enrollmentCapturedById" = NULL, "enrollmentCapturedAt" = NULL, "rev" = "rev" + 1
WHERE "enrollmentMethod" IS NULL AND ("enrollmentCapturedById" IS NOT NULL OR "enrollmentCapturedAt" IS NOT NULL);

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospect_journeys" SET "enrollmentCapturedById" = NULL, "enrollmentCapturedAt" = NULL
WHERE "enrollmentMethod" IS NULL AND ("enrollmentCapturedById" IS NOT NULL OR "enrollmentCapturedAt" IS NOT NULL);

-- +goose StatementEnd

-- +goose Down
DELETE FROM "scheduled_callbacks" WHERE "id" LIKE 'rdv-aligne-%';
