-- Schéma de référence v2 : pg_dump --schema-only de la base v1 (78 migrations Prisma appliquées), relu le 8 septembre 2026.
-- Les extensions sortent du filtre --schema=public de pg_dump ; elles existent en production.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


CREATE SCHEMA public;

CREATE TYPE public."BankStageType" AS ENUM (
    'OPEN',
    'CASHED',
    'REJECTED'
);

CREATE TYPE public."BatchStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED'
);

CREATE TYPE public."BddSegment" AS ENUM (
    'BDD1',
    'BDD2',
    'BDD3',
    'BDD4'
);

CREATE TYPE public."CallOutcome" AS ENUM (
    'METHOD_OBTAINED',
    'UNREACHABLE',
    'CALLBACK',
    'REFUSED',
    'WRONG_NUMBER',
    'OTHER'
);

CREATE TYPE public."CallOutcomeEffect" AS ENUM (
    'CLOSE_METHOD',
    'CLOSE_REFUSED',
    'CLOSE_WRONG_NUMBER',
    'KEEP_OPEN',
    'SCHEDULE_CALLBACK'
);

CREATE TYPE public."ChangeSource" AS ENUM (
    'WEB',
    'MOBILE'
);

CREATE TYPE public."ClientRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE public."DevicePlatform" AS ENUM (
    'ANDROID',
    'IOS',
    'WEB'
);

CREATE TYPE public."EmployeurType" AS ENUM (
    'MINISTERE',
    'ENTREPRISE',
    'AUTRE'
);

CREATE TYPE public."EnrollmentMethod" AS ENUM (
    'PLATFORM',
    'PHYSICAL',
    'VOICE_OR_ELECTRONIC_MESSAGING',
    'APPOINTMENT',
    'WHATSAPP',
    'RDV_CPI',
    'PLATEFORME_EN_LIGNE',
    'MAIL'
);

CREATE TYPE public."GrandPublicConsent" AS ENUM (
    'NON_DEMANDE',
    'INTERESSE',
    'REFUSE'
);

CREATE TYPE public."ImportKind" AS ENUM (
    'REPRESENTANTS',
    'PROSPECTS',
    'VISITES',
    'PROSPECTS_GRAND_PUBLIC',
    'VISITES_REGISTRE'
);

CREATE TYPE public."ImportMode" AS ENUM (
    'DRY_RUN',
    'APPLY'
);

CREATE TYPE public."ImportStatus" AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'expired'
);

CREATE TYPE public."LotExportCible" AS ENUM (
    'REPRESENTANTS',
    'PROSPECTS',
    'REPRESENTANTS_INJOIGNABLES',
    'CONTACTS_RECOMMANDES'
);

CREATE TYPE public."ModeEpargne" AS ENUM (
    'TONTINE',
    'MOBILE_MONEY',
    'BANQUE',
    'AUCUN'
);

CREATE TYPE public."NotificationAudience" AS ENUM (
    'ALL',
    'ROLE',
    'DEPARTEMENT',
    'USERS'
);

CREATE TYPE public."NotificationCategory" AS ENUM (
    'ANNONCE',
    'RAPPEL',
    'CAMPAGNE',
    'DOSSIER',
    'SYSTEME'
);

CREATE TYPE public."NotificationDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'FAILED',
    'READ'
);

CREATE TYPE public."NotificationStatus" AS ENUM (
    'SCHEDULED',
    'SENDING',
    'SENT',
    'CANCELLED'
);

CREATE TYPE public."OperationResult" AS ENUM (
    'APPLIED',
    'DUPLICATE',
    'CONFLICT',
    'INVALID',
    'SKIPPED_DEPENDENCY_FAILED'
);

CREATE TYPE public."PaymentMode" AS ENUM (
    'COMPTANT',
    'ECHELONNE'
);

CREATE TYPE public."Phase2Status" AS ENUM (
    'PENDING',
    'METHOD_OBTAINED',
    'REFUSED',
    'WRONG_NUMBER'
);

CREATE TYPE public."PrioriteTraitement" AS ENUM (
    'HAUTE',
    'NORMALE',
    'BASSE'
);

CREATE TYPE public."Projet" AS ENUM (
    'CHUES',
    'GRAND_PUBLIC'
);

CREATE TYPE public."ProspectStatut" AS ENUM (
    'NOUVEAU',
    'CONTACTE',
    'CONVERTI',
    'PERDU'
);

CREATE TYPE public."ProspectType" AS ENUM (
    'FONCTIONNAIRE',
    'SECTEUR_PRIVE',
    'INFORMEL',
    'DIASPORA'
);

CREATE TYPE public."RappelOrigine" AS ENUM (
    'PROMIS',
    'AUTOMATIQUE'
);

CREATE TYPE public."RepCallOutcome" AS ENUM (
    'REACHED',
    'PROSPECTS_PROMISED',
    'UNREACHABLE',
    'CALLBACK',
    'REFUSED',
    'WRONG_NUMBER',
    'OTHER'
);

CREATE TYPE public."RepresentantRelation" AS ENUM (
    'INCONNU',
    'CONTACTE',
    'AMBASSADEUR',
    'REFUS'
);

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'COMMERCIAL',
    'BANQUE_FINANCE',
    'SUPERVISEUR',
    'DIRECTION',
    'ACCUEIL',
    'CHARGE_CLIENTELE'
);

CREATE TYPE public."ScheduledCallbackStatus" AS ENUM (
    'PENDING',
    'DONE',
    'CANCELLED',
    'SUPERSEDED'
);

CREATE TYPE public."StatutQualificationEffect" AS ENUM (
    'REACHED',
    'REFUSED',
    'SCHEDULE_CALLBACK',
    'UNREACHABLE',
    'WRONG_NUMBER'
);

CREATE TYPE public."SuggestionStatus" AS ENUM (
    'A_APPELER',
    'APPELE',
    'ABANDONNE'
);

CREATE TYPE public."TypeContrat" AS ENUM (
    'CDI',
    'CDD',
    'AUTRE'
);

CREATE TYPE public."VisiteImportChangeKind" AS ENUM (
    'CREATE',
    'UPDATE'
);

CREATE TYPE public."WhatsappStatus" AS ENUM (
    'NON_DEMANDE',
    'MEME_NUMERO',
    'AUTRE_NUMERO',
    'AUCUN'
);

CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT public.unaccent('public.unaccent', $1) $_$;

CREATE FUNCTION public.representant_ambassadeur_vaut_accepte() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."relationStatus" = 'AMBASSADEUR' THEN
    NEW."statutQualificationId" := (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'ACCEPTE');
  ELSIF NEW."relationStatus" = 'REFUS' AND NEW."statutQualificationId" IS NULL THEN
    NEW."statutQualificationId" := (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'REFUSE');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.agent_activity_slots (
    "userId" text NOT NULL,
    slot timestamp(3) without time zone NOT NULL,
    "firstSeenAt" timestamp(3) without time zone NOT NULL,
    "lastSeenAt" timestamp(3) without time zone NOT NULL,
    "activeSeconds" integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.agent_heartbeats (
    "userId" text NOT NULL,
    "lastPullAt" timestamp(3) without time zone,
    "lastPushAt" timestamp(3) without time zone,
    "pendingOps" integer,
    "appVersion" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "journalAppelsAutorise" boolean
);

CREATE TABLE public.android_releases (
    "versionCode" integer NOT NULL,
    "versionName" text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    sha256 text NOT NULL,
    "signerSha256" text NOT NULL,
    mandatory boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publishedById" text,
    notes text,
    "withdrawnAt" timestamp(3) without time zone,
    "withdrawnById" text
);

CREATE TABLE public.app_setting_changes (
    id text NOT NULL,
    key text NOT NULL,
    "oldValue" text,
    "newValue" text NOT NULL,
    "changedById" text,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    "updatedById" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    before jsonb,
    after jsonb,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.bank_case_stages (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "position" integer NOT NULL,
    color text NOT NULL,
    type public."BankStageType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isInitial" boolean DEFAULT false NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.bank_case_transitions (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "fromStageId" text,
    "toStageId" text NOT NULL,
    "performedById" text NOT NULL,
    "amountXof" numeric(18,0),
    "rejectionReasonId" text,
    "rejectionDetail" text,
    comment text,
    "correctionReason" text,
    "clientAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.bank_cases (
    id text NOT NULL,
    reference text NOT NULL,
    "referenceKey" text NOT NULL,
    "prospectId" text NOT NULL,
    "customerName" text NOT NULL,
    "customerPhoneE164" text NOT NULL,
    "processingBankId" text NOT NULL,
    "currentStageId" text NOT NULL,
    "amountXof" numeric(18,0),
    "rejectionReasonId" text,
    "rejectionDetail" text,
    rev integer DEFAULT 1 NOT NULL,
    "createdById" text NOT NULL,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    CONSTRAINT bank_cases_amount_non_negative CHECK ((("amountXof" IS NULL) OR ("amountXof" >= (0)::numeric))),
    CONSTRAINT bank_cases_rejection_detail_max_length CHECK ((("rejectionDetail" IS NULL) OR (length("rejectionDetail") <= 2000)))
);

CREATE TABLE public.bank_rejection_reasons (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.banques (
    id text NOT NULL,
    name text NOT NULL,
    "shortName" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.call_attempts (
    id text NOT NULL,
    "prospectId" text NOT NULL,
    "performedById" text NOT NULL,
    outcome public."CallOutcome" NOT NULL,
    method public."EnrollmentMethod",
    comment text,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reasonId" text,
    email text,
    fonctionnaire boolean,
    "engagementEnCours" boolean,
    "dureeEtablissementMois" integer,
    "rendezVousAt" timestamp(3) without time zone,
    "deviceCallType" text,
    "deviceCallDurationSeconds" integer,
    "deviceCallAt" timestamp(3) without time zone,
    CONSTRAINT call_attempts_comment_max_length CHECK (((comment IS NULL) OR (length(comment) <= 2000))),
    CONSTRAINT call_attempts_duree_etablissement_range CHECK ((("dureeEtablissementMois" IS NULL) OR (("dureeEtablissementMois" >= 0) AND ("dureeEtablissementMois" <= 600)))),
    CONSTRAINT call_attempts_email_max_length CHECK (((email IS NULL) OR (length(email) <= 160))),
    CONSTRAINT call_attempts_method_matches_outcome CHECK ((((outcome = 'METHOD_OBTAINED'::public."CallOutcome") AND (method IS NOT NULL)) OR ((outcome <> 'METHOD_OBTAINED'::public."CallOutcome") AND (method IS NULL)))),
    CONSTRAINT call_attempts_other_requires_comment CHECK (((outcome <> 'OTHER'::public."CallOutcome") OR ((comment IS NOT NULL) AND (length(btrim(comment)) > 0)))),
    CONSTRAINT call_attempts_preuve_appareil_toutes_ou_aucune CHECK (((("deviceCallType" IS NULL) AND ("deviceCallDurationSeconds" IS NULL) AND ("deviceCallAt" IS NULL)) OR (("deviceCallType" IS NOT NULL) AND ("deviceCallDurationSeconds" IS NOT NULL) AND ("deviceCallAt" IS NOT NULL)))),
    CONSTRAINT call_attempts_rendez_vous_matches_method CHECK ((((method)::text = 'RDV_CPI'::text) OR ((method = 'APPOINTMENT'::public."EnrollmentMethod") AND ("rendezVousAt" IS NOT NULL)) OR ((method IS DISTINCT FROM 'APPOINTMENT'::public."EnrollmentMethod") AND ("rendezVousAt" IS NULL))))
);

CREATE TABLE public.call_outcome_reasons (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    effect public."CallOutcomeEffect" NOT NULL,
    "requiresComment" boolean DEFAULT false NOT NULL,
    "requiresCallback" boolean DEFAULT false NOT NULL,
    "countsAsReached" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    color text,
    "minPayloadVersion" integer DEFAULT 2 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.canaux_provenance (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.client_creation_requests (
    id text NOT NULL,
    nom text NOT NULL,
    prenom text NOT NULL,
    "phoneE164" text NOT NULL,
    note text,
    "banqueId" text NOT NULL,
    "requestedById" text NOT NULL,
    status public."ClientRequestStatus" DEFAULT 'PENDING'::public."ClientRequestStatus" NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "rejectionNote" text,
    "createdProspectId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT client_creation_requests_approved_has_prospect CHECK (((status <> 'APPROVED'::public."ClientRequestStatus") OR ("createdProspectId" IS NOT NULL))),
    CONSTRAINT client_creation_requests_rejected_has_note CHECK (((status <> 'REJECTED'::public."ClientRequestStatus") OR (("rejectionNote" IS NOT NULL) AND (length(btrim("rejectionNote")) > 0))))
);

CREATE TABLE public.dashboard_layouts (
    "userId" text CONSTRAINT "visite_dashboard_layouts_userId_not_null" NOT NULL,
    layout jsonb CONSTRAINT visite_dashboard_layouts_layout_not_null NOT NULL,
    "updatedAt" timestamp(3) without time zone CONSTRAINT "visite_dashboard_layouts_updatedAt_not_null" NOT NULL,
    ecran text NOT NULL
);

CREATE TABLE public.departements (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "regionId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.device_call_detections (
    id text NOT NULL,
    "performedById" text NOT NULL,
    "representantId" text,
    "prospectId" text,
    "deviceCallType" text NOT NULL,
    "deviceCallDurationSeconds" integer NOT NULL,
    "deviceCallAt" timestamp(3) without time zone NOT NULL,
    "detectedAt" timestamp(3) without time zone NOT NULL,
    "attemptId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.device_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    platform public."DevicePlatform" DEFAULT 'ANDROID'::public."DevicePlatform" NOT NULL,
    "appVersion" text,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "pendingOps" integer DEFAULT 0 NOT NULL,
    "pendingSince" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.employeurs (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    type public."EmployeurType" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.iefs (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "departementId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.import_jobs (
    id text NOT NULL,
    kind public."ImportKind" NOT NULL,
    status public."ImportStatus" DEFAULT 'queued'::public."ImportStatus" NOT NULL,
    mode public."ImportMode" NOT NULL,
    "requestedById" text NOT NULL,
    "fileName" text NOT NULL,
    "fileBytes" integer NOT NULL,
    "storagePath" text NOT NULL,
    "totalRows" integer,
    "processedRows" integer DEFAULT 0 NOT NULL,
    "createdRows" integer DEFAULT 0 NOT NULL,
    "skippedRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    report jsonb,
    "failureCode" text,
    "failureMsg" text,
    "claimToken" text,
    "claimedAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "finishedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedRows" integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.income_bands (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "minXof" integer,
    "maxXof" integer,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.inscriptions_plateforme (
    id text NOT NULL,
    projet public."Projet" NOT NULL,
    "identifiantDistant" text NOT NULL,
    nom text NOT NULL,
    prenom text NOT NULL,
    "phoneE164" text,
    email text,
    "statutDistant" text NOT NULL,
    "etapeDistante" integer,
    "inscriteLe" timestamp(3) without time zone,
    "soumiseLe" timestamp(3) without time zone,
    "decideeLe" timestamp(3) without time zone,
    "disparueLe" timestamp(3) without time zone,
    "prospectId" text,
    "chargeUtile" jsonb NOT NULL,
    "premierTirageAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dernierTirageAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.lot_export_items (
    "lotId" text NOT NULL,
    "representantId" text,
    "prospectId" text,
    "position" integer NOT NULL,
    "assigneeId" text,
    day integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.lot_export_reaffectations (
    id text NOT NULL,
    "lotId" text NOT NULL,
    "fromAssigneeId" text,
    "toAssigneeId" text NOT NULL,
    fiches integer NOT NULL,
    "performedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    positions integer[] DEFAULT '{}'::integer[] NOT NULL
);

CREATE TABLE public.lots_export (
    id text NOT NULL,
    name text NOT NULL,
    cible public."LotExportCible" NOT NULL,
    projet public."Projet" NOT NULL,
    filters jsonb NOT NULL,
    "itemCount" integer NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.notification_deliveries (
    id text NOT NULL,
    "notificationId" text NOT NULL,
    "userId" text NOT NULL,
    status public."NotificationDeliveryStatus" DEFAULT 'PENDING'::public."NotificationDeliveryStatus" NOT NULL,
    "deviceToken" text,
    error text,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    "reminderKey" text,
    period text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.notification_templates (
    id text NOT NULL,
    name text NOT NULL,
    category public."NotificationCategory" DEFAULT 'ANNONCE'::public."NotificationCategory" NOT NULL,
    "titleTemplate" text NOT NULL,
    "bodyTemplate" text NOT NULL,
    route text,
    variables text[] DEFAULT ARRAY[]::text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.notifications (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    category public."NotificationCategory" DEFAULT 'ANNONCE'::public."NotificationCategory" NOT NULL,
    route text,
    payload jsonb,
    audience public."NotificationAudience" DEFAULT 'ALL'::public."NotificationAudience" NOT NULL,
    "audienceRole" public."Role",
    "audienceDepartementId" text,
    "audienceUserIds" text[] DEFAULT ARRAY[]::text[],
    status public."NotificationStatus" DEFAULT 'SENT'::public."NotificationStatus" NOT NULL,
    "scheduledFor" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "transportStatus" text,
    "templateId" text,
    "createdById" text,
    "reminderKey" text,
    period text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "dispatchClaim" text
);

CREATE TABLE public.offers (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.ouvertures_fiche (
    id text NOT NULL,
    "openedById" text NOT NULL,
    "representantId" text,
    "prospectId" text,
    "openedAt" timestamp(3) without time zone NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "closingAttemptId" text,
    draft jsonb,
    "releasedById" text,
    "releasedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "firstInputAt" timestamp(3) without time zone,
    CONSTRAINT ouvertures_fiche_chronometre_check CHECK ((("closedAt" IS NULL) OR ("closedAt" >= "openedAt"))),
    CONSTRAINT ouvertures_fiche_cible_check CHECK ((("representantId" IS NULL) <> ("prospectId" IS NULL))),
    CONSTRAINT ouvertures_fiche_liberation_check CHECK (((("releasedById" IS NULL) = ("releasedAt" IS NULL)) AND (("releasedById" IS NULL) OR (("closedAt" IS NOT NULL) AND ("closingAttemptId" IS NULL))))),
    CONSTRAINT ouvertures_fiche_premiere_saisie_check CHECK (((("firstInputAt" IS NULL) OR ("firstInputAt" >= "openedAt")) AND (("firstInputAt" IS NULL) OR ("closedAt" IS NULL) OR ("closedAt" >= "firstInputAt"))))
);

CREATE TABLE public.pays (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    indicatif text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.professions (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isTeaching" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.prospect_conversions (
    id text NOT NULL,
    "journeyId" text NOT NULL,
    "offerId" text,
    "paymentMode" public."PaymentMode",
    "amountXof" integer,
    "durationMonths" integer,
    "confirmedById" text NOT NULL,
    "confirmedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT prospect_conversions_amount_check CHECK ((("amountXof" IS NULL) OR ("amountXof" >= 0))),
    CONSTRAINT prospect_conversions_duration_check CHECK ((("durationMonths" IS NULL) OR (("durationMonths" >= 1) AND ("durationMonths" <= 300)))),
    CONSTRAINT prospect_conversions_payment_check CHECK ((("paymentMode" = 'ECHELONNE'::public."PaymentMode") OR ("durationMonths" IS NULL)))
);

CREATE TABLE public.prospect_journeys (
    id text NOT NULL,
    "prospectId" text NOT NULL,
    projet public."Projet" NOT NULL,
    statut public."ProspectStatut" DEFAULT 'NOUVEAU'::public."ProspectStatut" NOT NULL,
    consent public."GrandPublicConsent" DEFAULT 'NON_DEMANDE'::public."GrandPublicConsent" NOT NULL,
    "consentAt" timestamp(3) without time zone,
    "consentById" text,
    "convertedAt" timestamp(3) without time zone,
    "convertedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "phase2Status" public."Phase2Status" DEFAULT 'PENDING'::public."Phase2Status" NOT NULL,
    "enrollmentMethod" public."EnrollmentMethod",
    "enrollmentCapturedAt" timestamp(3) without time zone,
    "enrollmentCapturedById" text,
    "closedAt" timestamp(3) without time zone,
    "closedReason" text,
    "closedById" text
);

CREATE TABLE public.prospects (
    id text NOT NULL,
    nom text NOT NULL,
    prenom text NOT NULL,
    "phoneE164" text NOT NULL,
    rev integer DEFAULT 1 NOT NULL,
    "banqueId" text,
    "syndicatId" text,
    "representantId" text,
    "createdById" text NOT NULL,
    statut public."ProspectStatut" DEFAULT 'NOUVEAU'::public."ProspectStatut" NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "enrollmentCapturedAt" timestamp(3) without time zone,
    "enrollmentCapturedById" text,
    "enrollmentMethod" public."EnrollmentMethod",
    "phase2Status" public."Phase2Status" DEFAULT 'PENDING'::public."Phase2Status" NOT NULL,
    origin text,
    "originLabel" text,
    projet public."Projet" DEFAULT 'CHUES'::public."Projet" NOT NULL,
    type public."ProspectType",
    profession text,
    "dureeSystemeMois" integer,
    "canalProvenanceId" text,
    "professionId" text,
    "incomeBandId" text,
    "paymentMode" public."PaymentMode",
    "employeurId" text,
    employeur text,
    "typeContrat" public."TypeContrat",
    "ancienneteMois" integer,
    "lieuActivite" text,
    "modeEpargne" public."ModeEpargne",
    "paysResidenceId" text,
    "villeResidence" text,
    "whatsappE164" text,
    "relaisNom" text,
    "relaisPhoneE164" text,
    "lastCallAt" timestamp(3) without time zone,
    "lastCallById" text,
    "lastCallOutcome" public."CallOutcome",
    "revueAt" timestamp(3) without time zone,
    "revueById" text,
    etablissement text,
    "whatsappStatus" public."WhatsappStatus" DEFAULT 'NON_DEMANDE'::public."WhatsappStatus" NOT NULL,
    "champsLibres" jsonb,
    "aRevoirAt" timestamp(3) without time zone,
    email text,
    CONSTRAINT prospects_enrollment_method_matches_status CHECK (((("phase2Status" = 'METHOD_OBTAINED'::public."Phase2Status") AND ("enrollmentMethod" IS NOT NULL)) OR (("phase2Status" <> 'METHOD_OBTAINED'::public."Phase2Status") AND ("enrollmentMethod" IS NULL)))),
    CONSTRAINT prospects_origin_known CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['BANQUE'::text, 'FORMULAIRE_PUBLIC'::text])))),
    CONSTRAINT prospects_whatsapp_number_matches_status CHECK (((("whatsappStatus" = 'AUTRE_NUMERO'::public."WhatsappStatus") AND ("whatsappE164" IS NOT NULL)) OR (("whatsappStatus" <> 'AUTRE_NUMERO'::public."WhatsappStatus") AND ("whatsappE164" IS NULL))))
);

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "familyId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.regions (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.rep_call_attempts (
    id text NOT NULL,
    "representantId" text NOT NULL,
    "performedById" text NOT NULL,
    outcome public."RepCallOutcome" NOT NULL,
    "promisedProspects" integer,
    comment text,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "callbackAt" timestamp(3) without time zone,
    "connaitUES" boolean,
    contacte boolean,
    "etablissementConfirme" boolean,
    "numeroConfirme" boolean,
    syndicat text,
    "statutQualificationId" text,
    "deviceCallType" text,
    "deviceCallDurationSeconds" integer,
    "deviceCallAt" timestamp(3) without time zone,
    CONSTRAINT rep_call_attempts_comment_max_length CHECK (((comment IS NULL) OR (length(comment) <= 2000))),
    CONSTRAINT rep_call_attempts_other_requires_comment CHECK (((outcome <> 'OTHER'::public."RepCallOutcome") OR ((comment IS NOT NULL) AND (length(btrim(comment)) > 0)))),
    CONSTRAINT rep_call_attempts_preuve_appareil_toutes_ou_aucune CHECK (((("deviceCallType" IS NULL) AND ("deviceCallDurationSeconds" IS NULL) AND ("deviceCallAt" IS NULL)) OR (("deviceCallType" IS NOT NULL) AND ("deviceCallDurationSeconds" IS NOT NULL) AND ("deviceCallAt" IS NOT NULL)))),
    CONSTRAINT rep_call_attempts_promised_only_when_promised CHECK ((("promisedProspects" IS NULL) OR ((outcome = 'PROSPECTS_PROMISED'::public."RepCallOutcome") AND ("promisedProspects" >= 0))))
);

CREATE TABLE public.representant_comments (
    id text NOT NULL,
    "representantId" text NOT NULL,
    "authorId" text NOT NULL,
    body text NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

CREATE TABLE public.representant_relation_changes (
    id text NOT NULL,
    "representantId" text NOT NULL,
    "fromStatus" public."RepresentantRelation" NOT NULL,
    "toStatus" public."RepresentantRelation" NOT NULL,
    reason text,
    "changedById" text NOT NULL,
    source public."ChangeSource" NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.representant_suggestions (
    id text NOT NULL,
    "sourceRepresentantId" text NOT NULL,
    "suggestedName" text,
    "suggestedPhoneE164" text NOT NULL,
    note text,
    "suggestedById" text NOT NULL,
    "resolvedRepresentantId" text,
    "sourceAttemptId" text NOT NULL,
    status public."SuggestionStatus" DEFAULT 'A_APPELER'::public."SuggestionStatus" NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

CREATE TABLE public.representants (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "phoneE164" text NOT NULL,
    notes text,
    rev integer DEFAULT 1 NOT NULL,
    "departementId" text NOT NULL,
    "createdById" text NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "iefId" text,
    "relationStatus" public."RepresentantRelation" DEFAULT 'INCONNU'::public."RepresentantRelation" NOT NULL,
    "whatsappStatus" public."WhatsappStatus" DEFAULT 'NON_DEMANDE'::public."WhatsappStatus" NOT NULL,
    "whatsappE164" text,
    profession text,
    prenom text,
    etablissement text,
    "connaitUES" boolean,
    contacte boolean,
    syndicat text,
    "lastCallAt" timestamp(3) without time zone,
    "lastCallById" text,
    "lastCallOutcome" public."RepCallOutcome",
    "nextCallbackAt" timestamp(3) without time zone,
    "statutQualificationId" text,
    "nextCallbackOrigine" public."RappelOrigine",
    CONSTRAINT representants_next_callback_origine_check CHECK ((("nextCallbackAt" IS NULL) = ("nextCallbackOrigine" IS NULL))),
    CONSTRAINT representants_whatsapp_number_matches_status CHECK (((("whatsappStatus" = 'AUTRE_NUMERO'::public."WhatsappStatus") AND ("whatsappE164" IS NOT NULL)) OR (("whatsappStatus" <> 'AUTRE_NUMERO'::public."WhatsappStatus") AND ("whatsappE164" IS NULL))))
);

CREATE TABLE public.scheduled_callbacks (
    id text NOT NULL,
    "prospectId" text NOT NULL,
    "assignedToId" text NOT NULL,
    "scheduledAt" timestamp(3) without time zone NOT NULL,
    comment text,
    "sourceAttemptId" text NOT NULL,
    status public."ScheduledCallbackStatus" DEFAULT 'PENDING'::public."ScheduledCallbackStatus" NOT NULL,
    "closedAttemptId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.segment_changes (
    id text NOT NULL,
    "prospectId" text NOT NULL,
    "fromSegment" public."BddSegment" NOT NULL,
    "toSegment" public."BddSegment" NOT NULL,
    "fromBanqueId" text NOT NULL,
    "toBanqueId" text NOT NULL,
    "fromSyndicatId" text NOT NULL,
    "toSyndicatId" text NOT NULL,
    reason text,
    "changedById" text NOT NULL,
    source public."ChangeSource" NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.statuts_qualification (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    effect public."StatutQualificationEffect" NOT NULL,
    "requiresCallback" boolean DEFAULT false NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "minPayloadVersion" integer DEFAULT 6 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    priorite public."PrioriteTraitement" DEFAULT 'NORMALE'::public."PrioriteTraitement" NOT NULL,
    "relationStatus" public."RepresentantRelation",
    "retryAfterMinutes" integer,
    "requiresComment" boolean DEFAULT false NOT NULL
);

CREATE TABLE public.sync_batches (
    idempotency_key text NOT NULL,
    "userId" text NOT NULL,
    "requestHash" text NOT NULL,
    status public."BatchStatus" DEFAULT 'IN_PROGRESS'::public."BatchStatus" NOT NULL,
    "httpStatus" integer,
    "responseJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.sync_operations (
    "opId" text NOT NULL,
    "userId" text NOT NULL,
    "batchKey" text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    result public."OperationResult" NOT NULL,
    "resultJson" jsonb,
    "appliedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.syndicats (
    id text NOT NULL,
    name text NOT NULL,
    sigle text NOT NULL,
    secteur text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "fullName" text NOT NULL,
    "phoneE164" text,
    role public."Role" DEFAULT 'COMMERCIAL'::public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "departementId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

CREATE TABLE public.visite_destinataires (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.visite_directions (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.visite_entreprises (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.visite_import_changes (
    id text NOT NULL,
    "importJobId" text NOT NULL,
    sheet text NOT NULL,
    "rowNumber" integer NOT NULL,
    kind public."VisiteImportChangeKind" NOT NULL,
    reference text,
    "visiteId" text,
    label text NOT NULL,
    fields jsonb NOT NULL,
    "rowHash" text,
    selected boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.visite_objets (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE public.visites (
    id text NOT NULL,
    reference text NOT NULL,
    "visitedAt" timestamp(3) without time zone NOT NULL,
    "timeKnown" boolean DEFAULT true NOT NULL,
    "visitorName" text NOT NULL,
    phone text,
    "phoneE164" text,
    "entrepriseId" text NOT NULL,
    "objetId" text NOT NULL,
    "directionId" text,
    "destinataireId" text,
    comment text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.agent_activity_slots
    ADD CONSTRAINT agent_activity_slots_pkey PRIMARY KEY ("userId", slot);

ALTER TABLE ONLY public.agent_heartbeats
    ADD CONSTRAINT agent_heartbeats_pkey PRIMARY KEY ("userId");

ALTER TABLE ONLY public.android_releases
    ADD CONSTRAINT android_releases_pkey PRIMARY KEY ("versionCode");

ALTER TABLE ONLY public.app_setting_changes
    ADD CONSTRAINT app_setting_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bank_case_stages
    ADD CONSTRAINT bank_case_stages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT bank_case_transitions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT bank_cases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bank_rejection_reasons
    ADD CONSTRAINT bank_rejection_reasons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.banques
    ADD CONSTRAINT banques_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT call_attempts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.call_outcome_reasons
    ADD CONSTRAINT call_outcome_reasons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.canaux_provenance
    ADD CONSTRAINT canaux_provenance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_creation_requests
    ADD CONSTRAINT client_creation_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT dashboard_layouts_pkey PRIMARY KEY ("userId", ecran);

ALTER TABLE ONLY public.departements
    ADD CONSTRAINT departements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_call_detections
    ADD CONSTRAINT device_call_detections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employeurs
    ADD CONSTRAINT employeurs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.iefs
    ADD CONSTRAINT iefs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.income_bands
    ADD CONSTRAINT income_bands_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inscriptions_plateforme
    ADD CONSTRAINT inscriptions_plateforme_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lot_export_items
    ADD CONSTRAINT lot_export_items_pkey PRIMARY KEY ("lotId", "position");

ALTER TABLE public.lot_export_items
    ADD CONSTRAINT lot_export_items_une_seule_cible CHECK ((num_nonnulls("representantId", "prospectId") = 1)) NOT VALID;

ALTER TABLE ONLY public.lot_export_reaffectations
    ADD CONSTRAINT lot_export_reaffectations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lots_export
    ADD CONSTRAINT lots_export_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ouvertures_fiche
    ADD CONSTRAINT ouvertures_fiche_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pays
    ADD CONSTRAINT pays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.professions
    ADD CONSTRAINT professions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prospect_conversions
    ADD CONSTRAINT prospect_conversions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT prospect_journeys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rep_call_attempts
    ADD CONSTRAINT rep_call_attempts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.representant_comments
    ADD CONSTRAINT representant_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.representant_relation_changes
    ADD CONSTRAINT representant_relation_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.representant_suggestions
    ADD CONSTRAINT representant_suggestions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT representants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.scheduled_callbacks
    ADD CONSTRAINT scheduled_callbacks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.segment_changes
    ADD CONSTRAINT segment_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.statuts_qualification
    ADD CONSTRAINT statuts_qualification_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sync_batches
    ADD CONSTRAINT sync_batches_pkey PRIMARY KEY ("userId", idempotency_key);

ALTER TABLE ONLY public.sync_operations
    ADD CONSTRAINT sync_operations_pkey PRIMARY KEY ("opId");

ALTER TABLE ONLY public.syndicats
    ADD CONSTRAINT syndicats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visite_destinataires
    ADD CONSTRAINT visite_destinataires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visite_directions
    ADD CONSTRAINT visite_directions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visite_entreprises
    ADD CONSTRAINT visite_entreprises_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visite_import_changes
    ADD CONSTRAINT visite_import_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visite_objets
    ADD CONSTRAINT visite_objets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT visites_pkey PRIMARY KEY (id);

CREATE INDEX agent_activity_slots_slot_idx ON public.agent_activity_slots USING btree (slot);

CREATE INDEX "android_releases_publishedAt_idx" ON public.android_releases USING btree ("publishedAt");

CREATE INDEX "app_setting_changes_key_changedAt_idx" ON public.app_setting_changes USING btree (key, "changedAt");

CREATE INDEX audit_logs_at_idx ON public.audit_logs USING btree (at);

CREATE INDEX "audit_logs_entity_entityId_idx" ON public.audit_logs USING btree (entity, "entityId");

CREATE INDEX "audit_logs_userId_at_idx" ON public.audit_logs USING btree ("userId", at);

CREATE UNIQUE INDEX bank_case_stages_code_key ON public.bank_case_stages USING btree (code);

CREATE UNIQUE INDEX bank_case_stages_single_cashed ON public.bank_case_stages USING btree (type) WHERE (type = 'CASHED'::public."BankStageType");

CREATE UNIQUE INDEX bank_case_stages_single_initial ON public.bank_case_stages USING btree ("isInitial") WHERE ("isInitial" = true);

CREATE UNIQUE INDEX bank_case_stages_single_rejected ON public.bank_case_stages USING btree (type) WHERE (type = 'REJECTED'::public."BankStageType");

CREATE INDEX "bank_case_stages_type_isActive_position_idx" ON public.bank_case_stages USING btree (type, "isActive", "position");

CREATE INDEX "bank_case_transitions_caseId_createdAt_idx" ON public.bank_case_transitions USING btree ("caseId", "createdAt");

CREATE INDEX "bank_case_transitions_performedById_createdAt_idx" ON public.bank_case_transitions USING btree ("performedById", "createdAt");

CREATE INDEX "bank_case_transitions_toStageId_idx" ON public.bank_case_transitions USING btree ("toStageId");

CREATE INDEX "bank_cases_createdAt_idx" ON public.bank_cases USING btree ("createdAt");

CREATE INDEX "bank_cases_createdById_idx" ON public.bank_cases USING btree ("createdById");

CREATE INDEX "bank_cases_currentStageId_idx" ON public.bank_cases USING btree ("currentStageId");

CREATE INDEX "bank_cases_deletedAt_idx" ON public.bank_cases USING btree ("deletedAt");

CREATE INDEX "bank_cases_processingBankId_idx" ON public.bank_cases USING btree ("processingBankId");

CREATE INDEX "bank_cases_prospectId_idx" ON public.bank_cases USING btree ("prospectId");

CREATE UNIQUE INDEX "bank_cases_referenceKey_key" ON public.bank_cases USING btree ("referenceKey") WHERE ("deletedAt" IS NULL);

CREATE UNIQUE INDEX bank_rejection_reasons_code_key ON public.bank_rejection_reasons USING btree (code);

CREATE UNIQUE INDEX bank_rejection_reasons_label_key ON public.bank_rejection_reasons USING btree (label);

CREATE UNIQUE INDEX banques_name_key ON public.banques USING btree (name);

CREATE UNIQUE INDEX "banques_shortName_key" ON public.banques USING btree ("shortName");

CREATE INDEX "banques_updatedAt_idx" ON public.banques USING btree ("updatedAt");

CREATE INDEX "call_attempts_performedById_clientCreatedAt_idx" ON public.call_attempts USING btree ("performedById", "clientCreatedAt");

CREATE INDEX "call_attempts_performedById_createdAt_idx" ON public.call_attempts USING btree ("performedById", "createdAt");

CREATE INDEX "call_attempts_prospectId_createdAt_idx" ON public.call_attempts USING btree ("prospectId", "createdAt");

CREATE INDEX "call_attempts_reasonId_clientCreatedAt_idx" ON public.call_attempts USING btree ("reasonId", "clientCreatedAt");

CREATE UNIQUE INDEX call_outcome_reasons_code_key ON public.call_outcome_reasons USING btree (code);

CREATE INDEX "call_outcome_reasons_effect_isActive_idx" ON public.call_outcome_reasons USING btree (effect, "isActive");

CREATE INDEX "call_outcome_reasons_isActive_sortOrder_idx" ON public.call_outcome_reasons USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX call_outcome_reasons_label_key ON public.call_outcome_reasons USING btree (label);

CREATE UNIQUE INDEX canaux_provenance_code_key ON public.canaux_provenance USING btree (code);

CREATE INDEX "canaux_provenance_isActive_position_idx" ON public.canaux_provenance USING btree ("isActive", "position");

CREATE UNIQUE INDEX canaux_provenance_label_key ON public.canaux_provenance USING btree (label);

CREATE INDEX "canaux_provenance_updatedAt_id_idx" ON public.canaux_provenance USING btree ("updatedAt", id);

CREATE INDEX "client_creation_requests_banqueId_idx" ON public.client_creation_requests USING btree ("banqueId");

CREATE UNIQUE INDEX client_creation_requests_pending_phone_key ON public.client_creation_requests USING btree ("phoneE164") WHERE (status = 'PENDING'::public."ClientRequestStatus");

CREATE INDEX "client_creation_requests_phoneE164_idx" ON public.client_creation_requests USING btree ("phoneE164");

CREATE INDEX "client_creation_requests_requestedById_idx" ON public.client_creation_requests USING btree ("requestedById");

CREATE INDEX "client_creation_requests_status_createdAt_idx" ON public.client_creation_requests USING btree (status, "createdAt");

CREATE UNIQUE INDEX departements_code_key ON public.departements USING btree (code);

CREATE UNIQUE INDEX "departements_regionId_name_key" ON public.departements USING btree ("regionId", name);

CREATE INDEX "departements_updatedAt_idx" ON public.departements USING btree ("updatedAt");

CREATE INDEX "device_call_detections_performedById_deviceCallAt_idx" ON public.device_call_detections USING btree ("performedById", "deviceCallAt");

CREATE INDEX "device_call_detections_prospectId_deviceCallAt_idx" ON public.device_call_detections USING btree ("prospectId", "deviceCallAt");

CREATE INDEX "device_call_detections_representantId_deviceCallAt_idx" ON public.device_call_detections USING btree ("representantId", "deviceCallAt");

CREATE INDEX "device_tokens_revokedAt_idx" ON public.device_tokens USING btree ("revokedAt");

CREATE UNIQUE INDEX device_tokens_token_key ON public.device_tokens USING btree (token);

CREATE INDEX "device_tokens_userId_revokedAt_idx" ON public.device_tokens USING btree ("userId", "revokedAt");

CREATE UNIQUE INDEX employeurs_code_key ON public.employeurs USING btree (code);

CREATE INDEX "employeurs_isActive_position_idx" ON public.employeurs USING btree ("isActive", "position");

CREATE INDEX "employeurs_updatedAt_id_idx" ON public.employeurs USING btree ("updatedAt", id);

CREATE UNIQUE INDEX iefs_code_key ON public.iefs USING btree (code);

CREATE UNIQUE INDEX "iefs_departementId_name_key" ON public.iefs USING btree ("departementId", name);

CREATE INDEX "iefs_updatedAt_idx" ON public.iefs USING btree ("updatedAt");

CREATE INDEX "import_jobs_kind_status_createdAt_idx" ON public.import_jobs USING btree (kind, status, "createdAt");

CREATE INDEX "import_jobs_requestedById_createdAt_idx" ON public.import_jobs USING btree ("requestedById", "createdAt");

CREATE INDEX "import_jobs_status_claimedAt_idx" ON public.import_jobs USING btree (status, "claimedAt");

CREATE UNIQUE INDEX income_bands_code_key ON public.income_bands USING btree (code);

CREATE INDEX "income_bands_isActive_position_idx" ON public.income_bands USING btree ("isActive", "position");

CREATE UNIQUE INDEX income_bands_label_key ON public.income_bands USING btree (label);

CREATE UNIQUE INDEX "inscriptions_plateforme_projet_identifiantDistant_key" ON public.inscriptions_plateforme USING btree (projet, "identifiantDistant");

CREATE INDEX "inscriptions_plateforme_projet_inscriteLe_idx" ON public.inscriptions_plateforme USING btree (projet, "inscriteLe");

CREATE INDEX "inscriptions_plateforme_projet_statutDistant_idx" ON public.inscriptions_plateforme USING btree (projet, "statutDistant");

CREATE INDEX "inscriptions_plateforme_prospectId_idx" ON public.inscriptions_plateforme USING btree ("prospectId");

CREATE INDEX "lot_export_items_lotId_assigneeId_day_idx" ON public.lot_export_items USING btree ("lotId", "assigneeId", day);

CREATE INDEX "lot_export_items_prospectId_idx" ON public.lot_export_items USING btree ("prospectId");

CREATE INDEX "lot_export_items_representantId_idx" ON public.lot_export_items USING btree ("representantId");

CREATE INDEX "lot_export_reaffectations_lotId_createdAt_idx" ON public.lot_export_reaffectations USING btree ("lotId", "createdAt");

CREATE INDEX "lots_export_cible_createdAt_idx" ON public.lots_export USING btree (cible, "createdAt");

CREATE INDEX "lots_export_createdById_createdAt_idx" ON public.lots_export USING btree ("createdById", "createdAt");

CREATE INDEX "notification_deliveries_notificationId_status_idx" ON public.notification_deliveries USING btree ("notificationId", status);

CREATE UNIQUE INDEX "notification_deliveries_notificationId_userId_key" ON public.notification_deliveries USING btree ("notificationId", "userId");

CREATE UNIQUE INDEX "notification_deliveries_reminderKey_userId_period_key" ON public.notification_deliveries USING btree ("reminderKey", "userId", period);

CREATE INDEX "notification_deliveries_userId_createdAt_idx" ON public.notification_deliveries USING btree ("userId", "createdAt");

CREATE INDEX "notification_deliveries_userId_status_idx" ON public.notification_deliveries USING btree ("userId", status);

CREATE INDEX notification_templates_category_idx ON public.notification_templates USING btree (category);

CREATE UNIQUE INDEX notification_templates_name_key ON public.notification_templates USING btree (name);

CREATE INDEX notifications_category_idx ON public.notifications USING btree (category);

CREATE INDEX "notifications_createdAt_idx" ON public.notifications USING btree ("createdAt");

CREATE INDEX "notifications_createdById_idx" ON public.notifications USING btree ("createdById");

CREATE UNIQUE INDEX "notifications_reminderKey_period_key" ON public.notifications USING btree ("reminderKey", period);

CREATE INDEX "notifications_status_scheduledFor_idx" ON public.notifications USING btree (status, "scheduledFor");

CREATE UNIQUE INDEX offers_code_key ON public.offers USING btree (code);

CREATE INDEX "offers_isActive_position_idx" ON public.offers USING btree ("isActive", "position");

CREATE UNIQUE INDEX offers_label_key ON public.offers USING btree (label);

CREATE INDEX "ouvertures_fiche_openedAt_idx" ON public.ouvertures_fiche USING btree ("openedAt");

CREATE INDEX "ouvertures_fiche_openedById_openedAt_idx" ON public.ouvertures_fiche USING btree ("openedById", "openedAt");

CREATE INDEX "ouvertures_fiche_prospectId_openedAt_idx" ON public.ouvertures_fiche USING btree ("prospectId", "openedAt");

CREATE INDEX "ouvertures_fiche_representantId_openedAt_idx" ON public.ouvertures_fiche USING btree ("representantId", "openedAt");

CREATE INDEX "ouvertures_fiche_updatedAt_id_idx" ON public.ouvertures_fiche USING btree ("updatedAt", id);

CREATE UNIQUE INDEX ouvertures_fiche_verrou_unique ON public.ouvertures_fiche USING btree ("openedById") WHERE ("closedAt" IS NULL);

CREATE UNIQUE INDEX pays_code_key ON public.pays USING btree (code);

CREATE INDEX "pays_isActive_position_idx" ON public.pays USING btree ("isActive", "position");

CREATE INDEX "pays_updatedAt_id_idx" ON public.pays USING btree ("updatedAt", id);

CREATE UNIQUE INDEX professions_code_key ON public.professions USING btree (code);

CREATE INDEX "professions_isActive_position_idx" ON public.professions USING btree ("isActive", "position");

CREATE UNIQUE INDEX professions_label_key ON public.professions USING btree (label);

CREATE INDEX "professions_updatedAt_id_idx" ON public.professions USING btree ("updatedAt", id);

CREATE UNIQUE INDEX "prospect_conversions_journeyId_key" ON public.prospect_conversions USING btree ("journeyId");

CREATE INDEX "prospect_conversions_offerId_confirmedAt_idx" ON public.prospect_conversions USING btree ("offerId", "confirmedAt");

CREATE INDEX prospect_journeys_projet_consent_idx ON public.prospect_journeys USING btree (projet, consent);

CREATE INDEX "prospect_journeys_projet_phase2Status_closedAt_idx" ON public.prospect_journeys USING btree (projet, "phase2Status", "closedAt");

CREATE INDEX prospect_journeys_projet_statut_idx ON public.prospect_journeys USING btree (projet, statut);

CREATE UNIQUE INDEX "prospect_journeys_prospectId_projet_key" ON public.prospect_journeys USING btree ("prospectId", projet);

CREATE INDEX prospects_a_revoir_idx ON public.prospects USING btree ("aRevoirAt") WHERE ("aRevoirAt" IS NOT NULL);

CREATE INDEX "prospects_banqueId_idx" ON public.prospects USING btree ("banqueId");

CREATE INDEX "prospects_canalProvenanceId_idx" ON public.prospects USING btree ("canalProvenanceId");

CREATE INDEX "prospects_clientCreatedAt_idx" ON public.prospects USING btree ("clientCreatedAt");

CREATE INDEX "prospects_createdById_clientCreatedAt_idx" ON public.prospects USING btree ("createdById", "clientCreatedAt");

CREATE INDEX "prospects_createdById_idx" ON public.prospects USING btree ("createdById");

CREATE INDEX "prospects_deletedAt_idx" ON public.prospects USING btree ("deletedAt");

CREATE INDEX prospects_email_active_idx ON public.prospects USING btree (email) WHERE (("deletedAt" IS NULL) AND (email IS NOT NULL));

CREATE INDEX "prospects_employeurId_idx" ON public.prospects USING btree ("employeurId");

CREATE INDEX "prospects_enrollmentMethod_idx" ON public.prospects USING btree ("enrollmentMethod");

CREATE INDEX "prospects_incomeBandId_idx" ON public.prospects USING btree ("incomeBandId");

CREATE INDEX "prospects_lastCallById_lastCallOutcome_idx" ON public.prospects USING btree ("lastCallById", "lastCallOutcome");

CREATE INDEX prospects_nom_prenom_unaccent_trgm ON public.prospects USING gin (public.immutable_unaccent(((lower(nom) || ' '::text) || lower(prenom))) public.gin_trgm_ops);

CREATE INDEX prospects_origin_idx ON public.prospects USING btree (origin) WHERE (origin IS NOT NULL);

CREATE INDEX "prospects_paysResidenceId_idx" ON public.prospects USING btree ("paysResidenceId");

CREATE INDEX "prospects_phase2Status_idx" ON public.prospects USING btree ("phase2Status");

CREATE INDEX prospects_phase2_directory ON public.prospects USING btree ("updatedAt", id) WHERE ("deletedAt" IS NULL);

CREATE INDEX "prospects_phoneE164_idx" ON public.prospects USING btree ("phoneE164");

CREATE UNIQUE INDEX prospects_phone_e164_active_key ON public.prospects USING btree ("phoneE164") WHERE ("deletedAt" IS NULL);

CREATE INDEX "prospects_professionId_idx" ON public.prospects USING btree ("professionId");

CREATE INDEX prospects_projet_idx ON public.prospects USING btree (projet);

CREATE INDEX "prospects_representantId_idx" ON public.prospects USING btree ("representantId");

CREATE INDEX prospects_statut_idx ON public.prospects USING btree (statut);

CREATE INDEX "prospects_syndicatId_banqueId_idx" ON public.prospects USING btree ("syndicatId", "banqueId");

CREATE INDEX "prospects_syndicatId_idx" ON public.prospects USING btree ("syndicatId");

CREATE INDEX "prospects_updatedAt_id_idx" ON public.prospects USING btree ("updatedAt", id);

CREATE INDEX "refresh_tokens_expiresAt_idx" ON public.refresh_tokens USING btree ("expiresAt");

CREATE INDEX "refresh_tokens_familyId_idx" ON public.refresh_tokens USING btree ("familyId");

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON public.refresh_tokens USING btree ("tokenHash");

CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON public.refresh_tokens USING btree ("userId", "revokedAt");

CREATE UNIQUE INDEX regions_code_key ON public.regions USING btree (code);

CREATE UNIQUE INDEX regions_name_key ON public.regions USING btree (name);

CREATE INDEX "rep_call_attempts_performedById_clientCreatedAt_idx" ON public.rep_call_attempts USING btree ("performedById", "clientCreatedAt");

CREATE INDEX "rep_call_attempts_performedById_createdAt_idx" ON public.rep_call_attempts USING btree ("performedById", "createdAt");

CREATE INDEX "rep_call_attempts_representantId_createdAt_idx" ON public.rep_call_attempts USING btree ("representantId", "createdAt");

CREATE INDEX "representant_comments_authorId_createdAt_idx" ON public.representant_comments USING btree ("authorId", "createdAt");

CREATE INDEX "representant_comments_representantId_clientCreatedAt_idx" ON public.representant_comments USING btree ("representantId", "clientCreatedAt");

CREATE INDEX "representant_relation_changes_changedById_changedAt_idx" ON public.representant_relation_changes USING btree ("changedById", "changedAt");

CREATE INDEX "representant_relation_changes_representantId_changedAt_idx" ON public.representant_relation_changes USING btree ("representantId", "changedAt");

CREATE INDEX "representant_relation_changes_toStatus_changedAt_idx" ON public.representant_relation_changes USING btree ("toStatus", "changedAt");

CREATE UNIQUE INDEX "representant_suggestions_sourceAttemptId_key" ON public.representant_suggestions USING btree ("sourceAttemptId");

CREATE INDEX "representant_suggestions_sourceRepresentantId_createdAt_idx" ON public.representant_suggestions USING btree ("sourceRepresentantId", "createdAt");

CREATE INDEX "representant_suggestions_status_createdAt_idx" ON public.representant_suggestions USING btree (status, "createdAt");

CREATE INDEX "representant_suggestions_suggestedPhoneE164_idx" ON public.representant_suggestions USING btree ("suggestedPhoneE164");

CREATE INDEX "representants_createdById_clientCreatedAt_idx" ON public.representants USING btree ("createdById", "clientCreatedAt");

CREATE INDEX "representants_createdById_idx" ON public.representants USING btree ("createdById");

CREATE INDEX "representants_deletedAt_idx" ON public.representants USING btree ("deletedAt");

CREATE INDEX "representants_departementId_idx" ON public.representants USING btree ("departementId");

CREATE INDEX "representants_iefId_idx" ON public.representants USING btree ("iefId");

CREATE INDEX "representants_lastCallById_lastCallOutcome_idx" ON public.representants USING btree ("lastCallById", "lastCallOutcome");

CREATE INDEX "representants_nextCallbackAt_idx" ON public.representants USING btree ("nextCallbackAt");

CREATE INDEX "representants_phoneE164_idx" ON public.representants USING btree ("phoneE164");

CREATE UNIQUE INDEX representants_phone_e164_active_key ON public.representants USING btree ("phoneE164") WHERE ("deletedAt" IS NULL);

CREATE INDEX "representants_relationStatus_departementId_idx" ON public.representants USING btree ("relationStatus", "departementId");

CREATE INDEX "representants_relationStatus_idx" ON public.representants USING btree ("relationStatus");

CREATE INDEX "representants_statutQualificationId_idx" ON public.representants USING btree ("statutQualificationId");

CREATE INDEX "representants_statutQualificationId_iefId_idx" ON public.representants USING btree ("statutQualificationId", "iefId");

CREATE INDEX "representants_updatedAt_id_idx" ON public.representants USING btree ("updatedAt", id);

CREATE INDEX "representants_whatsappStatus_idx" ON public.representants USING btree ("whatsappStatus");

CREATE INDEX "scheduled_callbacks_assignedToId_status_scheduledAt_idx" ON public.scheduled_callbacks USING btree ("assignedToId", status, "scheduledAt");

CREATE UNIQUE INDEX scheduled_callbacks_one_pending_per_prospect ON public.scheduled_callbacks USING btree ("prospectId") WHERE (status = 'PENDING'::public."ScheduledCallbackStatus");

CREATE INDEX "scheduled_callbacks_prospectId_status_idx" ON public.scheduled_callbacks USING btree ("prospectId", status);

CREATE INDEX "scheduled_callbacks_scheduledAt_status_idx" ON public.scheduled_callbacks USING btree ("scheduledAt", status);

CREATE UNIQUE INDEX "scheduled_callbacks_sourceAttemptId_key" ON public.scheduled_callbacks USING btree ("sourceAttemptId");

CREATE INDEX "segment_changes_changedById_changedAt_idx" ON public.segment_changes USING btree ("changedById", "changedAt");

CREATE INDEX "segment_changes_prospectId_changedAt_idx" ON public.segment_changes USING btree ("prospectId", "changedAt");

CREATE INDEX "segment_changes_toSegment_changedAt_idx" ON public.segment_changes USING btree ("toSegment", "changedAt");

CREATE UNIQUE INDEX statuts_qualification_code_key ON public.statuts_qualification USING btree (code);

CREATE INDEX "statuts_qualification_isActive_sortOrder_idx" ON public.statuts_qualification USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX statuts_qualification_label_key ON public.statuts_qualification USING btree (label);

CREATE INDEX "sync_batches_expiresAt_idx" ON public.sync_batches USING btree ("expiresAt");

CREATE INDEX "sync_operations_entityId_idx" ON public.sync_operations USING btree ("entityId");

CREATE INDEX "sync_operations_userId_appliedAt_idx" ON public.sync_operations USING btree ("userId", "appliedAt");

CREATE UNIQUE INDEX syndicats_name_key ON public.syndicats USING btree (name);

CREATE UNIQUE INDEX syndicats_sigle_key ON public.syndicats USING btree (sigle);

CREATE INDEX "syndicats_updatedAt_idx" ON public.syndicats USING btree ("updatedAt");

CREATE INDEX "users_deletedAt_idx" ON public.users USING btree ("deletedAt");

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE INDEX "users_role_isActive_idx" ON public.users USING btree (role, "isActive");

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

CREATE UNIQUE INDEX visite_destinataires_code_key ON public.visite_destinataires USING btree (code);

CREATE INDEX "visite_destinataires_isActive_sortOrder_idx" ON public.visite_destinataires USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX visite_destinataires_label_key ON public.visite_destinataires USING btree (label);

CREATE INDEX "visite_destinataires_updatedAt_id_idx" ON public.visite_destinataires USING btree ("updatedAt", id);

CREATE UNIQUE INDEX visite_directions_code_key ON public.visite_directions USING btree (code);

CREATE INDEX "visite_directions_isActive_sortOrder_idx" ON public.visite_directions USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX visite_directions_label_key ON public.visite_directions USING btree (label);

CREATE INDEX "visite_directions_updatedAt_id_idx" ON public.visite_directions USING btree ("updatedAt", id);

CREATE UNIQUE INDEX visite_entreprises_code_key ON public.visite_entreprises USING btree (code);

CREATE INDEX "visite_entreprises_isActive_sortOrder_idx" ON public.visite_entreprises USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX visite_entreprises_label_key ON public.visite_entreprises USING btree (label);

CREATE INDEX "visite_entreprises_updatedAt_id_idx" ON public.visite_entreprises USING btree ("updatedAt", id);

CREATE INDEX "visite_import_changes_importJobId_kind_idx" ON public.visite_import_changes USING btree ("importJobId", kind);

CREATE UNIQUE INDEX "visite_import_changes_importJobId_sheet_rowNumber_key" ON public.visite_import_changes USING btree ("importJobId", sheet, "rowNumber");

CREATE UNIQUE INDEX visite_objets_code_key ON public.visite_objets USING btree (code);

CREATE INDEX "visite_objets_isActive_sortOrder_idx" ON public.visite_objets USING btree ("isActive", "sortOrder");

CREATE UNIQUE INDEX visite_objets_label_key ON public.visite_objets USING btree (label);

CREATE INDEX "visite_objets_updatedAt_id_idx" ON public.visite_objets USING btree ("updatedAt", id);

CREATE INDEX "visites_createdById_idx" ON public.visites USING btree ("createdById");

CREATE INDEX "visites_destinataireId_idx" ON public.visites USING btree ("destinataireId");

CREATE INDEX "visites_directionId_idx" ON public.visites USING btree ("directionId");

CREATE INDEX "visites_entrepriseId_idx" ON public.visites USING btree ("entrepriseId");

CREATE INDEX "visites_objetId_idx" ON public.visites USING btree ("objetId");

CREATE UNIQUE INDEX visites_reference_key ON public.visites USING btree (reference);

CREATE INDEX "visites_updatedAt_id_idx" ON public.visites USING btree ("updatedAt", id);

CREATE INDEX "visites_visitedAt_idx" ON public.visites USING btree ("visitedAt");

CREATE TRIGGER representants_ambassadeur_vaut_accepte BEFORE INSERT OR UPDATE OF "relationStatus", "statutQualificationId" ON public.representants FOR EACH ROW EXECUTE FUNCTION public.representant_ambassadeur_vaut_accepte();

ALTER TABLE ONLY public.agent_activity_slots
    ADD CONSTRAINT "agent_activity_slots_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.agent_heartbeats
    ADD CONSTRAINT "agent_heartbeats_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.android_releases
    ADD CONSTRAINT "android_releases_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.app_setting_changes
    ADD CONSTRAINT "app_setting_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT "app_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT "bank_case_transitions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.bank_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT "bank_case_transitions_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES public.bank_case_stages(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT "bank_case_transitions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT "bank_case_transitions_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES public.bank_rejection_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_case_transitions
    ADD CONSTRAINT "bank_case_transitions_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES public.bank_case_stages(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES public.bank_case_stages(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_processingBankId_fkey" FOREIGN KEY ("processingBankId") REFERENCES public.banques(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES public.bank_rejection_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.bank_cases
    ADD CONSTRAINT "bank_cases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT "call_attempts_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT "call_attempts_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT "call_attempts_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES public.call_outcome_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES public.banques(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_createdProspectId_fkey" FOREIGN KEY ("createdProspectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT "dashboard_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.departements
    ADD CONSTRAINT "departements_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.device_call_detections
    ADD CONSTRAINT "device_call_detections_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.device_call_detections
    ADD CONSTRAINT "device_call_detections_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.device_call_detections
    ADD CONSTRAINT "device_call_detections_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.iefs
    ADD CONSTRAINT "iefs_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES public.departements(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT "import_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.inscriptions_plateforme
    ADD CONSTRAINT "inscriptions_plateforme_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.lot_export_items
    ADD CONSTRAINT "lot_export_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.lot_export_items
    ADD CONSTRAINT "lot_export_items_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots_export(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.lot_export_items
    ADD CONSTRAINT "lot_export_items_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.lot_export_items
    ADD CONSTRAINT "lot_export_items_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.lot_export_reaffectations
    ADD CONSTRAINT "lot_export_reaffectations_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.lot_export_reaffectations
    ADD CONSTRAINT "lot_export_reaffectations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots_export(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.lot_export_reaffectations
    ADD CONSTRAINT "lot_export_reaffectations_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.lot_export_reaffectations
    ADD CONSTRAINT "lot_export_reaffectations_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.lots_export
    ADD CONSTRAINT "lots_export_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES public.notifications(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT "notification_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_audienceDepartementId_fkey" FOREIGN KEY ("audienceDepartementId") REFERENCES public.departements(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.ouvertures_fiche
    ADD CONSTRAINT "ouvertures_fiche_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.ouvertures_fiche
    ADD CONSTRAINT "ouvertures_fiche_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.ouvertures_fiche
    ADD CONSTRAINT "ouvertures_fiche_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.ouvertures_fiche
    ADD CONSTRAINT "ouvertures_fiche_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.prospect_conversions
    ADD CONSTRAINT "prospect_conversions_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospect_conversions
    ADD CONSTRAINT "prospect_conversions_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES public.prospect_journeys(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.prospect_conversions
    ADD CONSTRAINT "prospect_conversions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES public.offers(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT "prospect_journeys_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT "prospect_journeys_consentById_fkey" FOREIGN KEY ("consentById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT "prospect_journeys_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT "prospect_journeys_enrollmentCapturedById_fkey" FOREIGN KEY ("enrollmentCapturedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospect_journeys
    ADD CONSTRAINT "prospect_journeys_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES public.banques(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_canalProvenanceId_fkey" FOREIGN KEY ("canalProvenanceId") REFERENCES public.canaux_provenance(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_employeurId_fkey" FOREIGN KEY ("employeurId") REFERENCES public.employeurs(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_enrollmentCapturedById_fkey" FOREIGN KEY ("enrollmentCapturedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_incomeBandId_fkey" FOREIGN KEY ("incomeBandId") REFERENCES public.income_bands(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_lastCallById_fkey" FOREIGN KEY ("lastCallById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_paysResidenceId_fkey" FOREIGN KEY ("paysResidenceId") REFERENCES public.pays(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES public.professions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_revueById_fkey" FOREIGN KEY ("revueById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT "prospects_syndicatId_fkey" FOREIGN KEY ("syndicatId") REFERENCES public.syndicats(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.rep_call_attempts
    ADD CONSTRAINT "rep_call_attempts_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.rep_call_attempts
    ADD CONSTRAINT "rep_call_attempts_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.rep_call_attempts
    ADD CONSTRAINT "rep_call_attempts_statutQualificationId_fkey" FOREIGN KEY ("statutQualificationId") REFERENCES public.statuts_qualification(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representant_comments
    ADD CONSTRAINT "representant_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representant_comments
    ADD CONSTRAINT "representant_comments_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.representant_relation_changes
    ADD CONSTRAINT "representant_relation_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representant_relation_changes
    ADD CONSTRAINT "representant_relation_changes_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.representant_suggestions
    ADD CONSTRAINT "representant_suggestions_resolvedRepresentantId_fkey" FOREIGN KEY ("resolvedRepresentantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.representant_suggestions
    ADD CONSTRAINT "representant_suggestions_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES public.rep_call_attempts(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.representant_suggestions
    ADD CONSTRAINT "representant_suggestions_sourceRepresentantId_fkey" FOREIGN KEY ("sourceRepresentantId") REFERENCES public.representants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.representant_suggestions
    ADD CONSTRAINT "representant_suggestions_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT "representants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT "representants_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES public.departements(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT "representants_iefId_fkey" FOREIGN KEY ("iefId") REFERENCES public.iefs(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT "representants_lastCallById_fkey" FOREIGN KEY ("lastCallById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.representants
    ADD CONSTRAINT "representants_statutQualificationId_fkey" FOREIGN KEY ("statutQualificationId") REFERENCES public.statuts_qualification(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.scheduled_callbacks
    ADD CONSTRAINT "scheduled_callbacks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.scheduled_callbacks
    ADD CONSTRAINT "scheduled_callbacks_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.segment_changes
    ADD CONSTRAINT "segment_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.segment_changes
    ADD CONSTRAINT "segment_changes_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.sync_batches
    ADD CONSTRAINT "sync_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.sync_operations
    ADD CONSTRAINT "sync_operations_userId_batchKey_fkey" FOREIGN KEY ("userId", "batchKey") REFERENCES public.sync_batches("userId", idempotency_key) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES public.departements(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.visite_import_changes
    ADD CONSTRAINT "visite_import_changes_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES public.import_jobs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT "visites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT "visites_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES public.visite_destinataires(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT "visites_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES public.visite_directions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT "visites_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES public.visite_entreprises(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.visites
    ADD CONSTRAINT "visites_objetId_fkey" FOREIGN KEY ("objetId") REFERENCES public.visite_objets(id) ON UPDATE CASCADE ON DELETE RESTRICT;

