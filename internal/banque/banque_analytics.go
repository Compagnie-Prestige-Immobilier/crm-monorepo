package banque

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const colonnesDossier = `SELECT c."id", c."reference", c."referenceKey", c."prospectId", c."customerName",
	c."customerPhoneE164", c."processingBankId", b."name", c."currentStageId", c."amountXof",
	c."rejectionReasonId", c."rejectionDetail", c."rev", c."createdById", cu."fullName",
	c."updatedById", uu."fullName", c."createdAt", c."updatedAt", c."inscriptionId",
	COALESCE(p."lastCallById", p."createdById"), su."fullName"`

// `depuisDossier` est la source unique du filtrage, partagée avec les agrégats :
// y ajouter une table changerait leurs comptages.
const depuisDossier = ` FROM "bank_cases" c
	INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"`

const jointuresDossier = depuisDossier + `
	INNER JOIN "banques" b ON b."id" = c."processingBankId"
	INNER JOIN "users" cu ON cu."id" = c."createdById"
	LEFT JOIN "users" uu ON uu."id" = c."updatedById"
	LEFT JOIN "prospects" p ON p."id" = c."prospectId"
	LEFT JOIN "users" su ON su."id" = COALESCE(p."lastCallById", p."createdById")`

func lireDossier(rows pgx.Rows, ref *referentielBanque) (DossierBanque, error) {
	var d DossierBanque
	var etapeID string
	var montant pgtype.Numeric
	var motifID *string
	err := rows.Scan(&d.ID, &d.Reference, &d.ReferenceKey, &d.ProspectID, &d.CustomerName,
		&d.CustomerPhoneE164, &d.ProcessingBankID, &d.ProcessingBankName, &etapeID, &montant,
		&motifID, &d.RejectionDetail, &d.Rev, &d.CreatedByID, &d.CreatedByName,
		&d.UpdatedByID, &d.UpdatedByName, &d.CreatedAt, &d.UpdatedAt, &d.InscriptionID, &d.SuiviParID, &d.SuiviParName)
	if err != nil {
		return d, err
	}
	d.CurrentStage = ref.parID[etapeID]
	d.IsTerminal = d.CurrentStage.Type != banqueEtapeOuverte
	d.AmountXof = banqueMontantChaine(montant)
	d.RejectionReason = ref.motif(motifID)
	return d, nil
}

func (s *service) dossiers(ctx context.Context, requete string, args []any, ref *referentielBanque) ([]DossierBanque, error) {
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	liste := []DossierBanque{}
	for rows.Next() {
		dossier, err := lireDossier(rows, ref)
		if err != nil {
			return nil, err
		}
		liste = append(liste, dossier)
	}
	return liste, rows.Err()
}

// Hors projet, le dossier est INTROUVABLE et non interdit : un 403 apprendrait
// à l'écran CHUES l'existence d'un dossier Grand Public.
func (s *service) dossier(ctx context.Context, id, projet string, ref *referentielBanque) (DossierBanque, error) {
	where := `c."id" = $1 AND c."deletedAt" IS NULL`
	args := []any{id}
	if projet != "" {
		where += " AND " + fmt.Sprintf(exports.FiltreProjetDossier, 2)
		args = append(args, projet)
	}
	liste, err := s.dossiers(ctx, colonnesDossier+jointuresDossier+" WHERE "+where, args, ref)
	if err != nil {
		return DossierBanque{}, err
	}
	if len(liste) == 0 {
		return DossierBanque{}, socle.Problem(http.StatusNotFound, codeDossierIntrouvable, messageDossierIntrouvable)
	}
	return liste[0], nil
}

type clausesBanque struct {
	clauses []string
	args    []any
}

func (c *clausesBanque) ajouter(gabarit string, valeurs ...any) {
	reperes := make([]any, len(valeurs))
	for i := range valeurs {
		reperes[i] = len(c.args) + i + 1
	}
	c.clauses = append(c.clauses, fmt.Sprintf(gabarit, reperes...))
	c.args = append(c.args, valeurs...)
}

type FiltreBanque struct {
	Search            string `query:"search" maxLength:"120"`
	StageID           string `query:"stageId" format:"uuid"`
	StageType         string `query:"stageType" enum:"OPEN,CASHED,REJECTED"`
	BanqueID          string `query:"banqueId" format:"uuid"`
	Projet            string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	AgentID           string `query:"agentId" format:"uuid"`
	RejectionReasonID string `query:"rejectionReasonId" format:"uuid"`
	DateFrom          string `query:"dateFrom" pattern:"^\\d{4}-\\d{2}-\\d{2}(T.*)?$"`
	DateTo            string `query:"dateTo" pattern:"^\\d{4}-\\d{2}-\\d{2}(T.*)?$"`
	AmountMin         string `query:"amountMin" pattern:"^\\d{1,18}$"`
	AmountMax         string `query:"amountMax" pattern:"^\\d{1,18}$"`
}

// Une date seule borne la journée de Dakar, pas celle du serveur.
func borneDateBanque(valeur string, tz *time.Location, fin bool) (time.Time, bool) {
	if valeur == "" {
		return time.Time{}, false
	}
	if !dateSeuleBanque.MatchString(valeur) {
		instant, err := time.Parse(time.RFC3339, valeur)
		return instant, err == nil
	}
	jour, err := time.ParseInLocation(time.DateOnly, valeur, tz)
	if err != nil {
		return time.Time{}, false
	}
	if fin {
		return jour.Add(24*time.Hour - time.Millisecond), true
	}
	return jour, true
}

func banqueFiltresIdentite(c *clausesBanque, f *FiltreBanque) {
	if f.StageID != "" {
		c.ajouter(`c."currentStageId" = $%d`, f.StageID)
	}
	if f.StageType != "" {
		c.ajouter(`s."type" = $%d::"BankStageType"`, f.StageType)
	}
	if f.BanqueID != "" {
		c.ajouter(`c."processingBankId" = $%d`, f.BanqueID)
	}
	if f.Projet != "" {
		c.ajouter(exports.FiltreProjetDossier, f.Projet)
	}
	if f.RejectionReasonID != "" {
		c.ajouter(`c."rejectionReasonId" = $%d`, f.RejectionReasonID)
	}
	// Créateur OU dernier intervenant : reprendre le dossier d'un collègue compte.
	if f.AgentID != "" {
		c.ajouter(`(c."createdById" = $%d OR c."updatedById" = $%d)`, f.AgentID, f.AgentID)
	}
}

func banqueFiltresBornes(c *clausesBanque, f *FiltreBanque, tz *time.Location) {
	if debut, ok := borneDateBanque(f.DateFrom, tz, false); ok {
		c.ajouter(`c."createdAt" >= $%d`, debut)
	}
	if fin, ok := borneDateBanque(f.DateTo, tz, true); ok {
		c.ajouter(`c."createdAt" <= $%d`, fin)
	}
	// Un filtre de montant ne retient jamais un dossier ouvert : son montant est
	// NULL, et NULL n'est ni supérieur ni inférieur à une borne.
	if f.AmountMin != "" {
		c.ajouter(`c."amountXof" >= $%d::numeric`, f.AmountMin)
	}
	if f.AmountMax != "" {
		c.ajouter(`c."amountXof" <= $%d::numeric`, f.AmountMax)
	}
}

// QUATRE CHIFFRES AU MOINS : « DOS-3 » ne laisse que « 3 », et un seuil plus bas
// joindrait tous les téléphones contenant ce chiffre.
func banqueTelephoneRecherche(terme, region string) string {
	if e164, err := database.NormaliserTelephone(terme, region); err == nil {
		return e164
	}
	chiffres := banqueNonChiffres.ReplaceAllString(terme, "")
	if len(chiffres) >= 4 {
		return chiffres
	}
	return ""
}

func banqueFiltreRecherche(c *clausesBanque, terme, region string) {
	terme = strings.TrimSpace(terme)
	if terme == "" {
		return
	}
	gabarit := `(c."referenceKey" LIKE $%d OR unaccent(lower(c."customerName")) LIKE unaccent(lower($%d))`
	valeurs := []any{"%" + banqueReferenceCle(terme) + "%", "%" + terme + "%"}
	if tel := banqueTelephoneRecherche(terme, region); tel != "" {
		gabarit += ` OR c."customerPhoneE164" LIKE $%d`
		valeurs = append(valeurs, "%"+tel+"%")
	}
	c.ajouter(gabarit+")", valeurs...)
}

func (s *service) filtrerDossiers(f *FiltreBanque) (where string, args []any) {
	c := &clausesBanque{clauses: []string{`c."deletedAt" IS NULL`}}
	banqueFiltresIdentite(c, f)
	banqueFiltresBornes(c, f, s.Cfg.TimeZone)
	banqueFiltreRecherche(c, f.Search, s.Cfg.PhoneRegion)
	return strings.Join(c.clauses, " AND "), c.args
}

// Colonne de tri figée par cette carte : jamais une chaîne venue du client.
var triDossiers = map[string]string{
	socle.ChampCreeLe: `c."createdAt"`,
	"updatedAt":       `c."updatedAt"`,
	"reference":       `c."referenceKey"`,
	"customerName":    `c."customerName"`,
	banqueCleMontant:  exports.BanqueColonneMontant,
}

// `c."id"` en second critère : sans lui, deux dossiers créés dans la même
// milliseconde changent de page entre deux requêtes et l'un n'apparaît jamais.
func ordreDossiers(sortBy, sortOrder string) string {
	colonne, connue := triDossiers[sortBy]
	if !connue {
		colonne = triDossiers["createdAt"]
	}
	sens := "DESC"
	if sortOrder == "asc" {
		sens = "ASC"
	}
	return " ORDER BY " + colonne + " " + sens + " NULLS LAST, c.\"id\" " + sens
}

type ListeDossiersInput struct {
	FiltreBanque
	Page      int32  `query:"page" minimum:"1" default:"1"`
	PageSize  int32  `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
	SortBy    string `query:"sortBy" enum:"createdAt,updatedAt,reference,customerName,amountXof"`
	SortOrder string `query:"sortOrder" enum:"asc,desc"`
}

type ListeDossiersOutput struct {
	Body struct {
		Items []DossierBanque `json:"items"`
		Meta  MetaBanque      `json:"meta"`
	}
}

func (s *service) listerDossiers(ctx context.Context, in *ListeDossiersInput) (*ListeDossiersOutput, error) {
	ref, err := s.chargerReferentielBanque(ctx)
	if err != nil {
		return nil, err
	}
	where, args := s.filtrerDossiers(&in.FiltreBanque)
	var total int32
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*)::int`+depuisDossier+` WHERE `+where, args...).Scan(&total); err != nil {
		return nil, err
	}
	requete := colonnesDossier + jointuresDossier + " WHERE " + where + ordreDossiers(in.SortBy, in.SortOrder) +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	items, err := s.dossiers(ctx, requete, append(args, in.PageSize, (in.Page-1)*in.PageSize), ref)
	if err != nil {
		return nil, err
	}
	out := &ListeDossiersOutput{}
	out.Body.Items, out.Body.Meta = items, metaBanque(total, in.Page, in.PageSize)
	return out, nil
}

type RechercheProspectBanqueInput struct {
	Search   string `query:"search" required:"true" minLength:"2" maxLength:"120"`
	Page     int32  `query:"page" minimum:"1" default:"1"`
	PageSize int32  `query:"pageSize" minimum:"1" maximum:"50" default:"20"`
	Projet   string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
}

type ProspectBanque struct {
	ID         string  `json:"id"`
	Nom        string  `json:"nom"`
	Prenom     string  `json:"prenom"`
	FullName   string  `json:"fullName"`
	PhoneE164  *string `json:"phoneE164"`
	BanqueID   string  `json:"banqueId"`
	BanqueName string  `json:"banqueName"`
}

type RechercheProspectBanqueOutput struct {
	Body struct {
		Items []ProspectBanque `json:"items"`
		Meta  MetaBanque       `json:"meta"`
	}
}

// Accord avec le dictionnaire `immutable_unaccent` de PostgreSQL : la forme
// cherchée doit être celle que l'index trigramme porte, au caractère près.
func sansAccentsBanque(valeur string) string {
	net, _, err := transform.String(
		transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC), valeur)
	if err != nil {
		return valeur
	}
	return net
}

// « Fall Moussa » et « Moussa Fall » désignent la même personne : la permutation
// se fait sur le TERME, inverser les COLONNES perdrait l'index trigramme.
func banqueFormesRecherchees(terme string) []string {
	jetons := strings.Fields(strings.ToLower(sansAccentsBanque(terme)))
	if len(jetons) == 2 {
		return []string{"%" + jetons[0] + " " + jetons[1] + "%", "%" + jetons[1] + " " + jetons[0] + "%"}
	}
	return []string{"%" + strings.ToLower(sansAccentsBanque(terme)) + "%"}
}

// Projection VOLONTAIREMENT étroite : un agent Banque & Finance n'a pas à voir
// le commercial propriétaire, le syndicat ni le statut de prospection.
func (s *service) banqueRechercherProspects(ctx context.Context, in *RechercheProspectBanqueInput) (*RechercheProspectBanqueOutput, error) {
	terme := strings.TrimSpace(in.Search)
	params := db.BankProspectSearchParams{
		Formes: banqueFormesRecherchees(terme), Lignes: in.PageSize, Saut: (in.Page - 1) * in.PageSize,
	}
	if in.Projet != "" {
		projet := db.Projet(in.Projet)
		params.Projet = &projet
	}
	if e164, err := database.NormaliserTelephone(terme, s.Cfg.PhoneRegion); err == nil {
		params.Phone = &e164
	} else if chiffres := banqueNonChiffres.ReplaceAllString(terme, ""); len(chiffres) >= 4 {
		motif := "%" + chiffres
		params.PhoneLike = &motif
	}
	rows, err := s.Q.BankProspectSearch(ctx, params)
	if err != nil {
		return nil, err
	}
	out := &RechercheProspectBanqueOutput{}
	out.Body.Items = make([]ProspectBanque, 0, len(rows))
	var total int32
	for _, row := range rows {
		total = row.Total
		out.Body.Items = append(out.Body.Items, ProspectBanque{
			ID: row.ID, Nom: row.Nom, Prenom: row.Prenom, PhoneE164: row.PhoneE164,
			FullName:   banqueEspaces.ReplaceAllString(strings.TrimSpace(row.Prenom+" "+row.Nom), " "),
			BanqueID:   row.BanqueId,
			BanqueName: row.BanqueName,
		})
	}
	out.Body.Meta = metaBanque(total, in.Page, in.PageSize)
	return out, nil
}

// Date d'ENTRÉE en étape terminale, lue dans l'historique : `updatedAt` bougerait
// à toute correction ultérieure. MAX car après réouverture la dernière issue fait foi.
const clotureDossier = `
	LEFT JOIN LATERAL (
		SELECT MAX(bt."createdAt") AS "closedAt"
		FROM "bank_case_transitions" bt
		INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
		WHERE bt."caseId" = c."id" AND bs."type" <> 'OPEN'
	) cl ON TRUE`

const banqueSecondesParHeure = 3600

type TotauxBanque struct {
	Total             int32    `json:"total"`
	ATraiter          int32    `json:"aTraiter"`
	EnTraitement      int32    `json:"enTraitement"`
	Encaisses         int32    `json:"encaisses"`
	Rejetes           int32    `json:"rejetes"`
	TotalAmountCashed string   `json:"totalAmountCashed"`
	RejectionRate     float64  `json:"rejectionRate"`
	MeanDelayHours    *float64 `json:"meanDelayHours"`
}

type EtapeBanqueCompte struct {
	StageID string  `json:"stageId"`
	Code    string  `json:"code"`
	Label   string  `json:"label"`
	Color   string  `json:"color"`
	Type    string  `json:"type" enum:"OPEN,CASHED,REJECTED"`
	Cases   int32   `json:"cases"`
	Share   float64 `json:"share"`
}

type SeauBanque struct {
	Bucket    time.Time `json:"bucket"`
	Cases     int32     `json:"cases"`
	AmountXof string    `json:"amountXof"`
}

type BanqueCompte struct {
	BanqueID            string   `json:"banqueId"`
	Label               string   `json:"label"`
	Cases               int32    `json:"cases"`
	Cashed              int32    `json:"cashed"`
	Rejected            int32    `json:"rejected"`
	AmountXof           string   `json:"amountXof"`
	Share               float64  `json:"share"`
	MeanProcessingHours *float64 `json:"meanProcessingHours"`
}

type MotifBanqueCompte struct {
	ReasonID string  `json:"reasonId"`
	Code     string  `json:"code"`
	Label    string  `json:"label"`
	Cases    int32   `json:"cases"`
	Share    float64 `json:"share"`
}

type AgentBanqueCompte struct {
	AgentID     string `json:"agentId"`
	Label       string `json:"label"`
	Created     int32  `json:"created"`
	Transitions int32  `json:"transitions"`
	Cashed      int32  `json:"cashed"`
	AmountXof   string `json:"amountXof"`
}

type IndicateursBanqueInput struct {
	FiltreBanque
	Granularity string `query:"granularity" enum:"day,week,month" default:"day"`
}

type IndicateursBanqueOutput struct {
	Body struct {
		Totals            TotauxBanque        `json:"totals"`
		ByStage           []EtapeBanqueCompte `json:"byStage"`
		CreatedOverTime   []SeauBanque        `json:"createdOverTime"`
		CashingsOverTime  []SeauBanque        `json:"cashingsOverTime"`
		ByBank            []BanqueCompte      `json:"byBank"`
		ByRejectionReason []MotifBanqueCompte `json:"byRejectionReason"`
		ByAgent           []AgentBanqueCompte `json:"byAgent"`
		Pilotage          PilotageBanque      `json:"pilotage"`
	}
}

func partBanque(valeur, total int32) float64 {
	if total == 0 {
		return 0
	}
	return math.Round(float64(valeur)/float64(total)*1000) / 10
}

func banqueHeures(secondes *float64) *float64 {
	if secondes == nil {
		return nil
	}
	valeur := math.Round(*secondes/banqueSecondesParHeure*10) / 10
	return &valeur
}

// PostgreSQL rend un `numeric` décimal ; XOF n'a pas de décimales.
func banqueSommeChaine(valeur string) string {
	entier, _, _ := strings.Cut(valeur, ".")
	if entier == "" {
		return "0"
	}
	return entier
}

// Les sept agrégats partagent le filtre de la liste : les compteurs sont, par
// construction, ceux de la liste filtrée à l'identique.
func (s *service) indicateursBanque(ctx context.Context, in *IndicateursBanqueInput) (*IndicateursBanqueOutput, error) {
	where, args := s.filtrerDossiers(&in.FiltreBanque)
	out := &IndicateursBanqueOutput{}
	corps := &out.Body
	if err := s.totauxBanque(ctx, where, args, &corps.Totals); err != nil {
		return nil, err
	}
	etapes, err := s.banqueRepartitionEtapes(ctx, where, args)
	if err != nil {
		return nil, err
	}
	creations, err := s.banqueCreationsDansLeTemps(ctx, where, args, in.Granularity)
	if err != nil {
		return nil, err
	}
	encaissements, err := s.banqueEncaissementsDansLeTemps(ctx, where, args, in.Granularity)
	if err != nil {
		return nil, err
	}
	banques, err := s.repartitionBanques(ctx, where, args)
	if err != nil {
		return nil, err
	}
	motifs, err := s.banqueRepartitionMotifs(ctx, where, args)
	if err != nil {
		return nil, err
	}
	agents, err := s.banqueActiviteAgents(ctx, where, args)
	if err != nil {
		return nil, err
	}
	corps.ByStage, corps.CreatedOverTime, corps.CashingsOverTime = etapes, creations, encaissements
	corps.ByBank, corps.ByRejectionReason, corps.ByAgent = banques, motifs, agents
	corps.Pilotage, err = s.pilotageBanque(ctx, &in.FiltreBanque, where, args)
	return out, err
}

func (s *service) totauxBanque(ctx context.Context, where string, args []any, totaux *TotauxBanque) error {
	requete := `SELECT
		COUNT(*)::int,
		COUNT(*) FILTER (WHERE s."isInitial")::int,
		COUNT(*) FILTER (WHERE s."type" = 'OPEN' AND NOT s."isInitial")::int,
		COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int,
		COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int,
		COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text,
		(AVG(EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
			FILTER (WHERE s."type" <> 'OPEN' AND cl."closedAt" IS NOT NULL))::float8` +
		depuisDossier + clotureDossier + " WHERE " + where
	var somme string
	var delai *float64
	err := s.Pool.QueryRow(ctx, requete, args...).Scan(&totaux.Total, &totaux.ATraiter, &totaux.EnTraitement,
		&totaux.Encaisses, &totaux.Rejetes, &somme, &delai)
	if err != nil {
		return err
	}
	totaux.TotalAmountCashed = banqueSommeChaine(somme)
	totaux.RejectionRate = partBanque(totaux.Rejetes, totaux.Encaisses+totaux.Rejetes)
	totaux.MeanDelayHours = banqueHeures(delai)
	return nil
}

func (s *service) banqueRepartitionEtapes(ctx context.Context, where string, args []any) ([]EtapeBanqueCompte, error) {
	requete := `SELECT s."id", s."code", s."label", s."color", s."type"::text, COUNT(*)::int` +
		depuisDossier + " WHERE " + where +
		` GROUP BY s."id", s."code", s."label", s."color", s."type", s."position" ORDER BY s."position" ASC`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	etapes := []EtapeBanqueCompte{}
	var total int32
	for rows.Next() {
		var e EtapeBanqueCompte
		if err := rows.Scan(&e.StageID, &e.Code, &e.Label, &e.Color, &e.Type, &e.Cases); err != nil {
			return nil, err
		}
		total += e.Cases
		etapes = append(etapes, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range etapes {
		etapes[i].Share = partBanque(etapes[i].Cases, total)
	}
	return etapes, nil
}

func (s *service) banqueSeaux(ctx context.Context, requete string, args []any) ([]SeauBanque, error) {
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seaux := []SeauBanque{}
	for rows.Next() {
		var seau SeauBanque
		var somme string
		if err := rows.Scan(&seau.Bucket, &seau.Cases, &somme); err != nil {
			return nil, err
		}
		seau.AmountXof = banqueSommeChaine(somme)
		seaux = append(seaux, seau)
	}
	return seaux, rows.Err()
}

func (s *service) banqueCreationsDansLeTemps(ctx context.Context, where string, args []any, unite string) ([]SeauBanque, error) {
	requete := fmt.Sprintf(`SELECT date_trunc($%d, c."createdAt"), COUNT(*)::int, '0'`, len(args)+1) +
		depuisDossier + " WHERE " + where + " GROUP BY 1 ORDER BY 1 ASC"
	return s.banqueSeaux(ctx, requete, append(args, unite))
}

func (s *service) banqueEncaissementsDansLeTemps(ctx context.Context, where string, args []any, unite string) ([]SeauBanque, error) {
	requete := fmt.Sprintf(`SELECT date_trunc($%d, cl."closedAt"), COUNT(*)::int,
		COALESCE(SUM(c."amountXof"), 0)::text`, len(args)+1) +
		depuisDossier + clotureDossier + " WHERE " + where +
		` AND s."type" = 'CASHED' AND cl."closedAt" IS NOT NULL GROUP BY 1 ORDER BY 1 ASC`
	return s.banqueSeaux(ctx, requete, append(args, unite))
}

func (s *service) repartitionBanques(ctx context.Context, where string, args []any) ([]BanqueCompte, error) {
	requete := `SELECT b."id", b."shortName", COUNT(*)::int,
		COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int,
		COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int,
		COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text,
		(AVG(EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
			FILTER (WHERE s."type" <> 'OPEN' AND cl."closedAt" IS NOT NULL))::float8` +
		depuisDossier + clotureDossier +
		` INNER JOIN "banques" b ON b."id" = c."processingBankId" WHERE ` + where +
		` GROUP BY b."id", b."shortName" ORDER BY 3 DESC, 2 ASC`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	banques := []BanqueCompte{}
	var total int32
	for rows.Next() {
		var b BanqueCompte
		var somme string
		var moyenne *float64
		if err := rows.Scan(&b.BanqueID, &b.Label, &b.Cases, &b.Cashed, &b.Rejected, &somme, &moyenne); err != nil {
			return nil, err
		}
		b.AmountXof, b.MeanProcessingHours = banqueSommeChaine(somme), banqueHeures(moyenne)
		total += b.Cases
		banques = append(banques, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range banques {
		banques[i].Share = partBanque(banques[i].Cases, total)
	}
	return banques, nil
}

func (s *service) banqueRepartitionMotifs(ctx context.Context, where string, args []any) ([]MotifBanqueCompte, error) {
	requete := `SELECT r."id", r."code", r."label", COUNT(*)::int` + depuisDossier +
		` INNER JOIN "bank_rejection_reasons" r ON r."id" = c."rejectionReasonId" WHERE ` + where +
		` AND s."type" = 'REJECTED' GROUP BY r."id", r."code", r."label", r."sortOrder"
		ORDER BY 4 DESC, r."sortOrder" ASC`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	motifs := []MotifBanqueCompte{}
	var total int32
	for rows.Next() {
		var m MotifBanqueCompte
		if err := rows.Scan(&m.ReasonID, &m.Code, &m.Label, &m.Cases); err != nil {
			return nil, err
		}
		total += m.Cases
		motifs = append(motifs, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range motifs {
		motifs[i].Share = partBanque(motifs[i].Cases, total)
	}
	return motifs, nil
}

func (s *service) banqueActiviteAgents(ctx context.Context, where string, args []any) ([]AgentBanqueCompte, error) {
	requete := `WITH scoped AS (
		SELECT c."id" AS "caseId", c."createdById" AS "creatorId"` + depuisDossier + ` WHERE ` + where + `
	), creators AS (
		SELECT "creatorId" AS "agentId", COUNT(*)::int AS "created" FROM scoped GROUP BY 1
	), transitions AS (
		SELECT t."performedById", t."amountXof", bs."type" = 'CASHED' AS "encaissement",
			ROW_NUMBER() OVER (PARTITION BY t."caseId", bs."type" = 'CASHED' ORDER BY t."createdAt" DESC, t."id" DESC) AS "rang"
		FROM "bank_case_transitions" t
		INNER JOIN scoped ON scoped."caseId" = t."caseId"
		INNER JOIN "bank_case_stages" bs ON bs."id" = t."toStageId"
	), actors AS (
		SELECT "performedById" AS "agentId", COUNT(*)::int AS "transitions",
			COUNT(*) FILTER (WHERE "encaissement" AND "rang" = 1)::int AS "cashed",
			COALESCE(SUM("amountXof") FILTER (WHERE "encaissement" AND "rang" = 1), 0)::text AS "amount"
		FROM transitions
		GROUP BY 1
	)
	SELECT u."id", u."fullName", COALESCE(cr."created", 0)::int, COALESCE(ac."transitions", 0)::int,
		COALESCE(ac."cashed", 0)::int, COALESCE(ac."amount", '0')
	FROM "users" u
	LEFT JOIN creators cr ON cr."agentId" = u."id"
	LEFT JOIN actors ac ON ac."agentId" = u."id"
	WHERE cr."agentId" IS NOT NULL OR ac."agentId" IS NOT NULL
	ORDER BY 3 DESC, 4 DESC, 2 ASC`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := []AgentBanqueCompte{}
	for rows.Next() {
		var a AgentBanqueCompte
		var somme string
		if err := rows.Scan(&a.AgentID, &a.Label, &a.Created, &a.Transitions, &a.Cashed, &somme); err != nil {
			return nil, err
		}
		a.AmountXof = banqueSommeChaine(somme)
		agents = append(agents, a)
	}
	return agents, rows.Err()
}
