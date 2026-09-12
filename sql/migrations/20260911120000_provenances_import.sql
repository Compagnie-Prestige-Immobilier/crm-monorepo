-- +goose Up
INSERT INTO "canaux_provenance" ("id", "code", "label", "position", "updatedAt")
VALUES (gen_random_uuid()::text, 'META', 'Meta (Facebook et Instagram)', 25, now())
ON CONFLICT ("code") DO NOTHING;

-- Une règle par entrée, « motif | canal | projet », réglée dans Paramètres CHUES.
-- Le motif est cherché dans la colonne de provenance du classeur : une URL de
-- page d'atterrissage ou un nom de campagne n'est pas un canal, et change souvent.
INSERT INTO "app_settings" ("key", "value", "updatedAt")
VALUES ('chues.codificationProvenances',
        jsonb_build_array(
          'monespace.cpi-chues.com | Site web | CHUES',
          'monespace.cpi.sn | Site web | GRAND_PUBLIC',
          'Meta CPI-CHUES | Meta (Facebook et Instagram) | CHUES',
          'Meta CPI GRAND PUBLIC | Meta (Facebook et Instagram) | GRAND_PUBLIC'
        )::text,
        now())
ON CONFLICT ("key") DO NOTHING;

-- +goose Down
DELETE FROM "app_settings" WHERE "key" = 'chues.codificationProvenances';
DELETE FROM "canaux_provenance" WHERE "code" = 'META';
