package analytics

import (
	"context"
	"cpi-go/internal/campagnes"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"math"
	"math/big"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	ttlAnalyses         = 60 * time.Second
	ttlSupervision      = 30 * time.Second
	etSQL               = " AND "
	clauseToujoursVraie = "TRUE"
)

// LEFT et non INNER : syndicat, banque et représentant sont NULLABLES depuis le
// Grand Public. En jointure interne ces fiches disparaissaient de tous les
// agrégats, sans erreur, à côté de listes qui les comptaient.
const deProspectsEtReferentiels = `
  FROM "prospects" p
  LEFT JOIN "representants" r ON r."id" = p."representantId"
  LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
  LEFT JOIN "banques" bq ON bq."id" = p."banqueId"
`

type axeDeRepartition struct{ jointure, id, libelle string }

var (
	motifDateSeule     = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	horsChiffresEtPlus = regexp.MustCompile(`[^\d+]`)
	horsChiffres       = regexp.MustCompile(`\D`)
	axeDepartement     = axeDeRepartition{`INNER JOIN "departements" d ON d."id" = r."departementId"`, `d."id"`, exports.ColonneDepartementNom}
	axeBanque          = axeDeRepartition{"", `bq."id"`, `bq."shortName"`}
	axeSyndicat        = axeDeRepartition{"", `sy."id"`, `sy."sigle"`}
)

// Qui voit le travail de tous, `readsEveryone` de common/scope.ts.
func litToutLeTravail(role socle.Role) bool {
	return role == socle.Admin || role == socle.Superviseur || role == socle.Direction
}

// Même entrée de cache pour tous ceux qui voient tout ; un téléconseiller n'a
// que la sienne.
func porteeDeCache(ctx context.Context) string {
	u := socle.UtilisateurCourant(ctx)
	if litToutLeTravail(u.Role) {
		return string(u.Role)
	}
	return u.ID
}

func teleconseillerLisible(u *socle.Utilisateur, demande string) string {
	if litToutLeTravail(u.Role) || demande == u.ID {
		return demande
	}
	return "__aucun__"
}

func partEnPourcent(valeur, total int) float64 {
	if total == 0 {
		return 0
	}
	return math.Round(float64(valeur)/float64(total)*1000) / 10
}

// Nul et non 0 sur dénominateur vide : « rien à convertir » n'est pas « tout perdu ».
func tauxOuNul(valeur, total int) *float64 {
	if total == 0 {
		return nil
	}
	calcule := partEnPourcent(valeur, total)
	return &calcule
}

func arrondiAuDixieme(valeur *float64) *float64 {
	if valeur == nil {
		return nil
	}
	calcule := math.Round(*valeur*10) / 10
	return &calcule
}

// Les agrégats analytiques portent jusqu'à dix-sept prédicats optionnels : le
// SQL se compose ici, les valeurs restent des paramètres numérotés.
type parametresSQL struct{ args []any }

func (p *parametresSQL) marque(valeur any) string {
	p.args = append(p.args, valeur)
	return "$" + strconv.Itoa(len(p.args))
}

type FiltreDesAnalyses struct {
	Search                 string `query:"search" maxLength:"120"`
	RepresentantID         string `query:"representantId"`
	BanqueID               string `query:"banqueId"`
	SyndicatID             string `query:"syndicatId"`
	DepartementID          string `query:"departementId"`
	CommercialID           string `query:"commercialId"`
	Projet                 string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Type                   string `query:"type" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	CanalProvenanceID      string `query:"canalProvenanceId"`
	Statut                 string `query:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Segment                string `query:"segment" enum:"BDD1,BDD2,BDD3,BDD4"`
	Phase2Status           string `query:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER"`
	EnrollmentMethod       string `query:"enrollmentMethod" enum:"PLATFORM,PHYSICAL,VOICE_OR_ELECTRONIC_MESSAGING,APPOINTMENT,WHATSAPP,RDV_CPI,PLATEFORME_EN_LIGNE,MAIL"`
	AppelePar              string `query:"appelePar"`
	EnrollmentCapturedByID string `query:"enrollmentCapturedById"`
	Origin                 string `query:"origin" enum:"BANQUE,FORMULAIRE_PUBLIC"`
	DateFrom               string `query:"dateFrom"`
	DateTo                 string `query:"dateTo"`
	Revue                  string `query:"revue" enum:"true,false"`
	IncludeDeleted         bool   `query:"includeDeleted"`
}

func erreurDateInvalide(champ string) *socle.ProblemError {
	return socle.Problem(http.StatusBadRequest, "BAD_REQUEST", "Date invalide dans "+champ+".")
}

// Une date seule couvre la journée entière du fuseau métier ; un instant ISO est
// pris tel quel.
func borneDuJour(iso string, tz *time.Location, fin bool) (time.Time, bool) {
	if motifDateSeule.MatchString(iso) {
		jour, err := time.ParseInLocation(time.DateOnly, iso, tz)
		if err != nil {
			return time.Time{}, false
		}
		if fin {
			return jour.Add(24*time.Hour - time.Millisecond), true
		}
		return jour, true
	}
	instant, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return time.Time{}, false
	}
	return instant, true
}

func porteeDeLecture(u *socle.Utilisateur, f *FiltreDesAnalyses, p *parametresSQL) []string {
	conditions := []string{}
	if !litToutLeTravail(u.Role) {
		conditions = append(conditions, `p."createdById" = `+p.marque(u.ID))
	}
	if f.CommercialID != "" {
		conditions = append(conditions, `p."createdById" = `+p.marque(teleconseillerLisible(u, f.CommercialID)))
	}
	if !f.IncludeDeleted || u.Role != socle.Admin {
		conditions = append(conditions, `p."deletedAt" IS NULL`)
	}
	// Sans ce filtre un total « par département » dépasse le total global.
	// `IS NULL` couvre les deux cas : représentant supprimé écarté, fiche sans
	// représentant — tout le Grand Public — comptée.
	return append(conditions, `r."deletedAt" IS NULL`)
}

func filtresDirects(f *FiltreDesAnalyses, p *parametresSQL) []string {
	directs := []struct{ valeur, gabarit string }{
		{f.RepresentantID, `p."representantId" = %s`},
		{f.BanqueID, `p."banqueId" = %s`},
		{f.SyndicatID, `p."syndicatId" = %s`},
		{f.Type, `p."type" = %s::"ProspectType"`},
		{f.CanalProvenanceID, `p."canalProvenanceId" = %s`},
		{f.Origin, `p."origin" = %s`},
		{f.DepartementID, `r."departementId" = %s`},
		{f.Phase2Status, `p."phase2Status" = %s::"Phase2Status"`},
		{f.EnrollmentMethod, `p."enrollmentMethod" = %s::"EnrollmentMethod"`},
		{f.EnrollmentCapturedByID, `p."enrollmentCapturedById" = %s`},
	}
	conditions := make([]string, 0, len(directs))
	for _, direct := range directs {
		if direct.valeur == "" {
			continue
		}
		conditions = append(conditions, strings.Replace(direct.gabarit, "%s", p.marque(direct.valeur), 1))
	}
	return conditions
}

// BDD1 CHUES/CBAO, BDD2 CHUES/autre, BDD3 autre/CBAO, BDD4 autre/autre.
func filtreSegment(segment string, p *parametresSQL) string {
	syndicat, banque := `sy."sigle" <> `, `bq."shortName" <> `
	if segment == campagnes.LotSegmentBDD1 || segment == campagnes.LotSegmentBDD2 {
		syndicat = `sy."sigle" = `
	}
	if segment == campagnes.LotSegmentBDD1 || segment == campagnes.LotSegmentBDD3 {
		banque = `bq."shortName" = `
	}
	return "(" + syndicat + p.marque("CHUES") + etSQL + banque + p.marque("CBAO") + ")"
}

func filtresComposes(f *FiltreDesAnalyses, p *parametresSQL) []string {
	conditions := []string{}
	if f.Projet != "" {
		statut := ""
		if f.Statut != "" {
			statut = ` AND pj."statut" = ` + p.marque(f.Statut) + `::"ProspectStatut"`
		}
		conditions = append(conditions, `EXISTS (SELECT 1 FROM "prospect_journeys" pj
			WHERE pj."prospectId" = p."id" AND pj."projet" = `+p.marque(f.Projet)+`::"Projet"`+statut+`)`)
	}
	if f.Statut != "" && f.Projet == "" {
		conditions = append(conditions, `p."statut" = `+p.marque(f.Statut)+`::"ProspectStatut"`)
	}
	// Les deux valeurs bornent aux demandes converties : rien d'autre ne se revoit.
	if f.Revue != "" {
		revue := `p."revueAt" IS NULL`
		if f.Revue == socle.Vrai {
			revue = `p."revueAt" IS NOT NULL`
		}
		conditions = append(conditions, `p."statut" = 'CONVERTI'::"ProspectStatut"`, revue)
	}
	if f.Segment != "" {
		conditions = append(conditions, filtreSegment(f.Segment, p))
	}
	if f.AppelePar != "" {
		conditions = append(conditions, `EXISTS (SELECT 1 FROM "call_attempts" ca
			WHERE ca."prospectId" = p."id" AND ca."performedById" = `+p.marque(f.AppelePar)+`)`)
	}
	return conditions
}

func filtresDePeriode(f *FiltreDesAnalyses, p *parametresSQL, tz *time.Location) ([]string, error) {
	bornes := []struct {
		valeur, champ, operateur string
		fin                      bool
	}{
		{f.DateFrom, "dateFrom", ` >= `, false},
		{f.DateTo, "dateTo", ` <= `, true},
	}
	conditions := make([]string, 0, len(bornes))
	for _, borne := range bornes {
		if borne.valeur == "" {
			continue
		}
		instant, ok := borneDuJour(borne.valeur, tz, borne.fin)
		if !ok {
			return nil, erreurDateInvalide(borne.champ)
		}
		conditions = append(conditions, `p."clientCreatedAt"`+borne.operateur+p.marque(instant))
	}
	return conditions, nil
}

func (s *service) filtreRechercheLibre(brut string, p *parametresSQL) string {
	recherche := strings.TrimSpace(brut)
	if recherche == "" {
		return ""
	}
	nom := `(lower(p."nom") || ' ' || lower(p."prenom")) LIKE ` + p.marque("%"+strings.ToLower(recherche)+"%")
	compact := horsChiffresEtPlus.ReplaceAllString(recherche, "")
	if len(horsChiffres.ReplaceAllString(compact, "")) < 3 {
		return "(" + nom + ")"
	}
	numero := compact
	if e164, err := database.NormaliserTelephone(recherche, s.Cfg.PhoneRegion); err == nil {
		numero = e164
	}
	return "(" + nom + ` OR p."phoneE164" LIKE ` + p.marque("%"+numero+"%") + ")"
}

// Le périmètre des prospects en SQL : la même règle que `prospectConditions`
// (analytics.sql.ts), qui doit bouger en même temps.
func (s *service) perimetreDesProspects(ctx context.Context, f *FiltreDesAnalyses, p *parametresSQL) (string, error) {
	u := socle.UtilisateurCourant(ctx)
	conditions := porteeDeLecture(&u, f, p)
	conditions = append(conditions, filtresDirects(f, p)...)
	conditions = append(conditions, filtresComposes(f, p)...)
	periode, err := filtresDePeriode(f, p, s.Cfg.TimeZone)
	if err != nil {
		return "", err
	}
	conditions = append(conditions, periode...)
	if recherche := s.filtreRechercheLibre(f.Search, p); recherche != "" {
		conditions = append(conditions, recherche)
	}
	return strings.Join(conditions, etSQL), nil
}

func (s *service) cleDeCacheDesAnalyses(ctx context.Context, route string, f *FiltreDesAnalyses) string {
	return s.Cfg.Base + ":" + route + ":" + porteeDeCache(ctx) + ":" + strings.Join([]string{
		f.Search, f.RepresentantID, f.BanqueID, f.SyndicatID, f.DepartementID, f.CommercialID,
		f.Projet, f.Type, f.CanalProvenanceID, f.Statut, f.Segment, f.Phase2Status,
		f.EnrollmentMethod, f.AppelePar, f.EnrollmentCapturedByID, f.Origin,
		f.DateFrom, f.DateTo, f.Revue, strconv.FormatBool(f.IncludeDeleted),
	}, "|")
}

func chaineOuVide(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

func lignesAgregat[T any](ctx context.Context, s *service, sql string, args []any) ([]T, error) {
	lignes, err := s.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(lignes, pgx.RowToStructByName[T])
}

func ligneAgregat[T any](ctx context.Context, s *service, sql string, args []any) (T, error) {
	var vide T
	lignes, err := lignesAgregat[T](ctx, s, sql, args)
	if err != nil {
		return vide, err
	}
	if len(lignes) == 0 {
		return vide, nil
	}
	return lignes[0], nil
}

type CompteParLibelle struct {
	ID        *string `json:"id"`
	Label     string  `json:"label"`
	Prospects int     `json:"prospects"`
	Share     float64 `json:"share"`
}

type RepartitionDesProspects struct {
	Items []CompteParLibelle `json:"items"`
	Total int                `json:"total"`
}

type RepartitionOutput struct{ Body RepartitionDesProspects }

type ligneDeRepartition struct {
	ID        *string
	Label     *string
	Prospects int32
}

func (s *service) repartitionParAxe(ctx context.Context, route string, axe axeDeRepartition, f *FiltreDesAnalyses) (*RepartitionOutput, error) {
	corps, err := avecCache(s.cleDeCacheDesAnalyses(ctx, route, f), ttlAnalyses, func() (RepartitionDesProspects, error) {
		p := &parametresSQL{}
		perimetre, err := s.perimetreDesProspects(ctx, f, p)
		if err != nil {
			return RepartitionDesProspects{}, err
		}
		sql := `SELECT ` + axe.id + ` AS id, ` + axe.libelle + ` AS label, COUNT(*)::int AS prospects` +
			deProspectsEtReferentiels + axe.jointure + ` WHERE ` + perimetre +
			` GROUP BY ` + axe.id + `, ` + axe.libelle + ` ORDER BY prospects DESC, label ASC`
		lignes, err := lignesAgregat[ligneDeRepartition](ctx, s, sql, p.args)
		if err != nil {
			return RepartitionDesProspects{}, err
		}
		total := 0
		for _, ligne := range lignes {
			total += int(ligne.Prospects)
		}
		items := make([]CompteParLibelle, 0, len(lignes))
		for _, ligne := range lignes {
			items = append(items, CompteParLibelle{
				ID:        ligne.ID,
				Label:     chaineOuVide(ligne.Label),
				Prospects: int(ligne.Prospects),
				Share:     partEnPourcent(int(ligne.Prospects), total),
			})
		}
		return RepartitionDesProspects{Items: items, Total: total}, nil
	})
	if err != nil {
		return nil, err
	}
	return &RepartitionOutput{Body: corps}, nil
}

func (s *service) prospectsParDepartement(ctx context.Context, f *FiltreDesAnalyses) (*RepartitionOutput, error) {
	return s.repartitionParAxe(ctx, "by-departement", axeDepartement, f)
}

func (s *service) prospectsParBanque(ctx context.Context, f *FiltreDesAnalyses) (*RepartitionOutput, error) {
	return s.repartitionParAxe(ctx, "by-banque", axeBanque, f)
}

func (s *service) prospectsParSyndicat(ctx context.Context, f *FiltreDesAnalyses) (*RepartitionOutput, error) {
	return s.repartitionParAxe(ctx, "by-syndicat", axeSyndicat, f)
}

type CompteParMethodeEnrolement struct {
	Method    string  `json:"method"`
	Label     string  `json:"label"`
	Prospects int     `json:"prospects"`
	Share     float64 `json:"share"`
}

type RepartitionParMethodeEnrolement struct {
	Items []CompteParMethodeEnrolement `json:"items"`
	Total int                          `json:"total"`
}

type MethodesEnrolementOutput struct {
	Body RepartitionParMethodeEnrolement
}

type ligneDeMethodeEnrolement struct {
	Key       string
	Prospects int32
}

// `null` n'est pas une méthode : `total` est celui des seuls porteurs, pas de la population.
func (s *service) prospectsParMethodeEnrolement(ctx context.Context, f *FiltreDesAnalyses) (*MethodesEnrolementOutput, error) {
	corps, err := avecCache(s.cleDeCacheDesAnalyses(ctx, "by-enrollment-method", f), ttlAnalyses, func() (RepartitionParMethodeEnrolement, error) {
		p := &parametresSQL{}
		perimetre, err := s.perimetreDesProspects(ctx, f, p)
		if err != nil {
			return RepartitionParMethodeEnrolement{}, err
		}
		lignes, err := lignesAgregat[ligneDeMethodeEnrolement](ctx, s,
			`SELECT p."enrollmentMethod" AS key, COUNT(*)::int AS prospects`+deProspectsEtReferentiels+
				` WHERE `+perimetre+` AND p."enrollmentMethod" IS NOT NULL GROUP BY 1`, p.args)
		if err != nil {
			return RepartitionParMethodeEnrolement{}, err
		}
		comptes := map[string]int{}
		total := 0
		for _, ligne := range lignes {
			comptes[ligne.Key] = int(ligne.Prospects)
			total += int(ligne.Prospects)
		}
		// `PHYSICAL` et les doublons d'héritage restent comptés dans le total mais
		// ne sont plus proposés : l'ordre et les libellés sont ceux des exports.
		items := make([]CompteParMethodeEnrolement, 0, len(exports.ExportOrdreMethodes))
		for _, methode := range exports.ExportOrdreMethodes {
			items = append(items, CompteParMethodeEnrolement{
				Method:    methode,
				Label:     exports.ExportLibellesMethode[methode],
				Prospects: comptes[methode],
				Share:     partEnPourcent(comptes[methode], total),
			})
		}
		return RepartitionParMethodeEnrolement{Items: items, Total: total}, nil
	})
	if err != nil {
		return nil, err
	}
	return &MethodesEnrolementOutput{Body: corps}, nil
}

type EtapeDeLEntonnoir struct {
	Label               string   `json:"label"`
	Count               int      `json:"count"`
	TauxEtapePrecedente *float64 `json:"tauxEtapePrecedente"`
	TauxGlobal          *float64 `json:"tauxGlobal"`
}

type FinanceDeLEntonnoir struct {
	MontantEncaisse        string   `json:"montantEncaisse"`
	MontantEnCours         string   `json:"montantEnCours"`
	EncaissementMoyen      string   `json:"encaissementMoyen"`
	MontantEncaisse30Jours string   `json:"montantEncaisse30Jours"`
	Dossiers               int      `json:"dossiers"`
	DossiersOuverts        int      `json:"dossiersOuverts"`
	DossiersEncaisses      int      `json:"dossiersEncaisses"`
	DossiersRejetes        int      `json:"dossiersRejetes"`
	TauxRejet              float64  `json:"tauxRejet"`
	DelaiMoyenJours        *float64 `json:"delaiMoyenJours"`
}

type EntonnoirDesConversions struct {
	Etapes  []EtapeDeLEntonnoir `json:"etapes"`
	Finance FinanceDeLEntonnoir `json:"finance"`
}

type EntonnoirOutput struct{ Body EntonnoirDesConversions }

type ligneDesEtapes struct {
	Prospects int32
	Methodes  int32
	Dossiers  int32
	Encaisses int32
}

type ligneDeFinance struct {
	Dossiers  int32
	Ouverts   int32
	Encaisses int32
	Rejetes   int32
	Montant   string
	Montant30 string
	Delai     *float64
}

// Visibilité des dossiers dans le ON et non le WHERE : la jointure est EXTERNE,
// un WHERE sur bc la rendrait interne et supprimerait le sommet de l'entonnoir.
const sqlEtapesEntonnoir = `
	SELECT
	  COUNT(*)::int                                                     AS prospects,
	  COUNT(*) FILTER (WHERE p."phase2Status" = 'METHOD_OBTAINED')::int AS methodes,
	  COUNT(DISTINCT bc."prospectId")::int                              AS dossiers,
	  COUNT(DISTINCT bc."prospectId") FILTER (WHERE st."type" = 'CASHED')::int AS encaisses` +
	deProspectsEtReferentiels + `
	LEFT JOIN "bank_cases" bc ON bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
	LEFT JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
	WHERE `

// Date d'issue lue dans l'HISTORIQUE : `updatedAt` bouge à chaque écriture et
// fausserait délai et montant 30 jours.
const sqlFinanceEntonnoir = `
	WITH portee AS (
	  SELECT bc."id", bc."amountXof", bc."createdAt", cl."closedAt", st."type"` +
	deProspectsEtReferentiels + `
	  JOIN "bank_cases" bc ON bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
	  JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
	  LEFT JOIN LATERAL (
	    SELECT MAX(bt."createdAt") AS "closedAt"
	    FROM "bank_case_transitions" bt
	    INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
	    WHERE bt."caseId" = bc."id" AND bs."type" <> 'OPEN'
	  ) cl ON TRUE
	  WHERE `

const sqlFinanceAgregats = `
	)
	SELECT
	  COUNT(*)::int                                    AS dossiers,
	  COUNT(*) FILTER (WHERE "type" = 'OPEN')::int     AS ouverts,
	  COUNT(*) FILTER (WHERE "type" = 'CASHED')::int   AS encaisses,
	  COUNT(*) FILTER (WHERE "type" = 'REJECTED')::int AS rejetes,
	  COALESCE(SUM("amountXof") FILTER (WHERE "type" = 'CASHED'), 0)::text AS montant,
	  COALESCE(SUM("amountXof") FILTER (
	    WHERE "type" = 'CASHED' AND "closedAt" >= now() - interval '30 days'
	  ), 0)::text                                      AS montant30,
	  AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 86400) FILTER (
	    WHERE "type" IN ('CASHED', 'REJECTED')
	  )::float                                         AS delai
	FROM portee`

func (s *service) entonnoirDesConversions(ctx context.Context, f *FiltreDesAnalyses) (*EntonnoirOutput, error) {
	corps, err := avecCache(s.cleDeCacheDesAnalyses(ctx, "funnel", f), ttlAnalyses, func() (EntonnoirDesConversions, error) {
		p := &parametresSQL{}
		perimetre, err := s.perimetreDesProspects(ctx, f, p)
		if err != nil {
			return EntonnoirDesConversions{}, err
		}
		etapes, err := ligneAgregat[ligneDesEtapes](ctx, s, sqlEtapesEntonnoir+perimetre, p.args)
		if err != nil {
			return EntonnoirDesConversions{}, err
		}
		finance, err := ligneAgregat[ligneDeFinance](ctx, s,
			sqlFinanceEntonnoir+perimetre+sqlFinanceAgregats, p.args)
		if err != nil {
			return EntonnoirDesConversions{}, err
		}
		return EntonnoirDesConversions{
			Etapes:  etapesDeLEntonnoir(etapes),
			Finance: financeDeLEntonnoir(finance),
		}, nil
	})
	if err != nil {
		return nil, err
	}
	return &EntonnoirOutput{Body: corps}, nil
}

func etapesDeLEntonnoir(ligne ligneDesEtapes) []EtapeDeLEntonnoir {
	sommet := int(ligne.Prospects)
	etape := func(libelle string, compte, precedent int) EtapeDeLEntonnoir {
		return EtapeDeLEntonnoir{
			Label:               libelle,
			Count:               compte,
			TauxEtapePrecedente: tauxOuNul(compte, precedent),
			TauxGlobal:          tauxOuNul(compte, sommet),
		}
	}
	return []EtapeDeLEntonnoir{
		etape("Prospects saisis", sommet, sommet),
		etape("Méthode obtenue", int(ligne.Methodes), sommet),
		etape("Dossier ouvert", int(ligne.Dossiers), int(ligne.Methodes)),
		etape("Dossier encaissé", int(ligne.Encaisses), int(ligne.Dossiers)),
	}
}

func financeDeLEntonnoir(ligne ligneDeFinance) FinanceDeLEntonnoir {
	montant := montantXofOuZero(ligne.Montant)
	clos := int(ligne.Encaisses) + int(ligne.Rejetes)
	rejet := 0.0
	if clos != 0 {
		rejet = partEnPourcent(int(ligne.Rejetes), clos)
	}
	return FinanceDeLEntonnoir{
		MontantEncaisse:        montant,
		MontantEnCours:         "0",
		EncaissementMoyen:      encaissementMoyenXof(montant, int(ligne.Encaisses)),
		MontantEncaisse30Jours: montantXofOuZero(ligne.Montant30),
		Dossiers:               int(ligne.Dossiers),
		DossiersOuverts:        int(ligne.Ouverts),
		DossiersEncaisses:      int(ligne.Encaisses),
		DossiersRejetes:        int(ligne.Rejetes),
		TauxRejet:              rejet,
		DelaiMoyenJours:        arrondiAuDixieme(ligne.Delai),
	}
}

// XOF est un Decimal(18,0) : la division reste entière et le montant voyage en
// chaîne, un entier JSON perdant la précision au-delà de 2^53.
func montantXofOuZero(valeur string) string {
	if valeur == "" {
		return "0"
	}
	return valeur
}

func encaissementMoyenXof(montant string, dossiers int) string {
	if dossiers == 0 {
		return "0"
	}
	total, ok := new(big.Int).SetString(montant, 10)
	if !ok {
		return "0"
	}
	return total.Div(total, big.NewInt(int64(dossiers))).String()
}

type TronconDeDelai struct {
	Leg        string   `json:"leg" enum:"CREATION_TO_METHOD,METHOD_TO_CASE,CASE_TO_CASHED"`
	Label      string   `json:"label"`
	MedianDays *float64 `json:"medianDays"`
	P90Days    *float64 `json:"p90Days"`
	Sample     int      `json:"sample"`
}

type DelaisDeLaChaine struct {
	Legs []TronconDeDelai `json:"legs"`
}

type DelaisOutput struct{ Body DelaisDeLaChaine }

type ligneDesDelais struct {
	M1 *float64
	P1 *float64
	N1 int32
	M2 *float64
	P2 *float64
	N2 int32
	M3 *float64
	P3 *float64
	N3 int32
}

// Médiane et non moyenne : un dossier oublié six mois déplacerait une moyenne de
// plusieurs semaines. Un couple incomplet ou inversé est une mesure à jeter,
// l'horloge du téléphone posant `clientCreatedAt`.
func medianeEtNeuviemeDecile(depuis, vers, suffixe string) string {
	duree := `EXTRACT(EPOCH FROM (` + vers + ` - ` + depuis + `)) / 86400.0`
	exploitable := depuis + ` IS NOT NULL AND ` + vers + ` IS NOT NULL AND ` + vers + ` >= ` + depuis
	return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ` + duree + `) FILTER (WHERE ` + exploitable + `)::float8 AS m` + suffixe + `,
	 percentile_cont(0.9) WITHIN GROUP (ORDER BY ` + duree + `) FILTER (WHERE ` + exploitable + `)::float8 AS p` + suffixe + `,
	 COUNT(*) FILTER (WHERE ` + exploitable + `)::int AS n` + suffixe
}

func (s *service) delaisDeLaChaine(ctx context.Context, f *FiltreDesAnalyses) (*DelaisOutput, error) {
	corps, err := avecCache(s.cleDeCacheDesAnalyses(ctx, "delays", f), ttlAnalyses, func() (DelaisDeLaChaine, error) {
		p := &parametresSQL{}
		perimetre, err := s.perimetreDesProspects(ctx, f, p)
		if err != nil {
			return DelaisDeLaChaine{}, err
		}
		sql := `WITH base AS (
		  SELECT
		    p."clientCreatedAt"      AS cree,
		    p."enrollmentCapturedAt" AS methode,
		    (SELECT MIN(bc."createdAt") FROM "bank_cases" bc
		      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL) AS ouvert,
		    (SELECT MIN(tr."createdAt")
		      FROM "bank_case_transitions" tr
		      INNER JOIN "bank_cases" bc ON bc."id" = tr."caseId" AND bc."deletedAt" IS NULL
		      INNER JOIN "bank_case_stages" st ON st."id" = tr."toStageId"
		      WHERE bc."prospectId" = p."id" AND st."type" = 'CASHED') AS encaisse` +
			deProspectsEtReferentiels + ` WHERE ` + perimetre + `)
		SELECT ` + medianeEtNeuviemeDecile("cree", "methode", "1") + `, ` +
			medianeEtNeuviemeDecile("methode", "ouvert", "2") + `, ` +
			medianeEtNeuviemeDecile("ouvert", "encaisse", "3") + ` FROM base`
		ligne, err := ligneAgregat[ligneDesDelais](ctx, s, sql, p.args)
		if err != nil {
			return DelaisDeLaChaine{}, err
		}
		return DelaisDeLaChaine{Legs: []TronconDeDelai{
			tronconDeDelai("CREATION_TO_METHOD", "Saisie du prospect vers méthode obtenue", ligne.M1, ligne.P1, ligne.N1),
			tronconDeDelai("METHOD_TO_CASE", "Méthode obtenue vers dossier ouvert", ligne.M2, ligne.P2, ligne.N2),
			tronconDeDelai("CASE_TO_CASHED", "Dossier ouvert vers encaissement", ligne.M3, ligne.P3, ligne.N3),
		}}, nil
	})
	if err != nil {
		return nil, err
	}
	return &DelaisOutput{Body: corps}, nil
}

func tronconDeDelai(cle, libelle string, milieu, queue *float64, taille int32) TronconDeDelai {
	if taille == 0 {
		return TronconDeDelai{Leg: cle, Label: libelle}
	}
	return TronconDeDelai{
		Leg:        cle,
		Label:      libelle,
		MedianDays: arrondiAuDixieme(milieu),
		P90Days:    arrondiAuDixieme(queue),
		Sample:     int(taille),
	}
}

type RendementDunDepartement struct {
	ID              string   `json:"id"`
	Label           string   `json:"label"`
	Prospects       int      `json:"prospects"`
	MethodObtained  int      `json:"methodObtained"`
	Cases           int      `json:"cases"`
	Cashed          int      `json:"cashed"`
	CashedAmountXof string   `json:"cashedAmountXof"`
	MethodRate      *float64 `json:"methodRate"`
	ConversionRate  *float64 `json:"conversionRate"`
}

type RendementParDepartement struct {
	Items []RendementDunDepartement `json:"items"`
	Total int                       `json:"total"`
}

type RendementOutput struct{ Body RendementParDepartement }

type ligneDeRendement struct {
	ID        string
	Label     string
	Prospects int32
	Methodes  int32
	Dossiers  int32
	Encaisses int32
	Montant   string
}

// Sous-requêtes et non jointures : un prospect porte plusieurs dossiers, une
// jointure multiplierait sa ligne. Encaissé se lit sur l'étape courante.
const sqlRendementBase = `
	WITH base AS (
	  SELECT
	    d."id"   AS departement_id,
	    d."name" AS departement_label,
	    (p."phase2Status" = 'METHOD_OBTAINED') AS methode,
	    EXISTS (SELECT 1 FROM "bank_cases" bc
	      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL) AS dossier,
	    EXISTS (SELECT 1 FROM "bank_cases" bc
	      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
	      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND st."type" = 'CASHED') AS encaisse,
	    COALESCE((SELECT SUM(bc."amountXof") FROM "bank_cases" bc
	      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
	      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND st."type" = 'CASHED'), 0) AS montant` +
	deProspectsEtReferentiels + `
	  INNER JOIN "departements" d ON d."id" = r."departementId"
	  WHERE `

const sqlRendementAgregats = `
	)
	SELECT
	  departement_id    AS id,
	  departement_label AS label,
	  COUNT(*)::int                         AS prospects,
	  COUNT(*) FILTER (WHERE methode)::int  AS methodes,
	  COUNT(*) FILTER (WHERE dossier)::int  AS dossiers,
	  COUNT(*) FILTER (WHERE encaisse)::int AS encaisses,
	  COALESCE(SUM(montant), 0)::text       AS montant
	FROM base
	GROUP BY departement_id, departement_label
	ORDER BY encaisses DESC, prospects DESC, label ASC`

func (s *service) rendementParDepartement(ctx context.Context, f *FiltreDesAnalyses) (*RendementOutput, error) {
	corps, err := avecCache(s.cleDeCacheDesAnalyses(ctx, "departement-yield", f), ttlAnalyses, func() (RendementParDepartement, error) {
		p := &parametresSQL{}
		perimetre, err := s.perimetreDesProspects(ctx, f, p)
		if err != nil {
			return RendementParDepartement{}, err
		}
		lignes, err := lignesAgregat[ligneDeRendement](ctx, s,
			sqlRendementBase+perimetre+sqlRendementAgregats, p.args)
		if err != nil {
			return RendementParDepartement{}, err
		}
		items := make([]RendementDunDepartement, 0, len(lignes))
		total := 0
		for _, ligne := range lignes {
			total += int(ligne.Prospects)
			items = append(items, RendementDunDepartement{
				ID:              ligne.ID,
				Label:           ligne.Label,
				Prospects:       int(ligne.Prospects),
				MethodObtained:  int(ligne.Methodes),
				Cases:           int(ligne.Dossiers),
				Cashed:          int(ligne.Encaisses),
				CashedAmountXof: montantXofOuZero(ligne.Montant),
				MethodRate:      tauxOuNul(int(ligne.Methodes), int(ligne.Prospects)),
				ConversionRate:  tauxOuNul(int(ligne.Encaisses), int(ligne.Prospects)),
			})
		}
		return RendementParDepartement{Items: items, Total: total}, nil
	})
	if err != nil {
		return nil, err
	}
	return &RendementOutput{Body: corps}, nil
}

var Garde = map[string]socle.Permission{
	"GET /api/v1/analytics/funnel":                  socle.PermissionFichesTenir,
	"GET /api/v1/analytics/delays":                  socle.PermissionFichesTenir,
	"GET /api/v1/analytics/departement-yield":       socle.PermissionFichesTenir,
	"GET /api/v1/analytics/by-enrollment-method":    socle.PermissionFichesTenir,
	"GET /api/v1/analytics/by-banque":               socle.PermissionFichesTenir,
	"GET /api/v1/analytics/by-departement":          socle.PermissionFichesTenir,
	"GET /api/v1/analytics/by-syndicat":             socle.PermissionFichesTenir,
	"GET /api/v1/supervision/representants":         socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/representants/qualite": socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/prospects/marketing":   socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/leads-importes":        socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/campagnes":             socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/activite":              socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/creneaux":              socle.PermissionAnalyticsSuperviser,
	"PUT /api/v1/supervision/creneaux":              socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/supervision/objectifs":             socle.PermissionAnalyticsSuperviser,
}

func routeDeLecture[I, O any](api huma.API, id, chemin string, handler func(context.Context, *I) (*O, error)) {
	huma.Register(api, huma.Operation{
		OperationID: id, Method: http.MethodGet, Path: chemin,
	}, handler)
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	routeDeLecture(api, "getAnalyticsFunnel", "/api/v1/analytics/funnel", s.entonnoirDesConversions)
	routeDeLecture(api, "getAnalyticsDelays", "/api/v1/analytics/delays", s.delaisDeLaChaine)
	routeDeLecture(api, "getDepartementYield", "/api/v1/analytics/departement-yield", s.rendementParDepartement)
	routeDeLecture(api, "getProspectsByEnrollmentMethod", "/api/v1/analytics/by-enrollment-method", s.prospectsParMethodeEnrolement)
	routeDeLecture(api, "getProspectsByBanque", "/api/v1/analytics/by-banque", s.prospectsParBanque)
	routeDeLecture(api, "getProspectsByDepartement", "/api/v1/analytics/by-departement", s.prospectsParDepartement)
	routeDeLecture(api, "getProspectsBySyndicat", "/api/v1/analytics/by-syndicat", s.prospectsParSyndicat)
	monterSupervision(api, s)
	monterObjectifs(api, s)
}
