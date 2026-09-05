import type { PrismaClient } from './index.js';

export const DEMO_VOLUMES = {
  users: 60,
  representants: 15_000,
  repCallAttempts: 45_000,
  representantComments: 20_000,
  representantRelationChanges: 18_000,
  representantSuggestions: 6_000,
  prospects: 50_000,
  prospectConversions: 8_000,
  callAttempts: 150_000,
  scheduledCallbacks: 20_000,
  segmentChanges: 25_000,
  deviceCallDetections: 60_000,
  bankCases: 12_000,
  bankCaseTransitions: 30_000,
  clientCreationRequests: 6_000,
  visites: 25_000,
  importJobs: 300,
  visiteImportChanges: 9_000,
  lotsExport: 200,
  lotExportItems: 40_000,
  notificationTemplates: 12,
  notifications: 15_000,
  notificationDeliveries: 60_000,
  auditLogs: 80_000,
  syncBatches: 12_000,
  syncOperations: 60_000,
  deviceTokens: 400,
  refreshTokens: 600,
  agentActivitySlots: 30_000,
  androidReleases: 6,
} as const;

const SOURCES: Record<string, string> = {
  users: `(SELECT array_agg(id ORDER BY id) FROM demo.users WHERE "deletedAt" IS NULL)`,
  agents: `(SELECT array_agg(id ORDER BY id) FROM demo.users WHERE "deletedAt" IS NULL AND role IN ('COMMERCIAL', 'SUPERVISEUR'))`,
  departements: `(SELECT array_agg(id ORDER BY code) FROM demo.departements)`,
  iefs: `(SELECT array_agg(id ORDER BY code) FROM demo.iefs)`,
  iefDepartements: `(SELECT array_agg("departementId" ORDER BY code) FROM demo.iefs)`,
  banques: `(SELECT array_agg(id ORDER BY "shortName") FROM demo.banques)`,
  syndicats: `(SELECT array_agg(id ORDER BY sigle) FROM demo.syndicats)`,
  professions: `(SELECT array_agg(id ORDER BY code) FROM demo.professions)`,
  canaux: `(SELECT array_agg(id ORDER BY code) FROM demo.canaux_provenance)`,
  tranches: `(SELECT array_agg(id ORDER BY code) FROM demo.income_bands)`,
  employeurs: `(SELECT array_agg(id ORDER BY code) FROM demo.employeurs)`,
  pays: `(SELECT array_agg(id ORDER BY code) FROM demo.pays)`,
  offres: `(SELECT array_agg(id ORDER BY code) FROM demo.offers)`,
  statuts: `(SELECT array_agg(id ORDER BY code) FROM demo.statuts_qualification)`,
  motifsAppel: `(SELECT array_agg(id ORDER BY code) FROM demo.call_outcome_reasons)`,
  etapes: `(SELECT array_agg(id ORDER BY position) FROM demo.bank_case_stages)`,
  etapeTypes: `(SELECT array_agg(type::text ORDER BY position) FROM demo.bank_case_stages)`,
  motifsRejet: `(SELECT array_agg(id ORDER BY code) FROM demo.bank_rejection_reasons)`,
  entreprises: `(SELECT array_agg(id ORDER BY code) FROM demo.visite_entreprises)`,
  objets: `(SELECT array_agg(id ORDER BY code) FROM demo.visite_objets)`,
  directions: `(SELECT array_agg(id ORDER BY code) FROM demo.visite_directions)`,
  destinataires: `(SELECT array_agg(id ORDER BY code) FROM demo.visite_destinataires)`,
  representants: `(SELECT array_agg(id ORDER BY id) FROM demo.representants)`,
  prospects: `(SELECT array_agg(id ORDER BY id) FROM demo.prospects)`,
  dossiers: `(SELECT array_agg(id ORDER BY id) FROM demo.bank_cases)`,
  imports: `(SELECT array_agg(id ORDER BY id) FROM demo.import_jobs)`,
  modeles: `(SELECT array_agg(id ORDER BY name) FROM demo.notification_templates)`,
};

const PRENOMS = `(ARRAY['Awa','Moussa','Fatou','Ibrahima','Ndeye','Cheikh','Aminata','Ousmane','Khady','Modou','Sokhna','Babacar'])`;
const NOMS = `(ARRAY['Diop','Ndiaye','Fall','Sow','Ba','Gueye','Sarr','Diallo','Mbaye','Faye','Cisse','Toure','Sy','Kane','Thiam','Camara'])`;
const VILLES = `(ARRAY['Dakar','Thies','Kaolack','Saint-Louis','Ziguinchor','Touba','Mbour','Rufisque','Diourbel','Louga'])`;

function ref(sources: readonly string[], body: string): string {
  const columns = sources.map((name) => `${SOURCES[name] ?? ''} AS ${name}`).join(',\n    ');
  return `WITH ref AS (SELECT\n    ${columns}\n)\n${body}`;
}

/** `r.x[1 + n % cardinality(r.x)]` : tirage stable dans un référentiel de taille inconnue. */
function pick(source: string, index: string): string {
  return `r.${source}[1 + (${index}) % cardinality(r.${source})]`;
}

function id(prefix: string, index = 'i'): string {
  return `md5('${prefix}:' || (${index}))::uuid::text`;
}

function daysAgo(expression: string): string {
  return `(now() - ((${expression}) || ' days')::interval - ((i % 24) || ' hours')::interval)`;
}

function series(count: number): string {
  return `FROM generate_series(0, ${String(count - 1)}) i, ref r`;
}

const STATEMENTS: readonly string[] = [
  ref(
    ['users'],
    `INSERT INTO demo.users (id, email, username, "passwordHash", "fullName", "phoneE164", role, "isActive", "lastLoginAt", "createdAt", "updatedAt")
SELECT ${id('demo-user')},
       'demo.agent' || lpad(i::text, 3, '0') || '@cpi.demo',
       'demo.agent' || lpad(i::text, 3, '0'),
       coalesce((SELECT "passwordHash" FROM demo.users ORDER BY "createdAt" LIMIT 1), 'demo-sans-connexion'),
       ${PRENOMS}[1 + i % 12] || ' ' || ${NOMS}[1 + (i / 12) % 16],
       '+2217' || to_char(9000000 + i, 'FM0000000'),
       (ARRAY['COMMERCIAL','COMMERCIAL','COMMERCIAL','COMMERCIAL','SUPERVISEUR','BANQUE_FINANCE','ACCUEIL','DIRECTION'])[1 + i % 8]::demo."Role",
       i % 25 <> 0,
       ${daysAgo('i % 5')},
       ${daysAgo('120 + i % 200')},
       now()
${series(DEMO_VOLUMES.users)}`,
  ),

  ref(
    ['agents', 'iefs', 'iefDepartements', 'departements', 'statuts'],
    `INSERT INTO demo.representants (id, "fullName", prenom, "phoneE164", notes, rev, "departementId", "createdById", "clientCreatedAt", "createdAt", "updatedAt", "deletedAt", "iefId", "relationStatus", "whatsappStatus", "whatsappE164", profession, etablissement, "connaitUES", contacte, syndicat, "lastCallAt", "lastCallById", "lastCallOutcome", "nextCallbackAt", "statutQualificationId")
SELECT ${id('rep')},
       ${NOMS}[1 + i % 16] || ' ' || ${PRENOMS}[1 + (i / 16) % 12],
       ${PRENOMS}[1 + (i / 16) % 12],
       '+2217' || to_char(1000000 + i, 'FM0000000'),
       CASE WHEN i % 4 = 0 THEN 'Delegue de section, joignable en fin de matinee.' END,
       1 + i % 3,
       CASE WHEN i % 9 = 0 THEN ${pick('departements', 'i')} ELSE ${pick('iefDepartements', 'i')} END,
       ${pick('agents', 'i')},
       ${daysAgo('i % 400')},
       ${daysAgo('i % 400')},
       now(),
       CASE WHEN i % 137 = 0 THEN ${daysAgo('i % 30')} END,
       CASE WHEN i % 9 = 0 THEN NULL ELSE ${pick('iefs', 'i')} END,
       (ARRAY['INCONNU','CONTACTE','AMBASSADEUR','REFUS'])[1 + i % 4]::demo."RepresentantRelation",
       (ARRAY['NON_DEMANDE','MEME_NUMERO','AUTRE_NUMERO','AUCUN'])[1 + i % 4]::demo."WhatsappStatus",
       CASE WHEN i % 4 = 2 THEN '+2217' || to_char(2000000 + i, 'FM0000000') END,
       (ARRAY['Enseignant','Directeur d''ecole','Inspecteur','Surveillant','Secretaire'])[1 + i % 5],
       'Etablissement ' || (ARRAY['Blaise Diagne','Kennedy','Delafosse','Seydina Limamoulaye','Malick Sy'])[1 + i % 5],
       i % 3 <> 0,
       i % 5 <> 0,
       (ARRAY['SAEMSS','CUSEMS','SELS','UDEN','SNEEL'])[1 + i % 5],
       CASE WHEN i % 6 <> 5 THEN ${daysAgo('i % 60')} END,
       CASE WHEN i % 6 <> 5 THEN ${pick('agents', 'i + 1')} END,
       CASE WHEN i % 6 <> 5 THEN (ARRAY['REACHED','PROSPECTS_PROMISED','UNREACHABLE','CALLBACK','REFUSED','WRONG_NUMBER'])[1 + i % 6]::demo."RepCallOutcome" END,
       CASE WHEN i % 6 = 3 THEN now() + ((1 + i % 10) || ' days')::interval END,
       ${pick('statuts', 'i')}
${series(DEMO_VOLUMES.representants)}`,
  ),

  ref(
    ['representants', 'agents', 'statuts'],
    `INSERT INTO demo.rep_call_attempts (id, "representantId", "performedById", outcome, "promisedProspects", comment, "clientCreatedAt", "createdAt", "callbackAt", "connaitUES", contacte, "etablissementConfirme", "numeroConfirme", syndicat, "statutQualificationId", "deviceCallType", "deviceCallDurationSeconds", "deviceCallAt")
SELECT ${id('repcall')},
       ${pick('representants', 'i')},
       ${pick('agents', 'i')},
       (ARRAY['REACHED','PROSPECTS_PROMISED','UNREACHABLE','CALLBACK','REFUSED','WRONG_NUMBER','OTHER'])[1 + i % 7]::demo."RepCallOutcome",
       CASE WHEN i % 7 = 1 THEN 1 + i % 12 END,
       CASE WHEN i % 7 = 6 THEN 'Appel repris par la supervision.' ELSE 'Echange de suivi.' END,
       ${daysAgo('i % 180')},
       ${daysAgo('i % 180')},
       CASE WHEN i % 7 = 3 THEN now() + ((1 + i % 8) || ' days')::interval END,
       i % 3 <> 0,
       i % 4 <> 0,
       i % 5 <> 0,
       i % 6 <> 0,
       (ARRAY['SAEMSS','CUSEMS','SELS','UDEN','SNEEL'])[1 + i % 5],
       ${pick('statuts', 'i')},
       (ARRAY['sortant','entrant'])[1 + i % 2],
       45 + i % 600,
       ${daysAgo('i % 180')}
${series(DEMO_VOLUMES.repCallAttempts)}`,
  ),

  ref(
    ['representants', 'agents'],
    `INSERT INTO demo.representant_comments (id, "representantId", "authorId", body, "clientCreatedAt", "createdAt", "deletedAt")
SELECT ${id('repcomment')},
       ${pick('representants', 'i')},
       ${pick('agents', 'i')},
       (ARRAY['Rappeler apres les cours.','A confirme la liste des adherents.','Demande un passage au bureau.','Numero secondaire a verifier.'])[1 + i % 4],
       ${daysAgo('i % 200')},
       ${daysAgo('i % 200')},
       CASE WHEN i % 211 = 0 THEN now() END
${series(DEMO_VOLUMES.representantComments)}`,
  ),

  ref(
    ['representants', 'agents'],
    `INSERT INTO demo.representant_relation_changes (id, "representantId", "fromStatus", "toStatus", reason, "changedById", source, "changedAt")
SELECT ${id('reprelation')},
       ${pick('representants', 'i')},
       (ARRAY['INCONNU','CONTACTE','AMBASSADEUR','REFUS'])[1 + i % 4]::demo."RepresentantRelation",
       (ARRAY['CONTACTE','AMBASSADEUR','REFUS','INCONNU'])[1 + i % 4]::demo."RepresentantRelation",
       (ARRAY['Premier contact abouti','Refus signale au telephone','Reprise apres campagne'])[1 + i % 3],
       ${pick('agents', 'i')},
       (ARRAY['WEB','MOBILE'])[1 + i % 2]::demo."ChangeSource",
       ${daysAgo('i % 150')}
${series(DEMO_VOLUMES.representantRelationChanges)}`,
  ),

  ref(
    ['representants', 'agents'],
    `INSERT INTO demo.representant_suggestions (id, "sourceRepresentantId", "suggestedName", "suggestedPhoneE164", note, "suggestedById", "resolvedRepresentantId", "sourceAttemptId", status, "clientCreatedAt", "createdAt", "deletedAt")
SELECT ${id('repsuggestion')},
       ${pick('representants', 'i')},
       ${PRENOMS}[1 + i % 12] || ' ' || ${NOMS}[1 + (i / 12) % 16],
       '+2217' || to_char(4000000 + i, 'FM0000000'),
       'Collegue signale par le representant.',
       ${pick('agents', 'i')},
       CASE WHEN i % 5 = 0 THEN ${pick('representants', 'i + 7')} END,
       ${id('repcall')},
       (ARRAY['A_APPELER','APPELE','ABANDONNE'])[1 + i % 3]::demo."SuggestionStatus",
       ${daysAgo('i % 120')},
       ${daysAgo('i % 120')},
       CASE WHEN i % 199 = 0 THEN now() END
${series(DEMO_VOLUMES.representantSuggestions)}`,
  ),

  ref(
    [
      'agents',
      'representants',
      'banques',
      'syndicats',
      'professions',
      'canaux',
      'tranches',
      'employeurs',
      'pays',
    ],
    `INSERT INTO demo.prospects (id, nom, prenom, "phoneE164", rev, "banqueId", "syndicatId", "representantId", "createdById", statut, "clientCreatedAt", "createdAt", "updatedAt", "deletedAt", "enrollmentCapturedAt", "enrollmentCapturedById", "enrollmentMethod", "phase2Status", origin, "originLabel", projet, type, profession, "dureeSystemeMois", "canalProvenanceId", "professionId", "incomeBandId", "paymentMode", "employeurId", employeur, "typeContrat", "ancienneteMois", "lieuActivite", "modeEpargne", "paysResidenceId", "villeResidence", "whatsappE164", "relaisNom", "relaisPhoneE164", "lastCallAt", "lastCallById", "lastCallOutcome")
SELECT ${id('prospect')},
       ${NOMS}[1 + i % 16],
       ${PRENOMS}[1 + (i / 16) % 12],
       '+2217' || to_char(3000000 + i, 'FM0000000'),
       1 + i % 4,
       CASE WHEN i % 5 = 4 THEN NULL ELSE ${pick('banques', 'i')} END,
       CASE WHEN i % 5 = 4 THEN NULL ELSE ${pick('syndicats', 'i')} END,
       CASE WHEN i % 5 = 4 THEN NULL ELSE ${pick('representants', 'i')} END,
       ${pick('agents', 'i')},
       (ARRAY['NOUVEAU','CONTACTE','CONVERTI','PERDU'])[1 + i % 4]::demo."ProspectStatut",
       ${daysAgo('i % 400')},
       ${daysAgo('i % 400')},
       now(),
       CASE WHEN i % 151 = 0 THEN ${daysAgo('i % 30')} END,
       CASE WHEN i % 4 = 1 THEN ${daysAgo('i % 90')} END,
       CASE WHEN i % 4 = 1 THEN ${pick('agents', 'i + 3')} END,
       CASE WHEN i % 4 = 1 THEN (ARRAY['PLATFORM','PHYSICAL','VOICE_OR_ELECTRONIC_MESSAGING','APPOINTMENT'])[1 + (i / 4) % 4]::demo."EnrollmentMethod" END,
       (ARRAY['PENDING','METHOD_OBTAINED','REFUSED','WRONG_NUMBER'])[1 + i % 4]::demo."Phase2Status",
       CASE WHEN i % 7 = 0 THEN 'BANQUE' END,
       CASE WHEN i % 7 = 0 THEN 'Depot en agence' END,
       CASE WHEN i % 5 = 4 THEN 'GRAND_PUBLIC' ELSE 'CHUES' END::demo."Projet",
       CASE WHEN i % 5 = 4 THEN (ARRAY['FONCTIONNAIRE','SECTEUR_PRIVE','INFORMEL','DIASPORA'])[1 + (i / 5) % 4]::demo."ProspectType" END,
       (ARRAY['Enseignant','Commercant','Artisan','Chauffeur','Infirmier'])[1 + i % 5],
       6 + i % 120,
       ${pick('canaux', 'i')},
       ${pick('professions', 'i')},
       ${pick('tranches', 'i')},
       (ARRAY['COMPTANT','ECHELONNE'])[1 + i % 2]::demo."PaymentMode",
       ${pick('employeurs', 'i')},
       'Employeur ' || (1 + i % 40),
       (ARRAY['CDI','CDD','AUTRE'])[1 + i % 3]::demo."TypeContrat",
       3 + i % 240,
       ${VILLES}[1 + i % 10] || ', quartier ' || (1 + i % 20),
       (ARRAY['TONTINE','MOBILE_MONEY','BANQUE','AUCUN'])[1 + i % 4]::demo."ModeEpargne",
       ${pick('pays', 'i')},
       ${VILLES}[1 + i % 10],
       '+2217' || to_char(5000000 + i, 'FM0000000'),
       ${PRENOMS}[1 + (i / 3) % 12] || ' ' || ${NOMS}[1 + i % 16],
       '+2217' || to_char(6000000 + i, 'FM0000000'),
       CASE WHEN i % 6 <> 5 THEN ${daysAgo('i % 90')} END,
       CASE WHEN i % 6 <> 5 THEN ${pick('agents', 'i + 2')} END,
       CASE WHEN i % 6 <> 5 THEN (ARRAY['METHOD_OBTAINED','UNREACHABLE','CALLBACK','REFUSED','WRONG_NUMBER','OTHER'])[1 + i % 6]::demo."CallOutcome" END
${series(DEMO_VOLUMES.prospects)}`,
  ),

  ref(
    ['agents'],
    `INSERT INTO demo.prospect_journeys (id, "prospectId", projet, statut, consent, "consentAt", "consentById", "convertedAt", "convertedById", "createdAt", "updatedAt", "phase2Status", "enrollmentMethod", "enrollmentCapturedAt", "enrollmentCapturedById", "closedAt", "closedReason", "closedById")
SELECT md5('journey:' || p.id)::uuid::text,
       p.id,
       p.projet,
       p.statut,
       CASE WHEN p.projet = 'GRAND_PUBLIC' THEN (ARRAY['NON_DEMANDE','INTERESSE','REFUSE'])[1 + (p.rang % 3)] ELSE 'NON_DEMANDE' END::demo."GrandPublicConsent",
       CASE WHEN p.projet = 'GRAND_PUBLIC' AND p.rang % 3 <> 0 THEN p."clientCreatedAt" END,
       CASE WHEN p.projet = 'GRAND_PUBLIC' AND p.rang % 3 <> 0 THEN ${pick('agents', 'p.rang')} END,
       CASE WHEN p.statut = 'CONVERTI' THEN p."clientCreatedAt" + interval '9 days' END,
       CASE WHEN p.statut = 'CONVERTI' THEN ${pick('agents', 'p.rang + 1')} END,
       p."createdAt",
       now(),
       p."phase2Status",
       p."enrollmentMethod",
       p."enrollmentCapturedAt",
       p."enrollmentCapturedById",
       CASE WHEN p.statut = 'PERDU' THEN p."clientCreatedAt" + interval '12 days' END,
       CASE WHEN p.statut = 'PERDU' THEN 'Injoignable apres trois tentatives' END,
       CASE WHEN p.statut = 'PERDU' THEN ${pick('agents', 'p.rang + 2')} END
FROM (SELECT *, (row_number() OVER (ORDER BY id))::int AS rang FROM demo.prospects) p, ref r
WHERE NOT EXISTS (SELECT 1 FROM demo.prospect_journeys j WHERE j."prospectId" = p.id)`,
  ),

  ref(
    ['agents', 'offres'],
    `INSERT INTO demo.prospect_conversions (id, "journeyId", "offerId", "paymentMode", "amountXof", "durationMonths", "confirmedById", "confirmedAt")
SELECT ${id('conversion', 'j.rang')},
       j.id,
       ${pick('offres', 'j.rang')},
       (ARRAY['COMPTANT','ECHELONNE'])[1 + j.rang % 2]::demo."PaymentMode",
       25000 + (j.rang % 40) * 5000,
       CASE WHEN j.rang % 2 = 1 THEN 3 + j.rang % 24 END,
       ${pick('agents', 'j.rang')},
       coalesce(j."convertedAt", now())
FROM (
  SELECT id, "convertedAt", (row_number() OVER (ORDER BY id))::int AS rang
  FROM demo.prospect_journeys WHERE statut = 'CONVERTI' LIMIT ${String(DEMO_VOLUMES.prospectConversions)}
) j, ref r`,
  ),

  ref(
    ['prospects', 'agents', 'motifsAppel'],
    `INSERT INTO demo.call_attempts (id, "prospectId", "performedById", outcome, method, comment, "clientCreatedAt", "createdAt", "reasonId", email, fonctionnaire, "engagementEnCours", "dureeEtablissementMois", "rendezVousAt", "deviceCallType", "deviceCallDurationSeconds", "deviceCallAt")
SELECT ${id('call')},
       ${pick('prospects', 'i')},
       ${pick('agents', 'i')},
       (ARRAY['METHOD_OBTAINED','UNREACHABLE','CALLBACK','REFUSED','WRONG_NUMBER','OTHER'])[1 + i % 6]::demo."CallOutcome",
       CASE WHEN i % 6 = 0 THEN (ARRAY['PLATFORM','PHYSICAL','VOICE_OR_ELECTRONIC_MESSAGING','APPOINTMENT'])[1 + (i / 6) % 4]::demo."EnrollmentMethod" END,
       CASE WHEN i % 6 = 5 THEN 'Motif hors liste : rappel demande par la famille.' ELSE 'Appel de qualification.' END,
       ${daysAgo('i % 200')},
       ${daysAgo('i % 200')},
       ${pick('motifsAppel', 'i')},
       'prospect' || i || '@demo.cpi',
       i % 3 <> 0,
       i % 4 = 0,
       6 + i % 500,
       CASE WHEN i % 6 = 0 AND (i / 6) % 4 = 3 THEN now() + ((2 + i % 12) || ' days')::interval END,
       (ARRAY['sortant','entrant'])[1 + i % 2],
       30 + i % 900,
       ${daysAgo('i % 200')}
${series(DEMO_VOLUMES.callAttempts)}`,
  ),

  ref(
    ['prospects', 'agents'],
    `INSERT INTO demo.scheduled_callbacks (id, "prospectId", "assignedToId", "scheduledAt", comment, "sourceAttemptId", status, "closedAttemptId", "createdAt", "updatedAt")
SELECT ${id('callback')},
       r.prospects[1 + i],
       ${pick('agents', 'i')},
       now() + ((i % 21) - 7 || ' days')::interval,
       'Rappel convenu avec le prospect.',
       ${id('call')},
       (ARRAY['PENDING','DONE','CANCELLED','SUPERSEDED'])[1 + i % 4]::demo."ScheduledCallbackStatus",
       CASE WHEN i % 4 = 1 THEN ${id('call', 'i + 100000')} END,
       ${daysAgo('i % 60')},
       now()
${series(DEMO_VOLUMES.scheduledCallbacks)}`,
  ),

  ref(
    ['prospects', 'agents', 'banques', 'syndicats'],
    `INSERT INTO demo.segment_changes (id, "prospectId", "fromSegment", "toSegment", "fromBanqueId", "toBanqueId", "fromSyndicatId", "toSyndicatId", reason, "changedById", source, "changedAt")
SELECT ${id('segment')},
       ${pick('prospects', 'i')},
       (ARRAY['BDD1','BDD2','BDD3','BDD4'])[1 + i % 4]::demo."BddSegment",
       (ARRAY['BDD2','BDD3','BDD4','BDD1'])[1 + i % 4]::demo."BddSegment",
       ${pick('banques', 'i')},
       ${pick('banques', 'i + 1')},
       ${pick('syndicats', 'i')},
       ${pick('syndicats', 'i + 1')},
       (ARRAY['Correction apres appel','Rattachement syndical revu','Banque de traitement changee'])[1 + i % 3],
       ${pick('agents', 'i')},
       (ARRAY['WEB','MOBILE'])[1 + i % 2]::demo."ChangeSource",
       ${daysAgo('i % 150')}
${series(DEMO_VOLUMES.segmentChanges)}`,
  ),

  ref(
    ['prospects', 'representants', 'agents'],
    `INSERT INTO demo.device_call_detections (id, "performedById", "representantId", "prospectId", "deviceCallType", "deviceCallDurationSeconds", "deviceCallAt", "detectedAt", "attemptId", "createdAt")
SELECT ${id('detection')},
       ${pick('agents', 'i')},
       CASE WHEN i % 2 = 0 THEN ${pick('representants', 'i')} END,
       CASE WHEN i % 2 = 1 THEN ${pick('prospects', 'i')} END,
       (ARRAY['sortant','entrant','manque'])[1 + i % 3],
       20 + i % 700,
       ${daysAgo('i % 120')},
       ${daysAgo('i % 120')},
       CASE WHEN i % 2 = 1 THEN ${id('call')} ELSE ${id('repcall')} END,
       ${daysAgo('i % 120')}
${series(DEMO_VOLUMES.deviceCallDetections)}`,
  ),

  ref(
    ['prospects', 'agents', 'banques', 'etapes', 'etapeTypes', 'motifsRejet'],
    `INSERT INTO demo.bank_cases (id, reference, "referenceKey", "prospectId", "customerName", "customerPhoneE164", "processingBankId", "currentStageId", "amountXof", "rejectionReasonId", "rejectionDetail", rev, "createdById", "updatedById", "createdAt", "updatedAt", "deletedAt")
SELECT ${id('dossier')},
       'DEMO-' || lpad(i::text, 6, '0'),
       'DEMO-' || lpad(i::text, 6, '0'),
       ${pick('prospects', 'i')},
       ${PRENOMS}[1 + i % 12] || ' ' || ${NOMS}[1 + (i / 12) % 16],
       '+2217' || to_char(3000000 + i, 'FM0000000'),
       ${pick('banques', 'i')},
       ${pick('etapes', 'i')},
       50000 + (i % 60) * 25000,
       CASE WHEN ${pick('etapeTypes', 'i')} = 'REJECTED' THEN ${pick('motifsRejet', 'i')} END,
       CASE WHEN ${pick('etapeTypes', 'i')} = 'REJECTED' THEN 'Piece manquante au dossier.' END,
       1 + i % 3,
       ${pick('agents', 'i')},
       ${pick('agents', 'i + 1')},
       ${daysAgo('i % 300')},
       now(),
       CASE WHEN i % 173 = 0 THEN now() END
${series(DEMO_VOLUMES.bankCases)}`,
  ),

  ref(
    ['dossiers', 'agents', 'etapes', 'etapeTypes', 'motifsRejet'],
    `INSERT INTO demo.bank_case_transitions (id, "caseId", "fromStageId", "toStageId", "performedById", "amountXof", "rejectionReasonId", "rejectionDetail", comment, "correctionReason", "clientAt", "createdAt")
SELECT ${id('transition')},
       ${pick('dossiers', 'i')},
       CASE WHEN i % 3 <> 0 THEN ${pick('etapes', 'i')} END,
       ${pick('etapes', 'i + 1')},
       ${pick('agents', 'i')},
       50000 + (i % 60) * 25000,
       CASE WHEN ${pick('etapeTypes', 'i + 1')} = 'REJECTED' THEN ${pick('motifsRejet', 'i')} END,
       CASE WHEN ${pick('etapeTypes', 'i + 1')} = 'REJECTED' THEN 'Justificatif de revenu absent.' END,
       'Passage enregistre par le back-office.',
       CASE WHEN i % 11 = 0 THEN 'Correction de saisie' END,
       ${daysAgo('i % 250')},
       ${daysAgo('i % 250')}
${series(DEMO_VOLUMES.bankCaseTransitions)}`,
  ),

  ref(
    ['prospects', 'agents', 'banques'],
    `INSERT INTO demo.client_creation_requests (id, nom, prenom, "phoneE164", note, "banqueId", "requestedById", status, "reviewedById", "reviewedAt", "rejectionNote", "createdProspectId", "createdAt", "updatedAt")
SELECT ${id('demande')},
       ${NOMS}[1 + i % 16],
       ${PRENOMS}[1 + (i / 16) % 12],
       '+2217' || to_char(7000000 + i, 'FM0000000'),
       'Client oriente par l''agence.',
       ${pick('banques', 'i')},
       ${pick('agents', 'i')},
       (ARRAY['PENDING','APPROVED','REJECTED'])[1 + i % 3]::demo."ClientRequestStatus",
       CASE WHEN i % 3 <> 0 THEN ${pick('agents', 'i + 1')} END,
       CASE WHEN i % 3 <> 0 THEN ${daysAgo('i % 40')} END,
       CASE WHEN i % 3 = 2 THEN 'Numero deja rattache a un autre dossier.' END,
       CASE WHEN i % 3 = 1 THEN ${pick('prospects', 'i')} END,
       ${daysAgo('i % 200')},
       now()
${series(DEMO_VOLUMES.clientCreationRequests)}`,
  ),

  ref(
    ['agents', 'entreprises', 'objets', 'directions', 'destinataires'],
    `INSERT INTO demo.visites (id, reference, "visitedAt", "timeKnown", "visitorName", phone, "phoneE164", "entrepriseId", "objetId", "directionId", "destinataireId", comment, "createdById", "createdAt", "updatedAt")
SELECT ${id('visite')},
       'VIS-DEMO-' || lpad(i::text, 6, '0'),
       ${daysAgo('i % 365')},
       i % 8 <> 0,
       ${PRENOMS}[1 + i % 12] || ' ' || ${NOMS}[1 + (i / 12) % 16],
       '77 ' || to_char(8000000 + i, 'FM0000000'),
       '+2217' || to_char(8000000 + i, 'FM0000000'),
       ${pick('entreprises', 'i')},
       ${pick('objets', 'i')},
       ${pick('directions', 'i')},
       ${pick('destinataires', 'i')},
       'Recu a l''accueil, oriente vers le service.',
       ${pick('agents', 'i')},
       ${daysAgo('i % 365')},
       now()
${series(DEMO_VOLUMES.visites)}`,
  ),

  ref(
    ['agents'],
    `INSERT INTO demo.import_jobs (id, kind, status, mode, "requestedById", "fileName", "fileBytes", "storagePath", "totalRows", "processedRows", "createdRows", "updatedRows", "skippedRows", "errorRows", report, "failureCode", "failureMsg", "claimToken", "claimedAt", "startedAt", "finishedAt", "expiresAt", "createdAt", "updatedAt")
SELECT ${id('import')},
       (ARRAY['REPRESENTANTS','PROSPECTS','VISITES','PROSPECTS_GRAND_PUBLIC','VISITES_REGISTRE'])[1 + i % 5]::demo."ImportKind",
       (ARRAY['succeeded','succeeded','failed','expired','queued'])[1 + i % 5]::demo."ImportStatus",
       (ARRAY['DRY_RUN','APPLY'])[1 + i % 2]::demo."ImportMode",
       ${pick('agents', 'i')},
       'import-demo-' || lpad(i::text, 4, '0') || '.xlsx',
       48000 + i * 137,
       'imports/demo/' || lpad(i::text, 4, '0') || '.xlsx',
       200 + i % 800,
       200 + i % 800,
       120 + i % 400,
       40 + i % 100,
       20 + i % 60,
       CASE WHEN i % 5 = 2 THEN 12 ELSE 0 END,
       jsonb_build_object('lignes', 200 + i % 800, 'avertissements', i % 7),
       CASE WHEN i % 5 = 2 THEN 'PARSE_ERROR' END,
       CASE WHEN i % 5 = 2 THEN 'Colonne « telephone » absente de la feuille.' END,
       CASE WHEN i % 5 = 4 THEN md5('claim:' || i) END,
       CASE WHEN i % 5 = 4 THEN ${daysAgo('i % 10')} END,
       ${daysAgo('i % 90')},
       CASE WHEN i % 5 <> 4 THEN ${daysAgo('i % 90')} END,
       now() + interval '30 days',
       ${daysAgo('i % 90')},
       now()
${series(DEMO_VOLUMES.importJobs)}`,
  ),

  ref(
    ['imports'],
    `INSERT INTO demo.visite_import_changes (id, "importJobId", sheet, "rowNumber", kind, reference, "visiteId", label, fields, "rowHash", selected, "createdAt")
SELECT ${id('importchange')},
       ${pick('imports', 'i')},
       (ARRAY['Registre','Annexe'])[1 + i % 2],
       2 + i / cardinality(r.imports),
       (ARRAY['CREATE','UPDATE'])[1 + i % 2]::demo."VisiteImportChangeKind",
       'VIS-DEMO-' || lpad((i % ${String(DEMO_VOLUMES.visites)})::text, 6, '0'),
       CASE WHEN i % 2 = 1 THEN ${id('visite', 'i % ' + String(DEMO_VOLUMES.visites))} END,
       'Ligne ' || (2 + i / cardinality(r.imports)) || ' du registre',
       jsonb_build_object('visiteur', ${PRENOMS}[1 + i % 12], 'objet', 'Depot de dossier'),
       md5('rowhash:' || i),
       i % 9 <> 0,
       ${daysAgo('i % 60')}
${series(DEMO_VOLUMES.visiteImportChanges)}`,
  ),

  ref(
    ['agents'],
    `INSERT INTO demo.lots_export (id, name, cible, projet, filters, "itemCount", "createdById", "createdAt")
SELECT ${id('lot')},
       'Lot demo ' || lpad(i::text, 3, '0'),
       (ARRAY['REPRESENTANTS','PROSPECTS'])[1 + i % 2]::demo."LotExportCible",
       (ARRAY['CHUES','GRAND_PUBLIC'])[1 + (i / 2) % 2]::demo."Projet",
       jsonb_build_object('departement', NULL, 'statut', 'NOUVEAU'),
       ${String(Math.floor(DEMO_VOLUMES.lotExportItems / DEMO_VOLUMES.lotsExport))},
       ${pick('agents', 'i')},
       ${daysAgo('i % 120')}
${series(DEMO_VOLUMES.lotsExport)}`,
  ),

  ref(
    ['representants', 'prospects', 'agents'],
    `INSERT INTO demo.lot_export_items ("lotId", "representantId", "prospectId", position, "assigneeId", day)
SELECT ${id('lot', 'i % ' + String(DEMO_VOLUMES.lotsExport))},
       CASE WHEN (i % ${String(DEMO_VOLUMES.lotsExport)}) % 2 = 0 THEN ${pick('representants', 'i')} END,
       CASE WHEN (i % ${String(DEMO_VOLUMES.lotsExport)}) % 2 = 1 THEN ${pick('prospects', 'i')} END,
       1 + i / ${String(DEMO_VOLUMES.lotsExport)},
       ${pick('agents', 'i')},
       1 + (i / ${String(DEMO_VOLUMES.lotsExport)}) % 5
${series(DEMO_VOLUMES.lotExportItems)}`,
  ),

  ref(
    ['agents'],
    `INSERT INTO demo.notification_templates (id, name, category, "titleTemplate", "bodyTemplate", route, variables, "isActive", "createdById", "createdAt", "updatedAt")
SELECT ${id('modele')},
       'Modele demo ' || lpad(i::text, 2, '0'),
       (ARRAY['ANNONCE','RAPPEL','CAMPAGNE','DOSSIER','SYSTEME'])[1 + i % 5]::demo."NotificationCategory",
       '{{titre}} du jour',
       'Bonjour {{prenom}}, {{message}}.',
       (ARRAY['/chues/prospects','/chues/representants','/banque/dossiers'])[1 + i % 3],
       ARRAY['titre','prenom','message'],
       i % 7 <> 0,
       ${pick('agents', 'i')},
       ${daysAgo('i % 200')},
       now()
${series(DEMO_VOLUMES.notificationTemplates)}`,
  ),

  ref(
    ['agents', 'users', 'modeles'],
    `INSERT INTO demo.notifications (id, title, body, category, route, payload, audience, "audienceRole", "audienceUserIds", status, "scheduledFor", "sentAt", "cancelledAt", "transportStatus", "templateId", "createdById", "reminderKey", period, "createdAt", "updatedAt")
SELECT ${id('notification')},
       'Annonce demo ' || lpad(i::text, 5, '0'),
       'Message de demonstration destine au plateau.',
       (ARRAY['ANNONCE','RAPPEL','CAMPAGNE','DOSSIER','SYSTEME'])[1 + i % 5]::demo."NotificationCategory",
       (ARRAY['/chues/prospects','/chues/representants','/banque/dossiers'])[1 + i % 3],
       jsonb_build_object('rang', i),
       (ARRAY['ALL','ROLE','USERS'])[1 + i % 3]::demo."NotificationAudience",
       CASE WHEN i % 3 = 1 THEN (ARRAY['COMMERCIAL','SUPERVISEUR','BANQUE_FINANCE','ACCUEIL'])[1 + (i / 3) % 4]::demo."Role" END,
       CASE WHEN i % 3 = 2 THEN ARRAY[${pick('users', 'i')}, ${pick('users', 'i + 1')}] ELSE ARRAY[]::text[] END,
       (ARRAY['SENT','SENT','SCHEDULED','CANCELLED'])[1 + i % 4]::demo."NotificationStatus",
       CASE WHEN i % 4 = 2 THEN now() + ((1 + i % 10) || ' days')::interval END,
       CASE WHEN i % 4 < 2 THEN ${daysAgo('i % 120')} END,
       CASE WHEN i % 4 = 3 THEN ${daysAgo('i % 30')} END,
       (ARRAY['ok','ok','partiel'])[1 + i % 3],
       ${pick('modeles', 'i')},
       ${pick('agents', 'i')},
       'rappel-demo-' || i,
       to_char(now() - ((i % 120) || ' days')::interval, 'YYYY-MM-DD'),
       ${daysAgo('i % 120')},
       now()
${series(DEMO_VOLUMES.notifications)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.notification_deliveries (id, "notificationId", "userId", status, "deviceToken", error, "sentAt", "deliveredAt", "readAt", "failedAt", "reminderKey", period, "createdAt", "updatedAt")
SELECT ${id('livraison')},
       ${id('notification', 'i / 4')},
       ${pick('users', '(i % 4) + (i / 4)')},
       (ARRAY['PENDING','SENT','DELIVERED','FAILED','READ'])[1 + i % 5]::demo."NotificationDeliveryStatus",
       'demo-token-' || md5('token:' || i),
       CASE WHEN i % 5 = 3 THEN 'Jeton FCM expire.' END,
       CASE WHEN i % 5 <> 0 THEN ${daysAgo('i % 120')} END,
       CASE WHEN i % 5 > 1 THEN ${daysAgo('i % 120')} END,
       CASE WHEN i % 5 = 4 THEN ${daysAgo('i % 120')} END,
       CASE WHEN i % 5 = 3 THEN ${daysAgo('i % 120')} END,
       'rappel-demo-' || (i / 4),
       to_char(now() - (((i / 4) % 120) || ' days')::interval, 'YYYY-MM-DD'),
       ${daysAgo('i % 120')},
       now()
${series(DEMO_VOLUMES.notificationDeliveries)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.audit_logs (id, "userId", action, entity, "entityId", before, after, at)
SELECT ${id('audit')},
       ${pick('users', 'i')},
       (ARRAY['CREATE','UPDATE','DELETE','LOGIN','EXPORT'])[1 + i % 5],
       (ARRAY['prospect','representant','bank_case','visite','user'])[1 + i % 5],
       ${id('prospect', 'i % ' + String(DEMO_VOLUMES.prospects))},
       CASE WHEN i % 5 = 1 THEN jsonb_build_object('statut', 'NOUVEAU') END,
       jsonb_build_object('statut', 'CONTACTE', 'rang', i),
       ${daysAgo('i % 365')}
${series(DEMO_VOLUMES.auditLogs)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.sync_batches (idempotency_key, "userId", "requestHash", status, "httpStatus", "responseJson", "createdAt", "completedAt", "expiresAt")
SELECT 'batch-demo-' || lpad(i::text, 6, '0'),
       ${pick('users', 'i')},
       md5('request:' || i),
       (ARRAY['COMPLETED','COMPLETED','IN_PROGRESS'])[1 + i % 3]::demo."BatchStatus",
       CASE WHEN i % 3 <> 2 THEN 200 END,
       jsonb_build_object('operations', 1 + i % 8),
       ${daysAgo('i % 60')},
       CASE WHEN i % 3 <> 2 THEN ${daysAgo('i % 60')} END,
       now() + interval '7 days'
${series(DEMO_VOLUMES.syncBatches)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.sync_operations ("opId", "userId", "batchKey", "entityType", "entityId", result, "resultJson", "appliedAt")
SELECT ${id('operation')},
       ${pick('users', 'i % ' + String(DEMO_VOLUMES.syncBatches))},
       'batch-demo-' || lpad((i % ${String(DEMO_VOLUMES.syncBatches)})::text, 6, '0'),
       (ARRAY['prospect','representant','call_attempt','visite'])[1 + i % 4],
       ${id('prospect', 'i % ' + String(DEMO_VOLUMES.prospects))},
       (ARRAY['APPLIED','APPLIED','DUPLICATE','CONFLICT','INVALID','SKIPPED_DEPENDENCY_FAILED'])[1 + i % 6]::demo."OperationResult",
       jsonb_build_object('rev', 1 + i % 4),
       ${daysAgo('i % 60')}
${series(DEMO_VOLUMES.syncOperations)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.device_tokens (id, "userId", token, platform, "appVersion", "lastSeenAt", "revokedAt", "pendingOps", "pendingSince", "createdAt", "updatedAt")
SELECT ${id('device')},
       ${pick('users', 'i')},
       'fcm-demo-' || md5('device:' || i),
       (ARRAY['ANDROID','ANDROID','IOS','WEB'])[1 + i % 4]::demo."DevicePlatform",
       '1.' || (10 + i % 8) || '.0',
       ${daysAgo('i % 14')},
       CASE WHEN i % 17 = 0 THEN ${daysAgo('i % 30')} END,
       i % 12,
       CASE WHEN i % 12 <> 0 THEN ${daysAgo('i % 3')} END,
       ${daysAgo('i % 200')},
       now()
${series(DEMO_VOLUMES.deviceTokens)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.refresh_tokens (id, "userId", "tokenHash", "familyId", "expiresAt", "revokedAt", "userAgent", "createdAt")
SELECT ${id('refresh')},
       ${pick('users', 'i')},
       md5('refresh:' || i),
       ${id('famille', 'i / 3')},
       now() + interval '30 days',
       CASE WHEN i % 4 = 0 THEN ${daysAgo('i % 20')} END,
       (ARRAY['cpi-go-android/1.14.0','Mozilla/5.0 (Windows NT 10.0)','cpi-go-admin-panel'])[1 + i % 3],
       ${daysAgo('i % 45')}
${series(DEMO_VOLUMES.refreshTokens)}`,
  ),

  ref(
    ['users'],
    `INSERT INTO demo.agent_activity_slots ("userId", slot, "firstSeenAt", "lastSeenAt", "activeSeconds")
SELECT ${pick('users', 'i')},
       date_trunc('hour', now()) - ((i / cardinality(r.users)) || ' hours')::interval,
       date_trunc('hour', now()) - ((i / cardinality(r.users)) || ' hours')::interval,
       date_trunc('hour', now()) - ((i / cardinality(r.users)) || ' hours')::interval + interval '52 minutes',
       600 + i % 3000
${series(DEMO_VOLUMES.agentActivitySlots)}`,
  ),

  `INSERT INTO demo.agent_heartbeats ("userId", "lastPullAt", "lastPushAt", "pendingOps", "appVersion", "updatedAt")
SELECT u.id,
       now() - ((u.rang % 90) || ' minutes')::interval,
       now() - ((u.rang % 120) || ' minutes')::interval,
       u.rang % 9,
       '1.' || (10 + u.rang % 8) || '.0',
       now()
FROM (SELECT id, (row_number() OVER (ORDER BY id))::int AS rang FROM demo.users) u`,

  `INSERT INTO demo.dashboard_layouts ("userId", layout, "updatedAt", ecran)
SELECT u.id,
       jsonb_build_object('cartes', jsonb_build_array('appels', 'conversions', 'dossiers'), 'ordre', u.rang % 3),
       now(),
       ecran
FROM (SELECT id, (row_number() OVER (ORDER BY id))::int AS rang FROM demo.users) u,
     unnest(ARRAY['supervision', 'accueil']) AS ecran`,

  ref(
    ['users'],
    `INSERT INTO demo.android_releases ("versionCode", "versionName", "fileName", "fileSize", sha256, "signerSha256", mandatory, "publishedAt", "publishedById", notes, "withdrawnAt", "withdrawnById")
SELECT 100 + i,
       '1.' || (10 + i) || '.0',
       'cpi-go-1.' || (10 + i) || '.0.apk',
       32000000 + i * 250000,
       md5('apk:' || i) || md5('apk2:' || i),
       md5('signer:' || i) || md5('signer2:' || i),
       i % 3 = 0,
       ${daysAgo('(5 - i) * 30')},
       ${pick('users', 'i')},
       'Correctifs de synchronisation et de journal d''appels.',
       CASE WHEN i = 0 THEN now() - interval '150 days' END,
       CASE WHEN i = 0 THEN ${pick('users', 'i')} END
${series(DEMO_VOLUMES.androidReleases)}`,
  ),
];

export async function generateDemoVolume(db: PrismaClient): Promise<void> {
  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);
  await db.$executeRawUnsafe(`ANALYZE`);
}
