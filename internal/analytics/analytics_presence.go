package analytics

import (
	"context"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/socle"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"
)

func moyenneEnSecondes(total, nombre int32) *float64 {
	if nombre == 0 {
		return nil
	}
	valeur := math.Round(float64(total) / float64(nombre))
	return &valeur
}

type CompteursProspects struct {
	Appels        int32
	Confirmes     int32
	Injoignables  int32
	Faux          int32
	Methodes      int32
	Rappels       int32
	Joignables    int32
	Prospects     int32
	Representants int32
	Fiches        int32
	FichesJointes int32
}

type ligneParTeleconseiller struct {
	Jour string
	ID   string
	Nom  string
	CompteursProspects
}

type CompteursRepresentants struct {
	Appels          int32
	Confirmes       int32
	Faux            int32
	Joints          int32
	Rappels         int32
	Injoignables    int32
	Interroges      int32
	Qualifies       int32
	Fiches          int32
	FichesJointes   int32
	FichesAcceptees int32
	FichesRefusees  int32
	FichesARappeler int32
	FichesEligibles int32
}

type ligneRepresentantsParTeleconseiller struct {
	Jour string
	ID   string
	CompteursRepresentants
}

// Appels vus par le téléphone, durée en ligne et sort des rappels promis, chaque
// source datée par son propre acte.
type CompteursJournalEtRappels struct {
	Detectes          int32
	NonConsignes      int32
	RepDetectes       int32
	RepNonConsignes   int32
	Duree             int32
	Durees            int32
	RepDuree          int32
	RepDurees         int32
	Entrants          int32
	Manques           int32
	RappelsHonores    int32
	RappelsRetard     int32
	RappelsAVenir     int32
	RepRappelsHonores int32
	RepRappelsRetard  int32
	RepRappelsAVenir  int32
}

type ligneJournalParTeleconseiller struct {
	Jour string
	ID   string
	CompteursJournalEtRappels
}

type ligneDeLEquipe struct {
	ID    string
	Nom   string
	Actif bool
}

type ligneDHistogramme struct {
	ID        *string
	Label     string
	Prospects int32
}

type ligneDeRendementAgent struct {
	ID        string
	Appels    int32
	Joints    int32
	Qualifies int32
	Rappels   int32
	TempsMort int32
}

type ligneDeJourVu struct {
	ID     string
	Jour   string
	Actifs int32
}

type ligneDeStatutRepresentant struct {
	ID       string
	Code     string
	Label    string
	IsActive bool
	Joint    bool
	Count    int32
}

type CompteursDActivite struct {
	Calls                  int      `json:"calls"`
	ConfirmedCalls         int      `json:"confirmedCalls"`
	DetectedCalls          int      `json:"detectedCalls"`
	UnloggedCalls          int      `json:"unloggedCalls"`
	AvgCallSeconds         *float64 `json:"avgCallSeconds"`
	Unreachable            int      `json:"unreachable"`
	WrongNumber            int      `json:"wrongNumber"`
	MethodObtained         int      `json:"methodObtained"`
	Callback               int      `json:"callback"`
	ReachRate              *float64 `json:"reachRate"`
	Fiches                 int      `json:"fiches"`
	FichesJointes          int      `json:"fichesJointes"`
	FicheReachRate         *float64 `json:"ficheReachRate"`
	ProspectsCreated       int      `json:"prospectsCreated"`
	RepresentantsContacted int      `json:"representantsContacted"`
	RepCalls               int      `json:"repCalls"`
	RepConfirmedCalls      int      `json:"repConfirmedCalls"`
	RepDetectedCalls       int      `json:"repDetectedCalls"`
	RepUnloggedCalls       int      `json:"repUnloggedCalls"`
	RepAvgCallSeconds      *float64 `json:"repAvgCallSeconds"`
	RepWrongNumber         int      `json:"repWrongNumber"`
	RepReached             int      `json:"repReached"`
	RepCallback            int      `json:"repCallback"`
	RepUnreachable         int      `json:"repUnreachable"`
	RepContactRate         *float64 `json:"repContactRate"`
	RepCallbackRate        *float64 `json:"repCallbackRate"`
	RepQuestioned          int      `json:"repQuestioned"`
	RepQualified           int      `json:"repQualified"`
	RepQualificationRate   *float64 `json:"repQualificationRate"`
	RepFiches              int      `json:"repFiches"`
	RepFichesJointes       int      `json:"repFichesJointes"`
	RepFichesNonJointes    int      `json:"repFichesNonJointes"`
	RepFichesAcceptees     int      `json:"repFichesAcceptees"`
	RepFichesRefusees      int      `json:"repFichesRefusees"`
	RepFichesARappeler     int      `json:"repFichesARappeler"`
	RepFichesEligibles     int      `json:"repFichesEligibles"`
	RepReachabilityRate    *float64 `json:"repReachabilityRate"`
	RepAcceptanceRate      *float64 `json:"repAcceptanceRate"`
	RepCallbackFicheRate   *float64 `json:"repCallbackFicheRate"`
	InboundCalls           int      `json:"inboundCalls"`
	MissedCalls            int      `json:"missedCalls"`
	CallbacksHonored       int      `json:"callbacksHonored"`
	CallbacksLate          int      `json:"callbacksLate"`
	CallbacksUpcoming      int      `json:"callbacksUpcoming"`
	RepCallbacksHonored    int      `json:"repCallbacksHonored"`
	RepCallbacksLate       int      `json:"repCallbacksLate"`
	RepCallbacksUpcoming   int      `json:"repCallbacksUpcoming"`
}

type LigneDActivite struct {
	CompteursDActivite
	Bucket             string `json:"bucket"`
	TeleconseillerID   string `json:"teleconseillerId"`
	TeleconseillerName string `json:"teleconseillerName"`
}

type TeleconseillerSupervise struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	IsActive bool   `json:"isActive"`
}

type BarreDHistogramme struct {
	ID        *string `json:"id"`
	Label     string  `json:"label"`
	Prospects int     `json:"prospects"`
}

type CritereDeNote struct {
	Key    string  `json:"key" enum:"assiduite,regularite,rythme,contact,qualification,efficience"`
	Label  string  `json:"label"`
	Ratio  float64 `json:"ratio"`
	Weight float64 `json:"weight"`
}

type NoteDeRendement struct {
	Value  *int            `json:"value"`
	Reason *string         `json:"reason" enum:"journee_non_commencee,presence_non_mesuree,aucun_appel"`
	Parts  []CritereDeNote `json:"parts"`
}

type RendementDunTeleconseiller struct {
	TeleconseillerID      string          `json:"teleconseillerId"`
	TeleconseillerName    string          `json:"teleconseillerName"`
	ActiveSecondsInShifts int             `json:"activeSecondsInShifts"`
	ShiftSecondsElapsed   int             `json:"shiftSecondsElapsed"`
	Calls                 int             `json:"calls"`
	Reached               int             `json:"reached"`
	Qualified             int             `json:"qualified"`
	RepeatCalls           int             `json:"repeatCalls"`
	DeadSeconds           int             `json:"deadSeconds"`
	Score                 NoteDeRendement `json:"score"`
}

type StatutDeQualificationCompte struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Label    string `json:"label"`
	IsActive bool   `json:"isActive"`
	Famille  string `json:"famille" enum:"JOINT,NON_JOINT"`
	Count    int    `json:"count"`
}

type RepartitionParStatut struct {
	Total int                           `json:"total"`
	Items []StatutDeQualificationCompte `json:"items"`
}

type ActiviteDesTeleconseillers struct {
	From                      *string                      `json:"from"`
	To                        *string                      `json:"to"`
	Granularity               string                       `json:"granularity" enum:"day,week"`
	Items                     []LigneDActivite             `json:"items"`
	Totals                    CompteursDActivite           `json:"totals"`
	Teleconseillers           []TeleconseillerSupervise    `json:"teleconseillers"`
	Scores                    []RendementDunTeleconseiller `json:"scores"`
	ProspectsByTeleconseiller []BarreDHistogramme          `json:"prospectsByTeleconseiller"`
	ProspectsByRepresentant   []BarreDHistogramme          `json:"prospectsByRepresentant"`
	RepQualificationStatuses  *RepartitionParStatut        `json:"repQualificationStatuses"`
}

type ActiviteOutput struct{ Body ActiviteDesTeleconseillers }

type CreneauEffectif struct{ Debut, Fin int }

// Les créneaux rabotés par le filtre horaire : sans cette intersection, demander
// la seule matinée diviserait la note par une journée entière.
func CreneauxRabotes(shifts []CreneauDeTravail, f *FiltreDeSupervision) []CreneauEffectif {
	bas, haut := 0, secondesParJour
	if f.TimeFrom != "" {
		bas = secondesDepuisMinuit(f.TimeFrom)
	}
	if f.TimeTo != "" {
		haut = secondesDepuisMinuit(f.TimeTo)
	}
	effectifs := make([]CreneauEffectif, 0, len(shifts))
	for _, shift := range shifts {
		borne := CreneauEffectif{
			Debut: max(secondesDepuisMinuit(shift.Start), bas),
			Fin:   min(secondesDepuisMinuit(shift.End), haut),
		}
		if borne.Fin > borne.Debut {
			effectifs = append(effectifs, borne)
		}
	}
	return effectifs
}

// Un jour passé compte ses créneaux entiers, le jour courant sa portion écoulée.
func SecondesDeCreneauEcoulees(jour string, creneaux []CreneauEffectif, maintenant time.Time) int {
	aujourdhui := maintenant.UTC().Format(time.DateOnly)
	if jour > aujourdhui {
		return 0
	}
	instant := secondesParJour
	if jour == aujourdhui {
		heures, minutes, secondes := maintenant.UTC().Clock()
		instant = heures*3600 + minutes*60 + secondes
	}
	total := 0
	for _, borne := range creneaux {
		total += min(max(instant-borne.Debut, 0), borne.Fin-borne.Debut)
	}
	return total
}

func (s *service) creneauxOuValeursParDefaut(ctx context.Context) []CreneauDeTravail {
	reglage, err := s.lireCreneauxDeTravail(ctx)
	if err != nil {
		slog.Warn("créneaux illisibles, valeurs par défaut", "err", err)
		return creneauxParDefaut
	}
	return reglage.Shifts
}

// Toutes sources confondues : un agent qui appelle sans rien consigner est le cas
// même que la supervision cherche.
func (perimetre perimetreSupervision) actes(p *parametresSQL) string {
	return `
	SELECT
	  ca."performedById"                                AS "userId",
	  ` + perimetre.tronque(`ca."clientCreatedAt"`) + ` AS bucket,
	  1                                                 AS appel,
	  (ca."deviceCallAt" IS NOT NULL)::int              AS confirme,
	  (NOT ` + ProspectJoint + `)::int                  AS injoignable,
	  (cr."effect" = 'CLOSE_WRONG_NUMBER')::int         AS faux,
	  (ca."method" IS NOT NULL)::int                    AS methode,
	  (cr."effect" = 'SCHEDULE_CALLBACK')::int          AS rappel,
	  (` + ProspectJoint + `)::int                      AS joignable,
	  0                                                 AS prospect,
	  NULL::text                                        AS representant
	FROM "call_attempts" ca
	` + JointureMotifIssue + `
	WHERE ` + perimetre.ficheDuPerimetre(p, `ca."prospectId"`) + etSQL + perimetre.fenetre(p, `ca."clientCreatedAt"`) + `

	UNION ALL
	SELECT p."createdById", ` + perimetre.tronque(`p."clientCreatedAt"`) + `,
	  0, 0, 0, 0, 0, 0, 0, 1, NULL::text
	FROM "prospects" p
	WHERE p."deletedAt" IS NULL AND ` + perimetre.ficheDuPerimetre(p, `p."id"`) + etSQL + perimetre.fenetre(p, `p."clientCreatedAt"`) + `

	UNION ALL
	SELECT rca."performedById", ` + perimetre.tronque(`rca."clientCreatedAt"`) + `,
	  0, 0, 0, 0, 0, 0, 0, 0, rca."representantId"
	FROM "rep_call_attempts" rca
	WHERE ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`) + `

	UNION ALL
	SELECT d."performedById", ` + perimetre.tronque(`d."deviceCallAt"`) + `,
	  0, 0, 0, 0, 0, 0, 0, 0, NULL::text
	FROM "device_call_detections" d
	WHERE ` + perimetre.fenetre(p, `d."deviceCallAt"`) + ` AND CASE
	  WHEN d."representantId" IS NOT NULL THEN ` + perimetre.representantsVisibles(p, `d."representantId"`) + `
	  ELSE ` + perimetre.ficheDuPerimetre(p, `d."prospectId"`) + ` END`
}

func (perimetre perimetreSupervision) tentativesRepresentants(p *parametresSQL) string {
	return `
	SELECT
	  rca."performedById"                                AS "userId",
	  ` + perimetre.tronque(`rca."clientCreatedAt"`) + ` AS bucket,
	  1                                                  AS appel,
	  (rca."deviceCallAt" IS NOT NULL)::int              AS confirme,
	  (sq."effect" = 'WRONG_NUMBER')::int                AS faux,
	  (` + RepresentantJoint + `)::int                   AS joint,
	  (sq."effect" = 'SCHEDULE_CALLBACK')::int           AS rappel,
	  (sq."effect" = 'UNREACHABLE')::int                 AS injoignable
	FROM "rep_call_attempts" rca
	` + JointureStatutQualification + `
	WHERE ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`)
}

// Seule la DERNIÈRE réponse de la fenêtre vaut, à qui l'a obtenue : le classement
// porte sur tous les agents, sinon un filtre attribuerait celle d'un autre.
func (perimetre perimetreSupervision) reponsesDesRepresentants(p *parametresSQL) string {
	return `
	SELECT DISTINCT ON (rca."representantId")
	  rca."performedById"                                AS "userId",
	  ` + perimetre.tronque(`rca."clientCreatedAt"`) + ` AS bucket,
	  (` + ArbitrageDeLAdhesion + ` = 'AMBASSADEUR')::int AS qualifie
	FROM "rep_call_attempts" rca
	` + JointureStatutQualification + `
	WHERE ` + ArbitrageDeLAdhesion + ` IS NOT NULL AND ` + perimetre.representantsVisibles(p, `rca."representantId"`) +
		etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`) + `
	ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC`
}

// EB-33 : les taux se lisent PAR FICHE, sur son dernier statut de la fenêtre.
// Une fiche rappelée cinq fois pèse une fois, chez qui l'a qualifiée en dernier.
func (perimetre perimetreSupervision) fichesRepresentants(p *parametresSQL) string {
	return `
	SELECT DISTINCT ON (rca."representantId")
	  rca."performedById"                                AS "userId",
	  ` + perimetre.tronque(`rca."clientCreatedAt"`) + ` AS bucket,` + colonnesFicheRepresentant + `
	FROM "rep_call_attempts" rca
	` + JointureStatutQualification + `
	WHERE ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`) + `
	ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC`
}

func (perimetre perimetreSupervision) fichesProspects(p *parametresSQL) string {
	return `
	SELECT DISTINCT ON (ca."prospectId")
	  ca."performedById"                                AS "userId",
	  ` + perimetre.tronque(`ca."clientCreatedAt"`) + ` AS bucket,
	  (` + ProspectJoint + `)::int AS joint
	FROM "call_attempts" ca
	` + JointureMotifIssue + `
	WHERE ` + perimetre.ficheDuPerimetre(p, `ca."prospectId"`) + etSQL + perimetre.fenetre(p, `ca."clientCreatedAt"`) + `
	ORDER BY ca."prospectId", ca."clientCreatedAt" DESC, ca."id" DESC`
}

func (perimetre perimetreSupervision) journalEtRappels(p *parametresSQL) string {
	return `
	SELECT
	  d."performedById"                             AS "userId",
	  ` + perimetre.tronque(`d."deviceCallAt"`) + ` AS bucket,
	  (d."prospectId" IS NOT NULL)::int                               AS detecte,
	  (d."prospectId" IS NOT NULL AND d."attemptId" IS NULL)::int     AS "nonConsigne",
	  (d."representantId" IS NOT NULL)::int                           AS "repDetecte",
	  (d."representantId" IS NOT NULL AND d."attemptId" IS NULL)::int AS "repNonConsigne",
	  0 AS duree, 0 AS durees, 0 AS "repDuree", 0 AS "repDurees",
	  (d."attemptId" IS NULL AND d."deviceCallType" = 'entrant')::int AS entrant,
	  (d."attemptId" IS NULL AND d."deviceCallType" = 'manque')::int  AS manque,
	  0 AS "rappelHonore", 0 AS "rappelRetard", 0 AS "rappelAVenir",
	  0 AS "repRappelHonore", 0 AS "repRappelRetard", 0 AS "repRappelAVenir"
	FROM "device_call_detections" d
	WHERE ` + perimetre.fenetre(p, `d."deviceCallAt"`) + ` AND CASE
	  WHEN d."representantId" IS NOT NULL THEN ` + perimetre.representantsVisibles(p, `d."representantId"`) + `
	  ELSE ` + perimetre.ficheDuPerimetre(p, `d."prospectId"`) + ` END

	UNION ALL
	SELECT ca."performedById", ` + perimetre.tronque(`ca."clientCreatedAt"`) + `,
	  0, 0, 0, 0,
	  CASE WHEN ca."deviceCallAt" IS NOT NULL
	    THEN COALESCE(ca."deviceCallDurationSeconds", 0) ELSE 0 END,
	  (ca."deviceCallAt" IS NOT NULL)::int, 0, 0,
	  (ca."deviceCallType" = 'entrant')::int,
	  (ca."deviceCallType" = 'manque')::int,
	  0, 0, 0, 0, 0, 0
	FROM "call_attempts" ca
	WHERE (ca."deviceCallType" IS NOT NULL OR ca."deviceCallAt" IS NOT NULL)
	  AND ` + perimetre.ficheDuPerimetre(p, `ca."prospectId"`) + etSQL + perimetre.fenetre(p, `ca."clientCreatedAt"`) + `

	UNION ALL
	SELECT rca."performedById", ` + perimetre.tronque(`rca."clientCreatedAt"`) + `,
	  0, 0, 0, 0, 0, 0,
	  CASE WHEN rca."deviceCallAt" IS NOT NULL
	    THEN COALESCE(rca."deviceCallDurationSeconds", 0) ELSE 0 END,
	  (rca."deviceCallAt" IS NOT NULL)::int,
	  (rca."deviceCallType" = 'entrant')::int,
	  (rca."deviceCallType" = 'manque')::int,
	  0, 0, 0, 0, 0, 0
	FROM "rep_call_attempts" rca
	WHERE (rca."deviceCallType" IS NOT NULL OR rca."deviceCallAt" IS NOT NULL)
	  AND ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`) + `

	UNION ALL
	SELECT sc."assignedToId", ` + perimetre.tronque(`sc."scheduledAt"`) + `,
	  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	  (sc."status" = 'DONE')::int,
	  (sc."status" = 'PENDING' AND sc."scheduledAt" <= now())::int,
	  (sc."status" = 'PENDING' AND sc."scheduledAt" > now())::int,
	  0, 0, 0
	FROM "scheduled_callbacks" sc
	WHERE ` + perimetre.fenetre(p, `sc."scheduledAt"`) + etSQL + perimetre.ficheDuPerimetre(p, `sc."prospectId"`) + `

	UNION ALL
	SELECT h."performedById", ` + perimetre.tronque(`h."callbackAt"`) + `,
	  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	  0, 0, 0,
	  h.honore::int,
	  (NOT h.honore AND h."callbackAt" <= now())::int,
	  (NOT h.honore AND h."callbackAt" > now())::int
	FROM (
	  SELECT
	    rca."performedById", rca."callbackAt",
	    EXISTS (
	      SELECT 1 FROM "rep_call_attempts" x
	      WHERE x."representantId" = rca."representantId"
	        AND x."clientCreatedAt" > rca."callbackAt"
	    ) AS honore
	  FROM "rep_call_attempts" rca
	  WHERE rca."callbackAt" IS NOT NULL AND ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."callbackAt"`) + `
	) h`
}

func (s *service) lignesParTeleconseiller(ctx context.Context, perimetre perimetreSupervision) ([]ligneParTeleconseiller, error) {
	p := &parametresSQL{}
	sql := `WITH actes AS (` + perimetre.actes(p) + `),
	fiches AS (
	  SELECT "userId", bucket, COUNT(*)::int AS fiches, SUM(joint)::int AS "fichesJointes"
	  FROM (` + perimetre.fichesProspects(p) + `) f GROUP BY 1, 2
	)
	SELECT
	  to_char(a.bucket, '` + formatJourISO + `') AS jour,
	  u."id"                              AS id,
	  u."fullName"                        AS nom,
	  SUM(a.appel)::int                   AS appels,
	  SUM(a.confirme)::int                AS confirmes,
	  SUM(a.injoignable)::int             AS injoignables,
	  SUM(a.faux)::int                    AS faux,
	  SUM(a.methode)::int                 AS methodes,
	  SUM(a.rappel)::int                  AS rappels,
	  SUM(a.joignable)::int               AS joignables,
	  SUM(a.prospect)::int                AS prospects,
	  COUNT(DISTINCT a.representant)::int AS representants,
	  COALESCE(MAX(f.fiches), 0)::int          AS fiches,
	  COALESCE(MAX(f."fichesJointes"), 0)::int AS "fichesJointes"
	FROM actes a
	INNER JOIN "users" u ON u."id" = a."userId"
	LEFT JOIN fiches f ON f."userId" = a."userId" AND f.bucket = a.bucket
	WHERE ` + perimetre.teleconseiller(p) + `
	GROUP BY 1, 2, 3
	ORDER BY 1 ASC, 3 ASC`
	return lignesAgregat[ligneParTeleconseiller](ctx, s, sql, p.args)
}

func (s *service) lignesRepresentantsParTeleconseiller(ctx context.Context, perimetre perimetreSupervision) ([]ligneRepresentantsParTeleconseiller, error) {
	p := &parametresSQL{}
	sql := `WITH tentatives AS (` + perimetre.tentativesRepresentants(p) + `),
	reponses AS (` + perimetre.reponsesDesRepresentants(p) + `),
	interroges AS (
	  SELECT "userId", bucket, COUNT(*)::int AS interroges, SUM(qualifie)::int AS qualifies
	  FROM reponses GROUP BY 1, 2
	),
	fiches AS (
	  SELECT
	    "userId", bucket,
	    COUNT(*)::int      AS fiches,
	    SUM(joint)::int    AS "fichesJointes",
	    SUM(accepte)::int  AS "fichesAcceptees",
	    SUM(refuse)::int   AS "fichesRefusees",
	    SUM(rappel)::int   AS "fichesARappeler",
	    SUM(eligible)::int AS "fichesEligibles"
	  FROM (` + perimetre.fichesRepresentants(p) + `) f GROUP BY 1, 2
	)
	SELECT
	  to_char(t.bucket, '` + formatJourISO + `') AS jour,
	  t."userId"                          AS id,
	  SUM(t.appel)::int                   AS appels,
	  SUM(t.confirme)::int                AS confirmes,
	  SUM(t.faux)::int                    AS faux,
	  SUM(t.joint)::int                   AS joints,
	  SUM(t.rappel)::int                  AS rappels,
	  SUM(t.injoignable)::int             AS injoignables,
	  COALESCE(MAX(i.interroges), 0)::int AS interroges,
	  COALESCE(MAX(i.qualifies), 0)::int  AS qualifies,
	  COALESCE(MAX(f.fiches), 0)::int            AS fiches,
	  COALESCE(MAX(f."fichesJointes"), 0)::int   AS "fichesJointes",
	  COALESCE(MAX(f."fichesAcceptees"), 0)::int AS "fichesAcceptees",
	  COALESCE(MAX(f."fichesRefusees"), 0)::int  AS "fichesRefusees",
	  COALESCE(MAX(f."fichesARappeler"), 0)::int AS "fichesARappeler",
	  COALESCE(MAX(f."fichesEligibles"), 0)::int AS "fichesEligibles"
	FROM tentatives t
	LEFT JOIN interroges i ON i."userId" = t."userId" AND i.bucket = t.bucket
	LEFT JOIN fiches f ON f."userId" = t."userId" AND f.bucket = t.bucket
	GROUP BY 1, 2`
	return lignesAgregat[ligneRepresentantsParTeleconseiller](ctx, s, sql, p.args)
}

func (s *service) lignesDuJournal(ctx context.Context, perimetre perimetreSupervision) ([]ligneJournalParTeleconseiller, error) {
	p := &parametresSQL{}
	sql := `WITH journal AS (` + perimetre.journalEtRappels(p) + `)
	SELECT
	  to_char(j.bucket, '` + formatJourISO + `') AS jour,
	  u."id"                        AS id,
	  SUM(j.detecte)::int           AS detectes,
	  SUM(j."nonConsigne")::int     AS "nonConsignes",
	  SUM(j."repDetecte")::int      AS "repDetectes",
	  SUM(j."repNonConsigne")::int  AS "repNonConsignes",
	  SUM(j.duree)::int             AS duree,
	  SUM(j.durees)::int            AS durees,
	  SUM(j."repDuree")::int        AS "repDuree",
	  SUM(j."repDurees")::int       AS "repDurees",
	  SUM(j.entrant)::int           AS entrants,
	  SUM(j.manque)::int            AS manques,
	  SUM(j."rappelHonore")::int    AS "rappelsHonores",
	  SUM(j."rappelRetard")::int    AS "rappelsRetard",
	  SUM(j."rappelAVenir")::int    AS "rappelsAVenir",
	  SUM(j."repRappelHonore")::int AS "repRappelsHonores",
	  SUM(j."repRappelRetard")::int AS "repRappelsRetard",
	  SUM(j."repRappelAVenir")::int AS "repRappelsAVenir"
	FROM journal j
	INNER JOIN "users" u ON u."id" = j."userId"
	WHERE ` + perimetre.teleconseiller(p) + `
	GROUP BY 1, 2`
	return lignesAgregat[ligneJournalParTeleconseiller](ctx, s, sql, p.args)
}

// `representantsContacted`, `repQuestioned` et `repQualified` comptent des
// personnes distinctes : la somme des lignes en compterait certaines deux fois.
func (s *service) totauxDesProspects(ctx context.Context, perimetre perimetreSupervision) (CompteursProspects, error) {
	p := &parametresSQL{}
	sql := `WITH actes AS (` + perimetre.actes(p) + `),
	fiches AS (
	  SELECT COUNT(*)::int AS fiches, COALESCE(SUM(f.joint), 0)::int AS "fichesJointes"
	  FROM (` + perimetre.fichesProspects(p) + `) f
	  WHERE ` + perimetre.membreDeLEquipe(p, `f."userId"`) + `
	)
	SELECT
	  COALESCE(SUM(a.appel), 0)::int       AS appels,
	  COALESCE(SUM(a.confirme), 0)::int    AS confirmes,
	  COALESCE(SUM(a.injoignable), 0)::int AS injoignables,
	  COALESCE(SUM(a.faux), 0)::int        AS faux,
	  COALESCE(SUM(a.methode), 0)::int     AS methodes,
	  COALESCE(SUM(a.rappel), 0)::int      AS rappels,
	  COALESCE(SUM(a.joignable), 0)::int   AS joignables,
	  COALESCE(SUM(a.prospect), 0)::int    AS prospects,
	  COUNT(DISTINCT a.representant)::int  AS representants,
	  MAX(f.fiches)::int                   AS fiches,
	  MAX(f."fichesJointes")::int          AS "fichesJointes"
	FROM fiches f
	LEFT JOIN actes a ON ` + perimetre.membreDeLEquipe(p, `a."userId"`)
	return ligneAgregat[CompteursProspects](ctx, s, sql, p.args)
}

func (s *service) totauxDesRepresentants(ctx context.Context, perimetre perimetreSupervision) (CompteursRepresentants, error) {
	p := &parametresSQL{}
	sql := `WITH tentatives AS (` + perimetre.tentativesRepresentants(p) + `),
	reponses AS (` + perimetre.reponsesDesRepresentants(p) + `),
	fiches AS (
	  SELECT
	    COUNT(*)::int                     AS fiches,
	    COALESCE(SUM(f.joint), 0)::int    AS "fichesJointes",
	    COALESCE(SUM(f.accepte), 0)::int  AS "fichesAcceptees",
	    COALESCE(SUM(f.refuse), 0)::int   AS "fichesRefusees",
	    COALESCE(SUM(f.rappel), 0)::int   AS "fichesARappeler",
	    COALESCE(SUM(f.eligible), 0)::int AS "fichesEligibles"
	  FROM (` + perimetre.fichesRepresentants(p) + `) f
	  WHERE ` + perimetre.membreDeLEquipe(p, `f."userId"`) + `
	)
	SELECT
	  COALESCE(SUM(t.appel), 0)::int       AS appels,
	  COALESCE(SUM(t.confirme), 0)::int    AS confirmes,
	  COALESCE(SUM(t.faux), 0)::int        AS faux,
	  COALESCE(SUM(t.joint), 0)::int       AS joints,
	  COALESCE(SUM(t.rappel), 0)::int      AS rappels,
	  COALESCE(SUM(t.injoignable), 0)::int AS injoignables,
	  (SELECT COUNT(*)::int FROM reponses r WHERE ` + perimetre.membreDeLEquipe(p, `r."userId"`) + `) AS interroges,
	  (SELECT COALESCE(SUM(r.qualifie), 0)::int FROM reponses r WHERE ` + perimetre.membreDeLEquipe(p, `r."userId"`) + `) AS qualifies,
	  MAX(f.fiches)::int            AS fiches,
	  MAX(f."fichesJointes")::int   AS "fichesJointes",
	  MAX(f."fichesAcceptees")::int AS "fichesAcceptees",
	  MAX(f."fichesRefusees")::int  AS "fichesRefusees",
	  MAX(f."fichesARappeler")::int AS "fichesARappeler",
	  MAX(f."fichesEligibles")::int AS "fichesEligibles"
	FROM fiches f
	LEFT JOIN tentatives t ON ` + perimetre.membreDeLEquipe(p, `t."userId"`)
	return ligneAgregat[CompteursRepresentants](ctx, s, sql, p.args)
}

func (s *service) equipeDuPlateau(ctx context.Context, perimetre perimetreSupervision) ([]ligneDeLEquipe, error) {
	p := &parametresSQL{}
	return lignesAgregat[ligneDeLEquipe](ctx, s, `
	SELECT u."id" AS id, u."fullName" AS nom, u."isActive" AS actif
	FROM "users" u
	WHERE `+perimetre.teleconseiller(p)+`
	GROUP BY u."id", u."fullName", u."isActive"
	ORDER BY u."fullName" ASC`, p.args)
}

func (s *service) histogrammesDesProspects(ctx context.Context, perimetre perimetreSupervision) (parTeleconseiller, parRepresentant []ligneDHistogramme, err error) {
	agents := &parametresSQL{}
	parTeleconseiller, err = lignesAgregat[ligneDHistogramme](ctx, s, `
	SELECT u."id" AS id, u."fullName" AS label, COUNT(p."id")::int AS prospects
	FROM "users" u
	LEFT JOIN "prospects" p
	  ON p."createdById" = u."id"
	  AND p."deletedAt" IS NULL
	  AND `+perimetre.ficheDuPerimetre(agents, `p."id"`)+`
	  AND `+perimetre.fenetre(agents, `p."clientCreatedAt"`)+`
	WHERE `+perimetre.teleconseiller(agents)+`
	GROUP BY u."id", u."fullName"
	ORDER BY prospects DESC, label ASC`, agents.args)
	if err != nil {
		return nil, nil, err
	}
	representants := &parametresSQL{}
	parRepresentant, err = lignesAgregat[ligneDHistogramme](ctx, s, `
	SELECT r."id" AS id, r."fullName" AS label, COUNT(p."id")::int AS prospects
	FROM "representants" r
	INNER JOIN "prospects" p
	  ON p."representantId" = r."id"
	  AND p."deletedAt" IS NULL
	  AND `+perimetre.ficheDuPerimetre(representants, `p."id"`)+`
	  AND `+perimetre.fenetre(representants, `p."clientCreatedAt"`)+`
	GROUP BY r."id", r."fullName"
	ORDER BY prospects DESC, label ASC`, representants.args)
	if err != nil {
		return nil, nil, err
	}
	return parTeleconseiller, parRepresentant, nil
}

// Le dernier appel à statut de la fenêtre compte ; les statuts actifs paraissent
// même à zéro, les désactivés seulement s'ils sont présents.
func (s *service) repartitionParStatut(ctx context.Context, perimetre perimetreSupervision) (*RepartitionParStatut, error) {
	p := &parametresSQL{}
	sql := `WITH derniers_appels AS (
	  SELECT DISTINCT ON (rca."representantId")
	    rca."performedById" AS "userId",
	    rca."statutQualificationId" AS "statutId"
	  FROM "rep_call_attempts" rca
	  WHERE rca."statutQualificationId" IS NOT NULL AND ` + perimetre.fenetre(p, `rca."clientCreatedAt"`) + `
	  ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC
	),
	comptes AS (
	  SELECT "statutId", COUNT(*)::int AS count
	  FROM derniers_appels
	  WHERE ` + perimetre.membreDeLEquipe(p, `"userId"`) + `
	  GROUP BY "statutId"
	)
	SELECT
	  sq.id, sq.code, sq.label, sq."isActive",
	  (` + RepresentantJoint + `) AS joint,
	  COALESCE(c.count, 0)::int AS count
	FROM "statuts_qualification" sq
	LEFT JOIN comptes c ON c."statutId" = sq.id
	WHERE sq."isActive" = TRUE OR c.count > 0
	ORDER BY sq."sortOrder" ASC, sq."label" ASC`
	lignes, err := lignesAgregat[ligneDeStatutRepresentant](ctx, s, sql, p.args)
	if err != nil {
		return nil, err
	}
	repartition := &RepartitionParStatut{Items: make([]StatutDeQualificationCompte, 0, len(lignes))}
	for _, ligne := range lignes {
		famille := "NON_JOINT"
		if ligne.Joint {
			famille = "JOINT"
		}
		repartition.Total += int(ligne.Count)
		repartition.Items = append(repartition.Items, StatutDeQualificationCompte{
			ID: ligne.ID, Code: ligne.Code, Label: ligne.Label,
			IsActive: ligne.IsActive, Famille: famille, Count: int(ligne.Count),
		})
	}
	return repartition, nil
}

// Une ligne par appel, prospects et représentants confondus : l'assiette de la note,
// du temps mort et des rappels. Deux tranches de créneau, figées par les réglages.
func (perimetre perimetreSupervision) appelsSituesDansLeCreneau(p *parametresSQL, shifts []CreneauDeTravail) string {
	branches := make([]string, 0, len(shifts))
	for _, shift := range shifts {
		branches = append(branches, `WHEN a.quand::time >= `+p.marque(shift.Start)+
			`::time AND a.quand::time < `+p.marque(shift.End)+`::time THEN '`+shift.Key+`'::text`)
	}
	creneauDe := "NULL::text"
	if len(branches) > 0 {
		creneauDe = "CASE " + strings.Join(branches, " ") + " END"
	}
	tentatives := `
	SELECT
	  ca."performedById"                           AS "userId",
	  ca."clientCreatedAt"                         AS quand,
	  'prospect'                                   AS famille,
	  ca."prospectId"::text                        AS cible,
	  (` + ProspectJoint + `)::int                 AS joint,
	  (ca."method" IS NOT NULL)::int               AS qualifie
	FROM "call_attempts" ca
	` + JointureMotifIssue + `
	WHERE ` + perimetre.ficheDuPerimetre(p, `ca."prospectId"`) + etSQL + perimetre.fenetre(p, `ca."clientCreatedAt"`) + `

	UNION ALL
	SELECT rca."performedById", rca."clientCreatedAt", 'representant',
	  rca."representantId"::text,
	  (` + RepresentantJoint + `)::int, 0
	FROM "rep_call_attempts" rca
	` + JointureStatutQualification + `
	WHERE ` + perimetre.representantsVisibles(p, `rca."representantId"`) + etSQL + perimetre.fenetre(p, `rca."clientCreatedAt"`)
	return `
	SELECT a.*, ` + creneauDe + ` AS creneau, date_trunc('day', a.quand) AS jour
	FROM (` + tentatives + `) a
	INNER JOIN "users" u ON u."id" = a."userId"
	WHERE ` + perimetre.teleconseiller(p)
}

// Un trou n'existe qu'à l'intérieur d'un créneau ET d'une journée : sans le
// second test, une nuit entre deux appels passerait pour du temps mort.
func (s *service) rendementParAgent(ctx context.Context, perimetre perimetreSupervision, shifts []CreneauDeTravail) ([]ligneDeRendementAgent, error) {
	p := &parametresSQL{}
	sql := `WITH situes AS (` + perimetre.appelsSituesDansLeCreneau(p, shifts) + `),
	cadences AS (
	  SELECT
	    s.*,
	    s.quand - LAG(s.quand) OVER w AS ecart,
	    LAG(s.creneau) OVER w         AS "creneauPrecedent",
	    LAG(s.jour) OVER w            AS "jourPrecedent"
	  FROM situes s
	  WINDOW w AS (PARTITION BY s."userId" ORDER BY s.quand)
	),
	repetitions AS (
	  SELECT "userId", SUM(n - 1)::int AS rappels
	  FROM (SELECT "userId", famille, cible, COUNT(*)::int AS n FROM situes GROUP BY 1, 2, 3) t
	  GROUP BY 1
	),
	reponses AS (` + perimetre.reponsesDesRepresentants(p) + `),
	representants_qualifies AS (
	  SELECT "userId", SUM(qualifie)::int AS qualifies FROM reponses GROUP BY 1
	)
	SELECT
	  c."userId"                                             AS id,
	  COUNT(*)::int                                          AS appels,
	  SUM(c.joint)::int                                      AS joints,
	  (SUM(c.qualifie) + COALESCE(MAX(q.qualifies), 0))::int AS qualifies,
	  COALESCE(MAX(r.rappels), 0)::int                       AS rappels,
	  COALESCE(SUM(EXTRACT(EPOCH FROM c.ecart)) FILTER (
	    WHERE EXTRACT(EPOCH FROM c.ecart) > ` + strconv.Itoa(seuilTempsMortSecondes) + `
	      AND c.creneau = c."creneauPrecedent" AND c.jour = c."jourPrecedent"
	  ), 0)::int                                             AS "tempsMort"
	FROM cadences c
	LEFT JOIN representants_qualifies q ON q."userId" = c."userId"
	LEFT JOIN repetitions r ON r."userId" = c."userId"
	GROUP BY c."userId"`
	return lignesAgregat[ligneDeRendementAgent](ctx, s, sql, p.args)
}

// Un jour où le compte a été vu : une tranche de présence, un appel, ou les deux.
func (s *service) joursVus(ctx context.Context, perimetre perimetreSupervision, shifts []CreneauDeTravail, creneaux []CreneauEffectif) ([]ligneDeJourVu, error) {
	p := &parametresSQL{}
	situes := perimetre.appelsSituesDansLeCreneau(p, shifts)
	tranches := make([]string, 0, len(creneaux))
	for _, borne := range creneaux {
		tranches = append(tranches, `(s."slot"::time >= `+p.marque(heureEtMinute(borne.Debut))+
			`::time AND s."slot"::time < `+p.marque(heureEtMinute(borne.Fin))+`::time)`)
	}
	dansUnCreneau := clauseJamaisVraie
	if len(tranches) > 0 {
		dansUnCreneau = strings.Join(tranches, " OR ")
	}
	sql := `WITH situes AS (` + situes + `),
	presence AS (
	  SELECT
	    s."userId"                  AS "userId",
	    date_trunc('day', s."slot") AS jour,
	    COALESCE(SUM(s."activeSeconds") FILTER (WHERE ` + dansUnCreneau + `), 0)::int AS actifs
	  FROM "agent_activity_slots" s
	  INNER JOIN "users" u ON u."id" = s."userId"
	  WHERE ` + perimetre.teleconseiller(p) + etSQL + perimetre.fenetre(p, `s."slot"`) + `
	  GROUP BY 1, 2
	),
	vus AS (
	  SELECT "userId", jour, actifs FROM presence
	  UNION ALL
	  SELECT "userId", jour, 0 FROM situes
	)
	SELECT "userId" AS id, to_char(jour, '` + formatJourISO + `') AS jour, SUM(actifs)::int AS actifs
	FROM vus GROUP BY 1, 2`
	return lignesAgregat[ligneDeJourVu](ctx, s, sql, p.args)
}

// Un échec vide `scores` sans effacer l'activité. Le dénominateur ne compte que les
// jours où le compte a été vu : sans calendrier ouvré, les dimanches pèseraient.
func (s *service) notesDeRendement(ctx context.Context, perimetre perimetreSupervision, equipe []ligneDeLEquipe, shifts []CreneauDeTravail, creneaux []CreneauEffectif) []RendementDunTeleconseiller {
	mesures, err := s.rendementParAgent(ctx, perimetre, shifts)
	if err != nil {
		slog.Warn("rendement de la fenêtre indisponible", "err", err)
		return []RendementDunTeleconseiller{}
	}
	vus, err := s.joursVus(ctx, perimetre, shifts, creneaux)
	if err != nil {
		slog.Warn("rendement de la fenêtre indisponible", "err", err)
		return []RendementDunTeleconseiller{}
	}
	mesureDe := make(map[string]ligneDeRendementAgent, len(mesures))
	for _, mesure := range mesures {
		mesureDe[mesure.ID] = mesure
	}
	joursDe := map[string][]ligneDeJourVu{}
	for _, jour := range vus {
		joursDe[jour.ID] = append(joursDe[jour.ID], jour)
	}
	maintenant := time.Now()
	notes := make([]RendementDunTeleconseiller, 0, len(equipe))
	for _, membre := range equipe {
		mesure := mesureDe[membre.ID]
		rendement := RendementDunTeleconseiller{
			TeleconseillerID:   membre.ID,
			TeleconseillerName: membre.Nom,
			Calls:              int(mesure.Appels),
			Reached:            int(mesure.Joints),
			Qualified:          int(mesure.Qualifies),
			RepeatCalls:        int(mesure.Rappels),
			DeadSeconds:        int(mesure.TempsMort),
		}
		for _, jour := range joursDe[membre.ID] {
			rendement.ActiveSecondsInShifts += int(jour.Actifs)
			rendement.ShiftSecondsElapsed += SecondesDeCreneauEcoulees(jour.Jour, creneaux, maintenant)
		}
		rendement.Score = NoterRendement(&rendement)
		notes = append(notes, rendement)
	}
	return notes
}

// Cibles relevées sur une journée réelle du plateau, pas choisies au jugé.
const (
	cibleAppelsParHeure      = 12.0
	cibleTauxDeContact       = 0.5
	cibleTauxDeQualification = 0.6
)

var criteresDeNote = []struct {
	cle, libelle string
	poids        float64
}{
	{"assiduite", "Assiduité", 0.2},
	{"regularite", "Régularité", 0.15},
	{"rythme", "Rythme", 0.25},
	{"contact", "Contact", 0.2},
	{"qualification", exports.ExportEnteteQualification, 0.15},
	{"efficience", "Efficience", 0.05},
}

func atteinteDeCible(mesure, cible float64) float64 {
	if cible <= 0 {
		return 0
	}
	return math.Min(1, math.Max(0, mesure/cible))
}

func motifSansNote(rendement *RendementDunTeleconseiller) string {
	if rendement.ShiftSecondsElapsed <= 0 {
		return "journee_non_commencee"
	}
	if rendement.ActiveSecondsInShifts <= 0 {
		return "presence_non_mesuree"
	}
	if rendement.Calls <= 0 {
		return "aucun_appel"
	}
	return ""
}

// Une note absente vaut mieux qu'une note fausse : `reason` dit alors laquelle
// des trois bases manque, et l'écran affiche le motif au lieu d'un zéro.
func NoterRendement(rendement *RendementDunTeleconseiller) NoteDeRendement {
	if motif := motifSansNote(rendement); motif != "" {
		return NoteDeRendement{Reason: &motif, Parts: []CritereDeNote{}}
	}
	heures := float64(rendement.ActiveSecondsInShifts) / 3600
	qualification := 0.0
	if rendement.Reached > 0 {
		qualification = atteinteDeCible(float64(rendement.Qualified)/float64(rendement.Reached), cibleTauxDeQualification)
	}
	atteintes := map[string]float64{
		"assiduite":     atteinteDeCible(float64(rendement.ActiveSecondsInShifts), float64(rendement.ShiftSecondsElapsed)),
		"regularite":    1 - atteinteDeCible(float64(rendement.DeadSeconds), float64(rendement.ActiveSecondsInShifts)),
		"rythme":        atteinteDeCible(float64(rendement.Calls)/heures, cibleAppelsParHeure),
		"contact":       atteinteDeCible(float64(rendement.Reached)/float64(rendement.Calls), cibleTauxDeContact),
		"qualification": qualification,
		"efficience":    1 - atteinteDeCible(float64(rendement.RepeatCalls), float64(rendement.Calls)),
	}
	parts := make([]CritereDeNote, 0, len(criteresDeNote))
	total := 0.0
	for _, critere := range criteresDeNote {
		parts = append(parts, CritereDeNote{
			Key: critere.cle, Label: critere.libelle, Ratio: atteintes[critere.cle], Weight: critere.poids,
		})
		total += atteintes[critere.cle] * critere.poids
	}
	valeur := int(math.Round(total * 100))
	return NoteDeRendement{Value: &valeur, Parts: parts}
}

func compteursDActivite(prospects CompteursProspects, representants CompteursRepresentants, journal CompteursJournalEtRappels) CompteursDActivite {
	return CompteursDActivite{
		Calls:                  int(prospects.Appels),
		ConfirmedCalls:         int(prospects.Confirmes),
		DetectedCalls:          int(journal.Detectes),
		UnloggedCalls:          int(journal.NonConsignes),
		AvgCallSeconds:         moyenneEnSecondes(journal.Duree, journal.Durees),
		Unreachable:            int(prospects.Injoignables),
		WrongNumber:            int(prospects.Faux),
		MethodObtained:         int(prospects.Methodes),
		Callback:               int(prospects.Rappels),
		ReachRate:              tauxOuNul(int(prospects.Joignables), int(prospects.Appels)),
		Fiches:                 int(prospects.Fiches),
		FichesJointes:          int(prospects.FichesJointes),
		FicheReachRate:         tauxOuNul(int(prospects.FichesJointes), int(prospects.Fiches)),
		ProspectsCreated:       int(prospects.Prospects),
		RepresentantsContacted: int(prospects.Representants),
		RepCalls:               int(representants.Appels),
		RepConfirmedCalls:      int(representants.Confirmes),
		RepDetectedCalls:       int(journal.RepDetectes),
		RepUnloggedCalls:       int(journal.RepNonConsignes),
		RepAvgCallSeconds:      moyenneEnSecondes(journal.RepDuree, journal.RepDurees),
		RepWrongNumber:         int(representants.Faux),
		RepReached:             int(representants.Joints),
		RepCallback:            int(representants.Rappels),
		RepUnreachable:         int(representants.Injoignables),
		RepContactRate:         tauxOuNul(int(representants.Joints), int(representants.Appels)),
		RepCallbackRate:        tauxOuNul(int(representants.Rappels), int(representants.Appels)),
		RepQuestioned:          int(representants.Interroges),
		RepQualified:           int(representants.Qualifies),
		RepQualificationRate:   tauxOuNul(int(representants.Qualifies), int(representants.Interroges)),
		RepFiches:              int(representants.Fiches),
		RepFichesJointes:       int(representants.FichesJointes),
		RepFichesNonJointes:    int(representants.Fiches - representants.FichesJointes),
		RepFichesAcceptees:     int(representants.FichesAcceptees),
		RepFichesRefusees:      int(representants.FichesRefusees),
		RepFichesARappeler:     int(representants.FichesARappeler),
		RepFichesEligibles:     int(representants.FichesEligibles),
		RepReachabilityRate:    tauxOuNul(int(representants.FichesJointes), int(representants.Fiches)),
		RepAcceptanceRate:      tauxOuNul(int(representants.FichesAcceptees), int(representants.FichesEligibles)),
		RepCallbackFicheRate:   tauxOuNul(int(representants.FichesARappeler), int(representants.Fiches)),
		InboundCalls:           int(journal.Entrants),
		MissedCalls:            int(journal.Manques),
		CallbacksHonored:       int(journal.RappelsHonores),
		CallbacksLate:          int(journal.RappelsRetard),
		CallbacksUpcoming:      int(journal.RappelsAVenir),
		RepCallbacksHonored:    int(journal.RepRappelsHonores),
		RepCallbacksLate:       int(journal.RepRappelsRetard),
		RepCallbacksUpcoming:   int(journal.RepRappelsAVenir),
	}
}

func instantISOouNul(valeur *time.Time) *string {
	if valeur == nil {
		return nil
	}
	iso := valeur.UTC().Format(time.RFC3339Nano)
	return &iso
}

func (s *service) activiteDesTeleconseillers(ctx context.Context, f *FiltreDeSupervision) (*ActiviteOutput, error) {
	corps, err := avecCache(s.cleDeCacheSupervision(ctx, "supervision/activite", f), ttlSupervision, func() (ActiviteDesTeleconseillers, error) {
		return s.calculerLActivite(ctx, f)
	})
	if err != nil {
		return nil, err
	}
	return &ActiviteOutput{Body: corps}, nil
}

func (s *service) calculerLActivite(ctx context.Context, f *FiltreDeSupervision) (ActiviteDesTeleconseillers, error) {
	perimetre, err := nouveauPerimetreSupervision(f, s.Cfg.TimeZone)
	if err != nil {
		return ActiviteDesTeleconseillers{}, err
	}
	// Les créneaux bornent le temps mort et le dénominateur de la note.
	shifts := s.creneauxOuValeursParDefaut(ctx)
	creneaux := CreneauxRabotes(shifts, f)

	faits, err := s.faitsDeLaFenetre(ctx, perimetre)
	if err != nil {
		return ActiviteDesTeleconseillers{}, err
	}
	equipe, err := s.equipeDuPlateau(ctx, perimetre)
	if err != nil {
		return ActiviteDesTeleconseillers{}, err
	}
	parAgent, parRepresentant, err := s.histogrammesDesProspects(ctx, perimetre)
	if err != nil {
		return ActiviteDesTeleconseillers{}, err
	}
	// Un représentant n'existe que dans CHUES : sous Grand Public la répartition
	// par statut n'a pas de population, et vaut `null` plutôt que zéro.
	var statuts *RepartitionParStatut
	if f.Projet != socle.ProjetGrandPublic {
		if statuts, err = s.repartitionParStatut(ctx, perimetre); err != nil {
			return ActiviteDesTeleconseillers{}, err
		}
	}
	activite := assemblerLActivite(perimetre, &faits)
	activite.Teleconseillers = make([]TeleconseillerSupervise, 0, len(equipe))
	for _, membre := range equipe {
		activite.Teleconseillers = append(activite.Teleconseillers,
			TeleconseillerSupervise{ID: membre.ID, FullName: membre.Nom, IsActive: membre.Actif})
	}
	activite.Scores = s.notesDeRendement(ctx, perimetre, equipe, shifts, creneaux)
	activite.ProspectsByTeleconseiller = barresDHistogramme(parAgent)
	activite.ProspectsByRepresentant = barresDHistogramme(parRepresentant)
	activite.RepQualificationStatuses = statuts
	return activite, nil
}

type faitsDeLaFenetre struct {
	parTeleconseiller   []ligneParTeleconseiller
	representants       []ligneRepresentantsParTeleconseiller
	journal             []ligneJournalParTeleconseiller
	totauxProspects     CompteursProspects
	totauxRepresentants CompteursRepresentants
}

func (s *service) faitsDeLaFenetre(ctx context.Context, perimetre perimetreSupervision) (faitsDeLaFenetre, error) {
	faits := faitsDeLaFenetre{}
	var err error
	if faits.parTeleconseiller, err = s.lignesParTeleconseiller(ctx, perimetre); err != nil {
		return faits, err
	}
	if faits.representants, err = s.lignesRepresentantsParTeleconseiller(ctx, perimetre); err != nil {
		return faits, err
	}
	if faits.journal, err = s.lignesDuJournal(ctx, perimetre); err != nil {
		return faits, err
	}
	if faits.totauxProspects, err = s.totauxDesProspects(ctx, perimetre); err != nil {
		return faits, err
	}
	faits.totauxRepresentants, err = s.totauxDesRepresentants(ctx, perimetre)
	return faits, err
}

func barresDHistogramme(lignes []ligneDHistogramme) []BarreDHistogramme {
	barres := make([]BarreDHistogramme, 0, len(lignes))
	for _, ligne := range lignes {
		barres = append(barres, BarreDHistogramme{ID: ligne.ID, Label: ligne.Label, Prospects: int(ligne.Prospects)})
	}
	return barres
}

// Toutes les colonnes du journal sont additives : le total de l'équipe est la
// somme des lignes, déjà bornées aux comptes du plateau par la requête.
func assemblerLActivite(perimetre perimetreSupervision, faits *faitsDeLaFenetre) ActiviteDesTeleconseillers {
	representantsDe := make(map[string]CompteursRepresentants, len(faits.representants))
	for _, ligne := range faits.representants {
		representantsDe[ligne.Jour+"|"+ligne.ID] = ligne.CompteursRepresentants
	}
	journalDe := make(map[string]CompteursJournalEtRappels, len(faits.journal))
	totalJournal := CompteursJournalEtRappels{}
	for _, ligne := range faits.journal {
		journalDe[ligne.Jour+"|"+ligne.ID] = ligne.CompteursJournalEtRappels
		totalJournal = cumulerLeJournal(totalJournal, ligne.CompteursJournalEtRappels)
	}
	items := make([]LigneDActivite, 0, len(faits.parTeleconseiller))
	for _, ligne := range faits.parTeleconseiller {
		cle := ligne.Jour + "|" + ligne.ID
		items = append(items, LigneDActivite{
			CompteursDActivite: compteursDActivite(ligne.CompteursProspects, representantsDe[cle], journalDe[cle]),
			Bucket:             ligne.Jour,
			TeleconseillerID:   ligne.ID,
			TeleconseillerName: ligne.Nom,
		})
	}
	return ActiviteDesTeleconseillers{
		From:        instantISOouNul(perimetre.depuis),
		To:          instantISOouNul(perimetre.jusqua),
		Granularity: perimetre.unite,
		Items:       items,
		Totals:      compteursDActivite(faits.totauxProspects, faits.totauxRepresentants, totalJournal),
	}
}

func cumulerLeJournal(total, ligne CompteursJournalEtRappels) CompteursJournalEtRappels {
	return CompteursJournalEtRappels{
		Detectes:          total.Detectes + ligne.Detectes,
		NonConsignes:      total.NonConsignes + ligne.NonConsignes,
		RepDetectes:       total.RepDetectes + ligne.RepDetectes,
		RepNonConsignes:   total.RepNonConsignes + ligne.RepNonConsignes,
		Duree:             total.Duree + ligne.Duree,
		Durees:            total.Durees + ligne.Durees,
		RepDuree:          total.RepDuree + ligne.RepDuree,
		RepDurees:         total.RepDurees + ligne.RepDurees,
		Entrants:          total.Entrants + ligne.Entrants,
		Manques:           total.Manques + ligne.Manques,
		RappelsHonores:    total.RappelsHonores + ligne.RappelsHonores,
		RappelsRetard:     total.RappelsRetard + ligne.RappelsRetard,
		RappelsAVenir:     total.RappelsAVenir + ligne.RappelsAVenir,
		RepRappelsHonores: total.RepRappelsHonores + ligne.RepRappelsHonores,
		RepRappelsRetard:  total.RepRappelsRetard + ligne.RepRappelsRetard,
		RepRappelsAVenir:  total.RepRappelsAVenir + ligne.RepRappelsAVenir,
	}
}
