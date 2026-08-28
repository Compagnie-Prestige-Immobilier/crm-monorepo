-- La table naît vide et ne reprend qu'une ligne : la validation de la clé
-- étrangère vers `users` ne coûte rien. Le `lock_timeout` la protège quand
-- même.
SET LOCAL lock_timeout = '3s';

CREATE TABLE "android_releases" (
    "versionCode"   INTEGER NOT NULL,
    "versionName"   TEXT NOT NULL,
    "fileName"      TEXT NOT NULL,
    "fileSize"      INTEGER NOT NULL,
    "sha256"        TEXT NOT NULL,
    "signerSha256"  TEXT NOT NULL,
    "mandatory"     BOOLEAN NOT NULL DEFAULT false,
    "publishedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "notes"         TEXT,
    "withdrawnAt"   TIMESTAMP(3),
    "withdrawnById" TEXT,

    CONSTRAINT "android_releases_pkey" PRIMARY KEY ("versionCode")
);

CREATE INDEX "android_releases_publishedAt_idx" ON "android_releases" ("publishedAt");

ALTER TABLE "android_releases"
  ADD CONSTRAINT "android_releases_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise de la release unique que `app_settings` portait en JSON. Son
-- `signerSha256` reste vide : l'empreinte du signataire n'était pas lue à
-- l'époque, et la prochaine publication servira de référence.
INSERT INTO "android_releases" (
    "versionCode", "versionName", "fileName", "fileSize", "sha256",
    "signerSha256", "mandatory", "publishedAt", "publishedById", "notes"
)
SELECT
    (ancienne.release ->> 'versionCode')::integer,
    COALESCE(NULLIF(ancienne.release ->> 'versionName', ''), ancienne.release ->> 'versionCode'),
    ancienne.release ->> 'fileName',
    COALESCE((ancienne.release ->> 'fileSize')::integer, 0),
    COALESCE(ancienne.release ->> 'sha256', ''),
    '',
    COALESCE((ancienne.release ->> 'forceUpdate')::boolean, false),
    COALESCE((ancienne.release ->> 'publishedAt')::timestamp(3), CURRENT_TIMESTAMP),
    ancienne."updatedById",
    NULLIF(ancienne.release ->> 'notes', '')
FROM (
    SELECT "value"::jsonb AS release, "updatedById"
    FROM "app_settings"
    WHERE "key" = 'mobile.android.release'
      AND pg_input_is_valid("value", 'jsonb')
      AND jsonb_typeof("value"::jsonb) = 'object'
) AS ancienne
WHERE jsonb_typeof(ancienne.release -> 'versionCode') = 'number'
  AND NULLIF(ancienne.release ->> 'fileName', '') IS NOT NULL;

-- La ligne `app_settings` est laissée en place : un retour arrière du serveur
-- doit retrouver la release qu'il servait.
