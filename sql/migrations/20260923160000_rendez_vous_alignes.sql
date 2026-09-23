-- +goose Up
-- +goose StatementBegin

-- Quarante-huit rendez-vous pris hors du CRM : les fiches existent, mais leur
-- statut est resté celui du dernier appel et le rendez-vous n'apparaît nulle
-- part. Chaque fiche reçoit ici le motif « RV CPI » ou « RV téléphonique »,
-- comme le fait le bouton « Requalifier », revient à l'agent qui suit le
-- rendez-vous, et garde l'heure convenue dans la note affichée sur la fiche.
--
-- L'état d'avant est recopié dans `reprise_rdv_2026_09_23`, qui sert de retour
-- arrière : le `Down` s'en sert, puis la retire.
CREATE TABLE IF NOT EXISTS "reprise_rdv_2026_09_23" (
  "prospectId" text PRIMARY KEY,
  "projet" text NOT NULL,
  "lastReasonIdAvant" text,
  "phase2StatusAvant" text NOT NULL,
  "createdByIdAvant" text NOT NULL,
  "remarqueImportAvant" text,
  "journeyPhase2StatusAvant" text,
  "motifPose" text NOT NULL,
  "agentCible" text,
  "quand" text NOT NULL
);

-- +goose StatementEnd

-- +goose StatementBegin

-- Les fiches se retrouvent par les neuf derniers chiffres du numéro : le même
-- abonné s'écrit +221 77 ... ici et 77 ... ailleurs. Une base sans aucun de ces
-- numéros, développement ou test, ne bouge pas. Une fiche convertie ou vendue
-- reste telle quelle : l'application refuse aussi de la requalifier.
INSERT INTO "reprise_rdv_2026_09_23" (
  "prospectId", "projet", "lastReasonIdAvant", "phase2StatusAvant", "createdByIdAvant",
  "remarqueImportAvant", "journeyPhase2StatusAvant", "motifPose", "agentCible", "quand")
WITH reprise (telephone, code_motif, agent, quand, statut_precedent) AS (VALUES
  ('+221774075709', 'RV_CPI', 'Tacko Bambi Ba', '15/09/2026', 'Demande d’information'),
  ('+221784888722', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '15/09/2026', 'Pas de statut'),
  ('+221782302281', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '16/09/2026 vers 10h-11h', 'Demande d’information'),
  ('+221776499287', 'RV_CPI', 'Alioune Badara Kandji', '17/09/2026 vers midi', 'À rappeler'),
  ('+221771875182', 'RV_CPI', 'Nogaye Ndiaye', '17/09/2026 vers 16h', 'Demande d’information'),
  ('+221782586356', 'RV_CPI', 'Edith Esther Badji', '20/09/2026 vers 10h', 'RV téléphonique'),
  ('+221774340177', 'RDV_TELEPHONIQUE', 'Edith Esther Badji', '22/09/2026 à 17h00', 'Terrain'),
  ('+221769243484', 'RDV_TELEPHONIQUE', 'Niokhor Emile Sarr', '22/09/2026 à 16h45', 'Demande de partenariat'),
  ('+221771148903', 'RV_CPI', 'Alioune Badara Kandji', '21/09/2026', 'Demande d’information'),
  ('+221782518329', 'RV_CPI', 'Alioune Badara Kandji', '18/09/2026 vers 11h; 12h', 'RV téléphonique'),
  ('+221778853039', 'RV_CPI', 'Alioune Badara Kandji', '19/09/2026', 'RV CPI'),
  ('+221775798126', 'RDV_TELEPHONIQUE', 'Nogaye Ndiaye', '22/09/2026 à 16h30', 'Demande de partenariat'),
  ('+221778038054', 'RV_CPI', 'Nogaye Ndiaye', '22/09/2026 vers 10h-12h', 'Demande d’information'),
  ('+221773190675', 'RDV_TELEPHONIQUE', 'Nogaye Ndiaye', '22/09/2026 à 16h00', 'Autre injoignable'),
  ('+221776251795', 'RV_CPI', 'Oumou Bocoum', '21/09/2026', 'Terrain'),
  ('+221772043352', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '22/09/2026', 'Boîte vocale'),
  ('+221775798101', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', 'attente de rdv telephonique', 'Demande d’information'),
  ('+221775109939', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', '23/09/2026 à 11h00', 'Intéressé'),
  ('+221761871991', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', '23/09/2026 à 11h30', 'Terrain'),
  ('+221785071212', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', '23/09/2026 à 11h45', 'Terrain'),
  ('+221774058361', 'RV_CPI', 'Mariétou Sylla', '28/29 a confirmer', 'Terrain'),
  ('+221775923732', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', '23/09/2026 à 12h00', 'Terrain'),
  ('+221774328683', 'RDV_TELEPHONIQUE', 'Oumou Bocoum', 'attente de rdv telephonique', 'Demande d’information'),
  ('+221778095645', 'RDV_TELEPHONIQUE', 'Khadim Touré', '19/09/2026', 'Demande d’information'),
  ('+221779210632', 'RDV_TELEPHONIQUE', 'Alioune Badara Kandji', '25/09/2026 à 12h00', 'Terrain'),
  ('+221773542179', 'RV_CPI', 'Alioune Badara Kandji', '25/09/2026', 'À rappeler'),
  ('+221774366653', 'RV_CPI', 'Alioune Badara Kandji', '25/09/2026', 'RV CPI'),
  ('+221776267500', 'RDV_TELEPHONIQUE', 'Nogaye Ndiaye', '22/09/2026 à 15H30', 'Villa'),
  ('+221776316870', 'RV_CPI', 'Mohamed Baldé', '22/09/2026', 'Terrain'),
  ('+221778537052', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', '28/09/2026', 'Terrain'),
  ('+221770202080', 'RV_CPI', 'Nogaye Ndiaye', '19/09/2026', 'NRP'),
  ('+221771151237', 'RV_CPI', 'Mohamed Baldé', '21/09/2026', 'Terrain'),
  ('+221772564905', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '21/09/2026', 'Terrain'),
  ('+221778027272', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '22/09/2026', 'Terrain'),
  ('+221778047806', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '01/10/2026', 'Terrain'),
  ('+221781052024', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', '28/09/2026', 'Terrain'),
  ('+221774017896', 'RV_CPI', 'Mohamed Baldé', '19/09/2026', 'Terrain'),
  ('+221772069135', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '21/09/2026', 'Terrain'),
  ('+221766624919', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '21/09/2026', 'Terrain'),
  ('+221704026403', 'RV_CPI', 'Sanou Jeanne d''Arc Sène', '24/09/2026', 'À rappeler'),
  ('+221773885638', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', '18/09/2026', 'Terrain'),
  ('+221773784501', 'RV_CPI', 'Khadim Touré', '22/09/2026', 'RV CPI'),
  ('+221786370655', 'RV_CPI', 'Mohamed Baldé', '22/09/2026 à 15H00', 'Terrain'),
  ('+221776109836', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', 'entre le 20 et le 28 septembre', 'Terrain'),
  ('+221778687223', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', '22/09/2026 à 15h00', 'Terrain'),
  ('+221778418976', 'RV_CPI', 'Alioune Badara Kandji', '23/09/2026', 'Terrain'),
  ('+221777208258', 'RDV_TELEPHONIQUE', 'Mariétou Sylla', 'a rappeler a la fin du mois', 'Demande d’information'),
  ('+221771785783', 'RDV_TELEPHONIQUE', 'Mohamed Baldé', 'en attente d''un rdv pour une visite sur site', 'Terrain')
)
SELECT p."id", p."projet"::text, p."lastReasonId", p."phase2Status"::text, p."createdById",
       p."remarqueImport", j."phase2Status"::text, m."id", u."id", r.quand
FROM reprise r
JOIN "prospects" p
  ON p."deletedAt" IS NULL
 AND p."statut" NOT IN ('CONVERTI', 'VENDU')
 AND right(regexp_replace(p."phoneE164", '\D', '', 'g'), 9)
     = right(regexp_replace(r.telephone, '\D', '', 'g'), 9)
JOIN "call_outcome_reasons" m ON m."code" = r.code_motif
LEFT JOIN "prospect_journeys" j ON j."prospectId" = p."id" AND j."projet" = p."projet"
LEFT JOIN "users" u ON lower(u."fullName") = lower(r.agent)
ON CONFLICT ("prospectId") DO NOTHING;

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospects" p SET
  "lastReasonId" = s."motifPose",
  "phase2Status" = 'APPOINTMENT',
  "createdById" = COALESCE(s."agentCible", p."createdById"),
  "remarqueImport" = btrim(concat_ws(' · ',
    nullif(btrim(COALESCE(p."remarqueImport", '')), ''),
    'Rendez-vous aligné', s."quand")),
  "rev" = p."rev" + 1,
  "updatedAt" = now()
FROM "reprise_rdv_2026_09_23" s
WHERE p."id" = s."prospectId"
  AND POSITION('Rendez-vous aligné' IN COALESCE(p."remarqueImport", '')) = 0;

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospect_journeys" j SET "phase2Status" = 'APPOINTMENT', "updatedAt" = now()
FROM "reprise_rdv_2026_09_23" s
WHERE j."prospectId" = s."prospectId" AND j."projet" = s."projet"::"Projet";

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Chaque fiche retrouve le statut, le motif, le propriétaire et la note qu'elle
-- avait. Une fiche rappelée depuis garde ce que cet appel a écrit : la
-- condition sur le motif posé et le statut « Rendez-vous » l'exclut du retour
-- arrière, plutôt que d'effacer un travail plus récent.
UPDATE "prospects" p SET
  "lastReasonId" = s."lastReasonIdAvant",
  "phase2Status" = s."phase2StatusAvant"::"Phase2Status",
  "createdById" = s."createdByIdAvant",
  "remarqueImport" = s."remarqueImportAvant",
  "rev" = p."rev" + 1,
  "updatedAt" = now()
FROM "reprise_rdv_2026_09_23" s
WHERE p."id" = s."prospectId"
  AND p."phase2Status" = 'APPOINTMENT'
  AND p."lastReasonId" IS NOT DISTINCT FROM s."motifPose";

-- +goose StatementEnd

-- +goose StatementBegin

UPDATE "prospect_journeys" j SET
  "phase2Status" = COALESCE(s."journeyPhase2StatusAvant", 'PENDING')::"Phase2Status",
  "updatedAt" = now()
FROM "reprise_rdv_2026_09_23" s
WHERE j."prospectId" = s."prospectId"
  AND j."projet" = s."projet"::"Projet"
  AND j."phase2Status" = 'APPOINTMENT';

-- +goose StatementEnd

-- +goose StatementBegin

DROP TABLE "reprise_rdv_2026_09_23";

-- +goose StatementEnd
