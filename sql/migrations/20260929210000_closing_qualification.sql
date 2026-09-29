-- +goose Up
-- La qualification vaut pour tout closing ; ses cases à cocher, pour un RV
-- externe ; la visite (date, point de rencontre, moyens, agent), pour un RV site.
ALTER TABLE public.rendez_vous_closings
    ADD COLUMN "qualification" text NOT NULL DEFAULT '' CHECK (length("qualification") <= 120),
    ADD COLUMN "qualificationCommentaire" text NOT NULL DEFAULT '' CHECK (length("qualificationCommentaire") <= 4000),
    ADD COLUMN "qualificationExterne" text[] NOT NULL DEFAULT '{}' CHECK (cardinality("qualificationExterne") <= 6),
    ADD COLUMN "dateVisite" date,
    ADD COLUMN "heureVisite" text NOT NULL DEFAULT '' CHECK ("heureVisite" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9])?$'),
    ADD COLUMN "pointRencontre" text NOT NULL DEFAULT '' CHECK (length("pointRencontre") <= 120),
    ADD COLUMN "siteInteresse" text NOT NULL DEFAULT '' CHECK (length("siteInteresse") <= 120),
    ADD COLUMN "moyensUtilises" text NOT NULL DEFAULT '' CHECK (length("moyensUtilises") <= 120),
    ADD COLUMN "accompagnement" text NOT NULL DEFAULT '' CHECK (length("accompagnement") <= 120),
    ADD COLUMN "agent" text NOT NULL DEFAULT '' CHECK (length("agent") <= 120),
    ADD COLUMN "chauffeur" text NOT NULL DEFAULT '' CHECK (length("chauffeur") <= 120);

-- +goose Down
ALTER TABLE public.rendez_vous_closings
    DROP COLUMN "qualification",
    DROP COLUMN "qualificationCommentaire",
    DROP COLUMN "qualificationExterne",
    DROP COLUMN "dateVisite",
    DROP COLUMN "heureVisite",
    DROP COLUMN "pointRencontre",
    DROP COLUMN "siteInteresse",
    DROP COLUMN "moyensUtilises",
    DROP COLUMN "accompagnement",
    DROP COLUMN "agent",
    DROP COLUMN "chauffeur";
