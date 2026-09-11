-- +goose Up
INSERT INTO "canaux_provenance" ("id", "code", "label", "position", "updatedAt")
VALUES (gen_random_uuid()::text, 'META', 'Meta (Facebook et Instagram)', 25, now())
ON CONFLICT ("code") DO NOTHING;

-- Une règle par ligne, « motif | canal | projet ». Le motif est cherché dans la
-- colonne de provenance du classeur : une URL de page d'atterrissage ou un nom
-- de campagne ne sont pas des canaux, et changent à chaque campagne.
INSERT INTO "app_settings" ("key", "value", "updatedAt")
VALUES ('imports.provenances',
'monespace.cpi-chues.com | Site web | CHUES
monespace.cpi.sn | Site web | GRAND_PUBLIC
Meta CPI-CHUES | Meta (Facebook et Instagram) | CHUES
Meta CPI GRAND PUBLIC | Meta (Facebook et Instagram) | GRAND_PUBLIC',
now())
ON CONFLICT ("key") DO NOTHING;

-- +goose Down
DELETE FROM "app_settings" WHERE "key" = 'imports.provenances';
DELETE FROM "canaux_provenance" WHERE "code" = 'META';
