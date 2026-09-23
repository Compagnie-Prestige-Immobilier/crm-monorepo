-- +goose Up
-- +goose StatementBegin

-- La reprise du 23 septembre a laissé la date des rendez-vous dans la note : le
-- comptoir et les rappels la lisent dans `scheduled_callbacks`. Chaque fiche
-- reçoit ici son rendez-vous daté, comme le fait « Requalifier ». Un rendez-vous
-- déjà consigné par un appel de l'agent l'emporte sur le fichier.
CREATE TEMP TABLE rdv_a_dater ON COMMIT DROP AS
WITH fichier (telephone, quand) AS (VALUES
  ('+221774075709', '2026-09-15 10:00'),
  ('+221784888722', '2026-09-15 10:00'),
  ('+221782302281', '2026-09-16 10:00'),
  ('+221776499287', '2026-09-17 12:00'),
  ('+221771875182', '2026-09-17 16:00'),
  ('+221782586356', '2026-09-20 10:00'),
  ('+221774340177', '2026-09-22 17:00'),
  ('+221769243484', '2026-09-22 16:45'),
  ('+221771148903', '2026-09-21 10:00'),
  ('+221782518329', '2026-09-18 11:00'),
  ('+221778853039', '2026-09-19 10:00'),
  ('+221775798126', '2026-09-22 16:30'),
  ('+221778038054', '2026-09-22 10:00'),
  ('+221773190675', '2026-09-22 16:00'),
  ('+221776251795', '2026-09-21 10:00'),
  ('+221772043352', '2026-09-22 10:00'),
  ('+221775798101', NULL),
  ('+221775109939', '2026-09-23 11:00'),
  ('+221761871991', '2026-09-23 11:30'),
  ('+221785071212', '2026-09-23 11:45'),
  ('+221774058361', NULL),
  ('+221775923732', '2026-09-23 12:00'),
  ('+221774328683', NULL),
  ('+221778095645', '2026-09-19 10:00'),
  ('+221779210632', '2026-09-25 12:00'),
  ('+221773542179', '2026-09-25 10:00'),
  ('+221774366653', '2026-09-25 10:00'),
  ('+221776267500', '2026-09-22 15:30'),
  ('+221776316870', '2026-09-22 10:00'),
  ('+221778537052', '2026-09-28 10:00'),
  ('+221770202080', '2026-09-19 10:00'),
  ('+221771151237', '2026-09-21 10:00'),
  ('+221772564905', '2026-09-21 10:00'),
  ('+221778027272', '2026-09-22 10:00'),
  ('+221778047806', '2026-10-01 10:00'),
  ('+221781052024', '2026-09-28 10:00'),
  ('+221774017896', '2026-09-19 10:00'),
  ('+221772069135', '2026-09-21 10:00'),
  ('+221766624919', '2026-09-21 10:00'),
  ('+221704026403', '2026-09-24 10:00'),
  ('+221773885638', '2026-09-18 10:00'),
  ('+221773784501', '2026-09-22 10:00'),
  ('+221786370655', '2026-09-22 15:00'),
  ('+221776109836', NULL),
  ('+221778687223', '2026-09-22 15:00'),
  ('+221778418976', '2026-09-23 10:00'),
  ('+221777208258', NULL),
  ('+221771785783', NULL)
)
SELECT p."id", COALESCE(s."agentCible", p."lastCallById", p."createdById") AS agent,
         s."quand" AS note,
         -- Sans date lisible, le rendez-vous est dû tout de suite, comme dans l'application.
         COALESCE(f.quand::timestamp, now() AT TIME ZONE 'UTC') AS quand
  FROM "reprise_rdv_2026_09_23" s
  JOIN "prospects" p ON p."id" = s."prospectId"
  JOIN fichier f ON right(regexp_replace(p."phoneE164", '\D', '', 'g'), 9)
                  = right(regexp_replace(f.telephone, '\D', '', 'g'), 9)
  WHERE p."deletedAt" IS NULL
    AND p."phase2Status" = 'APPOINTMENT'
    AND p."lastReasonId" = s."motifPose"
    AND NOT EXISTS (
      SELECT 1 FROM "scheduled_callbacks" c
      JOIN "call_attempts" a ON a."id" = c."sourceAttemptId"
      JOIN "call_outcome_reasons" r ON r."id" = a."reasonId"
      WHERE c."prospectId" = p."id" AND c."status" = 'PENDING'
        AND r."code" IN ('RV_CPI', 'RDV_TELEPHONIQUE'));

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "scheduled_callbacks" c SET "status" = 'SUPERSEDED'
FROM rdv_a_dater d WHERE c."prospectId" = d."id" AND c."status" = 'PENDING';

-- +goose StatementEnd

-- +goose StatementBegin

INSERT INTO "scheduled_callbacks" ("id", "prospectId", "assignedToId", "scheduledAt", "comment")
SELECT 'rdv-aligne-' || d."id", d."id", d.agent, d.quand, d.note
FROM rdv_a_dater d
ON CONFLICT DO NOTHING;

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospects" p SET "remarqueImport" = s."remarqueImportAvant", "rev" = p."rev" + 1
FROM "reprise_rdv_2026_09_23" s
WHERE p."id" = s."prospectId"
  AND POSITION('Rendez-vous aligné' IN COALESCE(p."remarqueImport", '')) > 0;

-- +goose StatementEnd

-- +goose StatementBegin

-- La reprise ne devait pas changer le titulaire : il retrouve sa fiche, sauf
-- réaffectation faite depuis.
UPDATE "prospects" p SET "createdById" = s."createdByIdAvant", "rev" = p."rev" + 1
FROM "reprise_rdv_2026_09_23" s
WHERE p."id" = s."prospectId"
  AND p."createdById" = s."agentCible"
  AND p."createdById" <> s."createdByIdAvant";

-- +goose StatementEnd

-- +goose StatementBegin

-- Chaque appel clos notait son auteur comme ayant obtenu la méthode, même sans
-- méthode : « Méthode obtenue par » ne garde que les méthodes réellement obtenues.
UPDATE "prospects" SET "enrollmentCapturedById" = NULL, "enrollmentCapturedAt" = NULL, "rev" = "rev" + 1
WHERE "enrollmentMethod" IS NULL AND ("enrollmentCapturedById" IS NOT NULL OR "enrollmentCapturedAt" IS NOT NULL);

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospect_journeys" SET "enrollmentCapturedById" = NULL, "enrollmentCapturedAt" = NULL
WHERE "enrollmentMethod" IS NULL AND ("enrollmentCapturedById" IS NOT NULL OR "enrollmentCapturedAt" IS NOT NULL);

-- +goose StatementEnd

-- +goose Down
-- Les auteurs effacés et les rappels supplantés ne se reconstituent pas : ils
-- étaient faux. Seuls les rendez-vous posés ici disparaissent.
DELETE FROM "scheduled_callbacks" WHERE "id" LIKE 'rdv-aligne-%';
