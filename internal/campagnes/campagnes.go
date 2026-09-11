package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"maps"
	"math"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	lotCibleRepresentants = "REPRESENTANTS"
	lotCibleProspects     = "PROSPECTS"
	lotCibleInjoignables  = "REPRESENTANTS_INJOIGNABLES"
	lotCibleRecommandes   = "CONTACTS_RECOMMANDES"

	campagneIntrouvable = "Campagne introuvable."

	lotEtatNonTraitee = "NON_TRAITEE"
	lotEtatTraitee    = "TRAITEE"

	LotSegmentBDD1 = "BDD1"
	LotSegmentBDD2 = "BDD2"
	LotSegmentBDD3 = "BDD3"

	lotIssueCallback = "CALLBACK"
	lotLibelleAutre  = "Autre"

	lotCheminID = "/api/v1/lots-export/{id}"

	lotDureeRepartition = 120 * time.Second
)

var campagnesEcriture = []socle.Role{socle.Admin, socle.Superviseur}

var Garde = map[string][]socle.Role{
	"POST /api/v1/lots-export":                       campagnesEcriture,
	"POST /api/v1/lots-export/apercu":                campagnesEcriture,
	"GET /api/v1/lots-export":                        socle.Encadrement,
	"GET /api/v1/lots-export/mes-attributions":       socle.Parcours,
	"GET /api/v1/lots-export/{id}":                   socle.Encadrement,
	"PATCH /api/v1/lots-export/{id}":                 campagnesEcriture,
	"DELETE /api/v1/lots-export/{id}":                socle.AdminSeul,
	"GET /api/v1/lots-export/{id}/fiches":            socle.Encadrement,
	"POST /api/v1/lots-export/{id}/reaffectation":    campagnesEcriture,
	"POST /api/v1/lots-export/{id}/retrait":          campagnesEcriture,
	"GET /api/v1/lots-export/{id}/export.xlsx":       socle.Encadrement,
	"GET /api/v1/lots-export/{id}/programme.pdf":     socle.Encadrement,
	"GET /api/v1/lots-export/{id}/fiches-recues.pdf": socle.Encadrement,
	"GET /api/v1/lots-export/{id}/programmes.zip":    socle.Encadrement,
}

var lotLibellesIssueAppel = map[string]string{
	exports.ExportCleMethodeObtenue:   exports.ExportLibelleMethodeObtenue,
	string(db.CallOutcomeUNREACHABLE): exports.ExportLibelleInjoignable,
	lotIssueCallback:                  exports.ExportLibelleARappeler,
	exports.ExportCleRefus:            exports.ExportLibelleRefus,
	exports.ExportCleMauvaisNumero:    exports.ExportLibelleFauxNumero,
	string(db.CallOutcomeOTHER):       lotLibelleAutre,
}

type CampagneCritereRepresentants struct {
	DepartementID  string `json:"departementId,omitempty" format:"uuid"`
	IefID          string `json:"iefId,omitempty" format:"uuid"`
	RelationStatus string `json:"relationStatus,omitempty" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
}

type CampagneCritereProspects struct {
	Projet         string `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Type           string `json:"type,omitempty" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	Segment        string `json:"segment,omitempty" enum:"BDD1,BDD2,BDD3,BDD4"`
	IncludeDeleted bool   `json:"includeDeleted,omitempty"`
}

type CampagneObjectif struct {
	TeleconseillerID string `json:"teleconseillerId" maxLength:"64"`
	FichesParJour    int    `json:"fichesParJour" minimum:"1" maximum:"500"`
}

type CampagneDistributionSaisie struct {
	TeleconseillerIds []string           `json:"teleconseillerIds" minItems:"1" maxItems:"50"`
	FichesParJour     int                `json:"fichesParJour,omitempty" minimum:"1" maximum:"500" default:"50"`
	Jours             int                `json:"jours,omitempty" minimum:"1" maximum:"10" default:"1"`
	Objectifs         []CampagneObjectif `json:"objectifs,omitempty"`
}

type CampagneCreationBody struct {
	Name          string                        `json:"name" minLength:"3" maxLength:"120"`
	Cible         string                        `json:"cible" enum:"REPRESENTANTS,PROSPECTS,REPRESENTANTS_INJOIGNABLES,CONTACTS_RECOMMANDES"`
	Representants *CampagneCritereRepresentants `json:"representants,omitempty"`
	Prospects     *CampagneCritereProspects     `json:"prospects,omitempty"`
	Distribution  CampagneDistributionSaisie    `json:"distribution"`
}

type CampagneResume struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Cible          string `json:"cible" enum:"REPRESENTANTS,PROSPECTS,REPRESENTANTS_INJOIGNABLES,CONTACTS_RECOMMANDES"`
	Projet         string `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	ScopeLabel     string `json:"scopeLabel"`
	ItemCount      int    `json:"itemCount"`
	CreatedByID    string `json:"createdById"`
	CreatedByName  string `json:"createdByName"`
	CreatedAt      string `json:"createdAt"`
	CallsSince     int    `json:"callsSince"`
	FichesAppelees int    `json:"fichesAppelees"`
}

type CampagneTentative struct {
	ID                     string  `json:"id"`
	PhoneE164              string  `json:"phoneE164"`
	ShortCode              string  `json:"shortCode"`
	Outcome                string  `json:"outcome"`
	Method                 *string `json:"method"`
	Comment                *string `json:"comment"`
	PerformedByName        string  `json:"performedByName"`
	CreatedAt              string  `json:"createdAt"`
	Email                  *string `json:"email"`
	Fonctionnaire          *bool   `json:"fonctionnaire"`
	EngagementEnCours      *bool   `json:"engagementEnCours"`
	DureeEtablissementMois *int    `json:"dureeEtablissementMois"`
	RendezVousAt           *string `json:"rendezVousAt"`
}

type CampagneJour struct {
	Jour   int `json:"jour"`
	Fiches int `json:"fiches"`
}

type CampagneRepartition struct {
	TeleconseillerID   string         `json:"teleconseillerId"`
	TeleconseillerName string         `json:"teleconseillerName"`
	Jours              []CampagneJour `json:"jours"`
	Recues             int            `json:"recues"`
}

type CampagnePerformance struct {
	TeleconseillerID       string  `json:"teleconseillerId"`
	TeleconseillerName     string  `json:"teleconseillerName"`
	Objectif               int     `json:"objectif"`
	Assigned               int     `json:"assigned"`
	Treated                int     `json:"treated"`
	CompletionRate         float64 `json:"completionRate"`
	AssignedCalls          int     `json:"assignedCalls"`
	OutsideAssignmentCalls int     `json:"outsideAssignmentCalls"`
}

type CampagneReaffectation struct {
	ID                 string `json:"id"`
	FromName           string `json:"fromName"`
	ToTeleconseillerID string `json:"toTeleconseillerId"`
	ToName             string `json:"toName"`
	Fiches             int    `json:"fiches"`
	FichesEnMain       int    `json:"fichesEnMain"`
	PerformedByName    string `json:"performedByName"`
	CreatedAt          string `json:"createdAt"`
}

type CampagneDistribution struct {
	FichesParJour int `json:"fichesParJour"`
	Jours         int `json:"jours"`
}

type CampagneDetail struct {
	CampagneResume
	RecentAttempts        []CampagneTentative     `json:"recentAttempts"`
	CallsByTeleconseiller map[string]int          `json:"callsByTeleconseiller"`
	Distribution          CampagneDistribution    `json:"distribution"`
	Repartition           []CampagneRepartition   `json:"repartition"`
	Performance           []CampagnePerformance   `json:"performance"`
	Reaffectations        []CampagneReaffectation `json:"reaffectations"`
}

type CampagneFiche struct {
	Position           int     `json:"position"`
	Jour               int     `json:"jour"`
	FicheID            *string `json:"ficheId"`
	FullName           string  `json:"fullName"`
	PhoneE164          string  `json:"phoneE164"`
	TeleconseillerID   *string `json:"teleconseillerId"`
	TeleconseillerName string  `json:"teleconseillerName"`
	Etat               string  `json:"etat" enum:"NON_TRAITEE,TRAITEE,A_RAPPELER"`
	StatutLabel        *string `json:"statutLabel"`
}

type lotDistribution struct {
	TeleconseillerIds []string       `json:"teleconseillerIds"`
	FichesParJour     int            `json:"fichesParJour"`
	Jours             int            `json:"jours"`
	Objectifs         map[string]int `json:"objectifs"`
}

// La répartition voyage dans `filters` avec les critères : elle n'a pas de
// colonne, et un téléconseiller à zéro fiche ne laisse aucune ligne derrière lui.
type lotFiltres struct {
	DepartementID  string          `json:"departementId,omitempty"`
	IefID          string          `json:"iefId,omitempty"`
	RelationStatus string          `json:"relationStatus,omitempty"`
	Projet         string          `json:"projet,omitempty"`
	Type           string          `json:"type,omitempty"`
	Segment        string          `json:"segment,omitempty"`
	IncludeDeleted *bool           `json:"includeDeleted,omitempty"`
	Distribution   lotDistribution `json:"distribution"`
}

func (d lotDistribution) valide() bool {
	return len(d.TeleconseillerIds) > 0 && d.FichesParJour >= 1 && d.Jours >= 1
}

func lotLireFiltres(brut []byte) *lotFiltres {
	f := &lotFiltres{}
	_ = json.Unmarshal(brut, f)
	return f
}

type lotMembreCapacite struct {
	id            string
	fichesParJour int
}

type lotAffectation struct {
	assigneeID string
	jour       int
}

func lotCapaciteParJour(role db.Role, fichesParJour int) int {
	if role == db.Role("COMMERCIAL") {
		return fichesParJour
	}
	return max(1, int(math.Ceil(float64(fichesParJour)/5)))
}

// Tourniquet pondéré : chacun reçoit une fiche par tour jusqu'à sa capacité,
// puis la journée change quand toutes les capacités sont consommées.
func lotRepartir(fiches int, membres []lotMembreCapacite, jours int) []lotAffectation {
	if len(membres) == 0 || jours < 1 || fiches < 1 {
		return nil
	}
	tours := 0
	for _, m := range membres {
		tours = max(tours, m.fichesParJour)
	}
	var ordreDuJour []string
	for tour := range tours {
		for _, m := range membres {
			if tour < m.fichesParJour {
				ordreDuJour = append(ordreDuJour, m.id)
			}
		}
	}
	sorties := make([]lotAffectation, 0, fiches)
	for jour := 1; jour <= jours; jour++ {
		for _, id := range ordreDuJour {
			if len(sorties) == fiches {
				return sorties
			}
			sorties = append(sorties, lotAffectation{assigneeID: id, jour: jour})
		}
	}
	return sorties
}

func lotSurRepresentants(cible string) bool {
	return cible != lotCibleProspects
}

func lotScopeLabelRepresentants(f *lotFiltres) string {
	if f.RelationStatus == "" {
		return "Tous les représentants"
	}
	if f.RelationStatus == "INCONNU" {
		return "Représentants non qualifiés"
	}
	return "Représentants " + strings.ToLower(f.RelationStatus)
}

func lotScopeLabel(cible string, f *lotFiltres) string {
	switch cible {
	case lotCibleInjoignables:
		return "Représentants injoignables"
	case lotCibleRecommandes:
		return "Contacts recommandés"
	case lotCibleRepresentants:
		return lotScopeLabelRepresentants(f)
	}
	if f.Segment != "" {
		return lotSiVide(f.Projet, "Tous projets") + ", segment " + f.Segment
	}
	if f.Type != "" {
		return lotSiVide(f.Projet, "Grand Public") + ", " + strings.Replace(strings.ToLower(f.Type), "_", " ", 1)
	}
	return lotSiVide(f.Projet, "Tous projets")
}

func lotSiVide(valeur, repli string) string {
	if valeur == "" {
		return repli
	}
	return valeur
}

func lotPointeurTexte(valeur string) *string {
	if valeur == "" {
		return nil
	}
	return &valeur
}

// Les bornes de `distribution` (50 comptes, 500 fiches, 10 jours) tiennent
// largement dans un int32 ; le garde-fou évite d'y compter.
func lotInt32(n int) int32 {
	if n < 0 {
		return 0
	}
	if n > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(n)
}

type lotTeleconseiller struct {
	id       string
	fullName string
	role     db.Role
}

// Les comptes cochés, dans l'ordre reçu : cet ordre EST le tourniquet.
func (s *service) lotEquipe(ctx context.Context, ids []string) ([]lotTeleconseiller, error) {
	uniques := slices.Compact(slices.Sorted(slices.Values(ids)))
	rows, err := s.Q.Teleconseillers(ctx, uniques)
	if err != nil {
		return nil, err
	}
	if len(uniques) != len(ids) || len(rows) != len(uniques) {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_TELECONSEILLER_INVALIDE",
			"Chaque téléconseiller doit être un compte actif et distinct de téléconseil, supervision ou direction.")
	}
	parID := map[string]db.TeleconseillersRow{}
	for _, row := range rows {
		parID[row.ID] = row
	}
	equipe := make([]lotTeleconseiller, 0, len(ids))
	for _, id := range ids {
		row := parID[id]
		equipe = append(equipe, lotTeleconseiller{id: row.ID, fullName: row.FullName, role: row.Role})
	}
	return equipe, nil
}

func lotObjectifsDe(saisis []CampagneObjectif) map[string]int {
	objectifs := map[string]int{}
	for _, o := range saisis {
		objectifs[o.TeleconseillerID] = o.FichesParJour
	}
	return objectifs
}

func lotCapacites(equipe []lotTeleconseiller, fichesParJour int, objectifs map[string]int) []lotMembreCapacite {
	membres := make([]lotMembreCapacite, 0, len(equipe))
	for _, membre := range equipe {
		capacite, ok := objectifs[membre.id]
		if !ok {
			capacite = lotCapaciteParJour(membre.role, fichesParJour)
		}
		membres = append(membres, lotMembreCapacite{id: membre.id, fichesParJour: capacite})
	}
	return membres
}

func lotPlacesDe(membres []lotMembreCapacite, jours int) int {
	total := 0
	for _, m := range membres {
		total += m.fichesParJour
	}
	return total * jours
}

func lotFiltresDuCorps(body *CampagneCreationBody) *lotFiltres {
	if body.Representants != nil {
		return &lotFiltres{
			DepartementID:  body.Representants.DepartementID,
			IefID:          body.Representants.IefID,
			RelationStatus: body.Representants.RelationStatus,
		}
	}
	if body.Prospects != nil {
		inclure := body.Prospects.IncludeDeleted
		return &lotFiltres{
			Projet:         body.Prospects.Projet,
			Type:           body.Prospects.Type,
			Segment:        body.Prospects.Segment,
			IncludeDeleted: &inclure,
		}
	}
	return &lotFiltres{}
}

func (s *service) lotCompterCible(ctx context.Context, body *CampagneCreationBody) (int, error) {
	f := lotFiltresDuCorps(body)
	if body.Cible == lotCibleRecommandes {
		n, err := s.Q.CompterSuggestions(ctx, db.CompterSuggestionsParams{
			DepartementID: lotPointeurTexte(f.DepartementID), IefID: lotPointeurTexte(f.IefID),
		})
		return int(n), err
	}
	if lotSurRepresentants(body.Cible) {
		n, err := s.Q.CompterRepresentantsCible(ctx, lotRepresentantsCible(body.Cible, f))
		return int(n), err
	}
	n, err := s.Q.CompterProspectsCible(ctx, lotProspectsCible(f))
	return int(n), err
}

func lotRepresentantsCible(cible string, f *lotFiltres) db.CompterRepresentantsCibleParams {
	var relation *db.RepresentantRelation
	if f.RelationStatus != "" {
		valeur := db.RepresentantRelation(f.RelationStatus)
		relation = &valeur
	}
	return db.CompterRepresentantsCibleParams{
		DepartementID:  lotPointeurTexte(f.DepartementID),
		IefID:          lotPointeurTexte(f.IefID),
		RelationStatus: relation,
		Injoignables:   cible == lotCibleInjoignables,
	}
}

// Les deux axes du segment se lisent sur les référentiels, jamais sur une
// colonne : un identifiant mis en cache deviendrait faux à la première correction.
func lotProspectsCible(f *lotFiltres) db.CompterProspectsCibleParams {
	var projet *db.Projet
	if f.Projet != "" {
		valeur := db.Projet(f.Projet)
		projet = &valeur
	}
	var typeProspect *db.ProspectType
	if f.Type != "" {
		valeur := db.ProspectType(f.Type)
		typeProspect = &valeur
	}
	return db.CompterProspectsCibleParams{
		Projet:     projet,
		Type:       typeProspect,
		ParSegment: f.Segment != "",
		Chues:      f.Segment == LotSegmentBDD1 || f.Segment == LotSegmentBDD2,
		Cbao:       f.Segment == LotSegmentBDD1 || f.Segment == LotSegmentBDD3,
	}
}

type CampagneApercuOutput struct {
	Body struct {
		Eligible          int    `json:"eligible"`
		ScopeLabel        string `json:"scopeLabel"`
		Places            int    `json:"places"`
		Retenues          int    `json:"retenues"`
		ParTeleconseiller int    `json:"parTeleconseiller"`
	}
}

type CampagneCreationInput struct {
	Body CampagneCreationBody
}

func (s *service) campagneApercu(ctx context.Context, in *CampagneCreationInput) (*CampagneApercuOutput, error) {
	equipe, err := s.lotEquipe(ctx, in.Body.Distribution.TeleconseillerIds)
	if err != nil {
		return nil, err
	}
	membres := lotCapacites(equipe, in.Body.Distribution.FichesParJour, lotObjectifsDe(in.Body.Distribution.Objectifs))
	places := lotPlacesDe(membres, in.Body.Distribution.Jours)
	eligible, err := s.lotCompterCible(ctx, &in.Body)
	if err != nil {
		return nil, err
	}
	out := &CampagneApercuOutput{}
	out.Body.Eligible = eligible
	out.Body.ScopeLabel = lotScopeLabel(in.Body.Cible, lotFiltresDuCorps(&in.Body))
	out.Body.Places = places
	out.Body.Retenues = min(eligible, places)
	out.Body.ParTeleconseiller = int(math.Ceil(float64(out.Body.Retenues) / float64(len(equipe))))
	return out, nil
}

type CampagneOutput struct {
	Body CampagneResume
}

func (s *service) campagneCreer(ctx context.Context, in *CampagneCreationInput) (*CampagneOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if lotSurRepresentants(in.Body.Cible) == (in.Body.Representants == nil) {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_FILTRES_REQUIS",
			"Les critères de la cible sont requis.")
	}
	equipe, err := s.lotEquipe(ctx, in.Body.Distribution.TeleconseillerIds)
	if err != nil {
		return nil, err
	}
	objectifs := lotObjectifsDe(in.Body.Distribution.Objectifs)
	membres := lotCapacites(equipe, in.Body.Distribution.FichesParJour, objectifs)
	places := lotPlacesDe(membres, in.Body.Distribution.Jours)

	id, err := s.lotEcrireCampagne(ctx, u.ID, in, equipe, membres, places, objectifs)
	if err != nil {
		return nil, err
	}
	row, err := s.lot(ctx, id)
	if err != nil {
		return nil, err
	}
	resume, err := s.lotResume(ctx, row)
	if err != nil {
		return nil, err
	}
	return &CampagneOutput{Body: resume}, nil
}

func (s *service) lotEcrireCampagne(ctx context.Context, createurID string, in *CampagneCreationInput,
	equipe []lotTeleconseiller, membres []lotMembreCapacite, places int, objectifs map[string]int,
) (string, error) {
	ctx, annuler := context.WithTimeout(ctx, lotDureeRepartition)
	defer annuler()
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '120s'"); err != nil {
		return "", err
	}
	q := s.Q.WithTx(tx)

	fiches, err := s.lotTirerFiches(ctx, q, createurID, &in.Body, places)
	if err != nil {
		return "", err
	}
	if len(fiches) == 0 {
		return "", socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_CIBLE_VIDE",
			"Aucune fiche ne correspond à cette cible.")
	}
	lotAffectations := lotRepartir(len(fiches), membres, in.Body.Distribution.Jours)

	filtres := lotFiltresDuCorps(&in.Body)
	filtres.Distribution = lotDistribution{
		TeleconseillerIds: lotIdsDe(equipe),
		FichesParJour:     in.Body.Distribution.FichesParJour,
		Jours:             in.Body.Distribution.Jours,
		Objectifs:         objectifs,
	}
	brut, err := json.Marshal(filtres)
	if err != nil {
		return "", err
	}
	lotID, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	if err := q.InsertLot(ctx, db.InsertLotParams{
		ID: lotID.String(), Name: strings.TrimSpace(in.Body.Name),
		Cible: db.LotExportCible(in.Body.Cible), Projet: projetDuLot(&in.Body),
		Filters: brut, ItemCount: lotInt32(len(lotAffectations)), CreatedById: createurID,
	}); err != nil {
		return "", err
	}
	items := make([]db.InsertLotItemsParams, 0, len(lotAffectations))
	for index, a := range lotAffectations {
		item := db.InsertLotItemsParams{
			LotId: lotID.String(), Position: lotInt32(index),
			AssigneeId: lotPointeurTexte(a.assigneeID), Day: lotInt32(a.jour),
		}
		if lotSurRepresentants(in.Body.Cible) {
			item.RepresentantId = lotPointeurTexte(fiches[index])
		} else {
			item.ProspectId = lotPointeurTexte(fiches[index])
		}
		items = append(items, item)
	}
	if _, err := q.InsertLotItems(ctx, items); err != nil {
		return "", err
	}
	return lotID.String(), tx.Commit(ctx)
}

// Un représentant est CHUES par construction ; un lot de prospects porte le
// projet exigé à la création.
func projetDuLot(body *CampagneCreationBody) db.Projet {
	if lotSurRepresentants(body.Cible) || body.Prospects == nil {
		return db.Projet("CHUES")
	}
	return db.Projet(body.Prospects.Projet)
}

func lotIdsDe(equipe []lotTeleconseiller) []string {
	ids := make([]string, 0, len(equipe))
	for _, membre := range equipe {
		ids = append(ids, membre.id)
	}
	return ids
}

func (s *service) lotTirerFiches(ctx context.Context, q *db.Queries, createurID string,
	body *CampagneCreationBody, places int,
) ([]string, error) {
	f := lotFiltresDuCorps(body)
	if body.Cible == lotCibleRecommandes {
		return s.lotOuvrirContactsRecommandes(ctx, q, createurID, f, places)
	}
	if lotSurRepresentants(body.Cible) {
		p := lotRepresentantsCible(body.Cible, f)
		return q.TirerRepresentantsCible(ctx, db.TirerRepresentantsCibleParams{
			DepartementID: p.DepartementID, IefID: p.IefID,
			RelationStatus: p.RelationStatus, Injoignables: p.Injoignables,
			Places: lotInt32(places),
		})
	}
	p := lotProspectsCible(f)
	return q.TirerProspectsCible(ctx, db.TirerProspectsCibleParams{
		Projet: p.Projet, Type: p.Type, ParSegment: p.ParSegment,
		Chues: p.Chues, Cbao: p.Cbao, Places: lotInt32(places),
	})
}

// EB-19 : un contact recommandé devient une fiche au LANCEMENT de la campagne.
// Le numéro porte un index unique partiel : sans ce dédoublonnage, deux
// suggestions du même numéro feraient échouer la transaction entière.
func (*service) lotOuvrirContactsRecommandes(ctx context.Context, q *db.Queries, createurID string,
	f *lotFiltres, places int,
) ([]string, error) {
	suggestions, err := q.TirerSuggestions(ctx, db.TirerSuggestionsParams{
		DepartementID: lotPointeurTexte(f.DepartementID), IefID: lotPointeurTexte(f.IefID),
	})
	if err != nil {
		return nil, err
	}
	numeros := make([]string, 0, len(suggestions))
	for _, piste := range suggestions {
		numeros = append(numeros, piste.SuggestedPhoneE164)
	}
	deja, err := q.TelephonesRepresentantsConnus(ctx, numeros)
	if err != nil {
		return nil, err
	}
	connus := map[string]bool{}
	for _, numero := range deja {
		connus[numero] = true
	}
	maintenant := time.Now()
	fiches := make([]string, 0, min(places, len(suggestions)))
	for _, piste := range suggestions {
		if len(fiches) >= places {
			break
		}
		if connus[piste.SuggestedPhoneE164] {
			continue
		}
		connus[piste.SuggestedPhoneE164] = true
		id, err := uuid.NewV7()
		if err != nil {
			return nil, err
		}
		nom := strings.TrimSpace(lotValeurTexte(piste.SuggestedName))
		if err := q.InsertRepresentantRecommande(ctx, db.InsertRepresentantRecommandeParams{
			ID: id.String(), FullName: lotSiVide(nom, "Contact recommandé"),
			PhoneE164: piste.SuggestedPhoneE164, DepartementId: piste.DepartementId,
			IefId: piste.IefId, CreatedById: createurID, ClientCreatedAt: maintenant,
		}); err != nil {
			return nil, err
		}
		if err := q.ResoudreSuggestion(ctx, db.ResoudreSuggestionParams{
			ID: piste.ID, ResolvedRepresentantId: lotPointeurTexte(id.String()),
		}); err != nil {
			return nil, err
		}
		fiches = append(fiches, id.String())
	}
	return fiches, nil
}

func lotValeurTexte(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

func (s *service) lotStats(ctx context.Context, id string, cible db.LotExportCible, depuis time.Time) (calls, fiches int, err error) {
	if lotSurRepresentants(string(cible)) {
		row, err := s.Q.LotStatsRepresentants(ctx, db.LotStatsRepresentantsParams{LotId: id, ClientCreatedAt: depuis})
		return int(row.Calls), int(row.Fiches), err
	}
	row, err := s.Q.LotStatsProspects(ctx, db.LotStatsProspectsParams{LotId: id, ClientCreatedAt: depuis})
	return int(row.Calls), int(row.Fiches), err
}

func (s *service) lotResume(ctx context.Context, row *db.LotParIdRow) (CampagneResume, error) {
	calls, fiches, err := s.lotStats(ctx, row.ID, row.Cible, row.CreatedAt)
	if err != nil {
		return CampagneResume{}, err
	}
	return CampagneResume{
		ID: row.ID, Name: row.Name, Cible: string(row.Cible), Projet: string(row.Projet),
		ScopeLabel: lotScopeLabel(string(row.Cible), lotLireFiltres(row.Filters)),
		ItemCount:  int(row.ItemCount), CreatedByID: row.CreatedById,
		CreatedByName: row.CreatedByName, CreatedAt: lotISO(row.CreatedAt),
		CallsSince: calls, FichesAppelees: fiches,
	}, nil
}

func lotISO(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func (s *service) lot(ctx context.Context, id string) (*db.LotParIdRow, error) {
	row, err := s.Q.LotParId(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_NOT_FOUND", campagneIntrouvable)
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

type CampagnesListeInput struct {
	Search      string `query:"search" maxLength:"120"`
	Cible       string `query:"cible" enum:"REPRESENTANTS,PROSPECTS,REPRESENTANTS_INJOIGNABLES,CONTACTS_RECOMMANDES"`
	Projet      string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	CreatedById string `query:"createdById" maxLength:"64"`
	DateFrom    string `query:"dateFrom" format:"date-time"`
	DateTo      string `query:"dateTo" format:"date-time"`
	Page        int    `query:"page" minimum:"1" default:"1"`
	PageSize    int    `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

type CampagnesListeOutput struct {
	Body struct {
		Items []CampagneResume `json:"items"`
		Meta  CampagnePageMeta `json:"meta"`
	}
}

func lotInstantOuNil(valeur string) *time.Time {
	if valeur == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, valeur)
	if err != nil {
		return nil
	}
	return &t
}

func (s *service) campagnesLister(ctx context.Context, in *CampagnesListeInput) (*CampagnesListeOutput, error) {
	var cible *db.LotExportCible
	if in.Cible != "" {
		valeur := db.LotExportCible(in.Cible)
		cible = &valeur
	}
	var projet *db.Projet
	if in.Projet != "" {
		valeur := db.Projet(in.Projet)
		projet = &valeur
	}
	search := lotPointeurTexte(strings.TrimSpace(in.Search))
	total, err := s.Q.CompterLots(ctx, db.CompterLotsParams{
		Search: search, Cible: cible, Projet: projet, CreatedBy: lotPointeurTexte(in.CreatedById),
		DateFrom: lotInstantOuNil(in.DateFrom), DateTo: lotInstantOuNil(in.DateTo),
	})
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListerLots(ctx, db.ListerLotsParams{
		Limit: lotInt32(in.PageSize), Offset: lotInt32((in.Page - 1) * in.PageSize),
		Search: search, Cible: cible, Projet: projet, CreatedBy: lotPointeurTexte(in.CreatedById),
		DateFrom: lotInstantOuNil(in.DateFrom), DateTo: lotInstantOuNil(in.DateTo),
	})
	if err != nil {
		return nil, err
	}
	out := &CampagnesListeOutput{}
	out.Body.Items = make([]CampagneResume, 0, len(rows))
	for index := range rows {
		row := db.LotParIdRow(rows[index])
		resume, err := s.lotResume(ctx, &row)
		if err != nil {
			return nil, err
		}
		out.Body.Items = append(out.Body.Items, resume)
	}
	out.Body.Meta = lotMetaPage(int(total), in.Page, in.PageSize)
	return out, nil
}

type CampagnePageMeta struct {
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}

func lotMetaPage(total, page, pageSize int) CampagnePageMeta {
	return CampagnePageMeta{
		Total: total, Page: page, PageSize: pageSize,
		PageCount: max(1, int(math.Ceil(float64(total)/float64(pageSize)))),
	}
}

type CampagneIDInput struct {
	ID string `path:"id" format:"uuid"`
}

type CampagneDetailOutput struct {
	Body CampagneDetail
}

func (s *service) campagneDetail(ctx context.Context, in *CampagneIDInput) (*CampagneDetailOutput, error) {
	detail, err := s.lotAssemblerDetail(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &CampagneDetailOutput{Body: detail}, nil
}

func (s *service) lotAssemblerDetail(ctx context.Context, id string) (CampagneDetail, error) {
	row, err := s.lot(ctx, id)
	if err != nil {
		return CampagneDetail{}, err
	}
	resume, err := s.lotResume(ctx, row)
	if err != nil {
		return CampagneDetail{}, err
	}
	groupes, err := s.Q.LotGroupes(ctx, id)
	if err != nil {
		return CampagneDetail{}, err
	}
	stored := lotLireFiltres(row.Filters).Distribution
	ordre, jours, fichesParJour := lotFormeDeLaRepartition(stored, groupes)
	traces, recues, err := s.lotReaffectationsLues(ctx, id)
	if err != nil {
		return CampagneDetail{}, err
	}
	repartition, err := s.lotRepartitionLue(ctx, ordre, jours, groupes, recues)
	if err != nil {
		return CampagneDetail{}, err
	}
	appels, err := s.lotAppelsParAgent(ctx, row)
	if err != nil {
		return CampagneDetail{}, err
	}
	tentatives, err := s.lotTentativesRecentes(ctx, row)
	if err != nil {
		return CampagneDetail{}, err
	}
	performance, err := s.lotPerformance(ctx, row, stored)
	if err != nil {
		return CampagneDetail{}, err
	}
	return CampagneDetail{
		CampagneResume: resume, RecentAttempts: tentatives, CallsByTeleconseiller: appels,
		Distribution: CampagneDistribution{FichesParJour: fichesParJour, Jours: jours},
		Repartition:  repartition, Performance: performance, Reaffectations: traces,
	}, nil
}

func lotFormeDeLaRepartition(stored lotDistribution, groupes []db.LotGroupesRow) (ordre []string, jours, fichesParJour int) {
	if stored.valide() {
		return stored.TeleconseillerIds, stored.Jours, stored.FichesParJour
	}
	tries := slices.Clone(groupes)
	sort.SliceStable(tries, func(i, j int) bool { return tries[i].MinPosition < tries[j].MinPosition })
	vus := map[string]bool{}
	jours, fichesParJour = 1, 1
	for _, groupe := range tries {
		if groupe.AssigneeId != nil && !vus[*groupe.AssigneeId] {
			vus[*groupe.AssigneeId] = true
			ordre = append(ordre, *groupe.AssigneeId)
		}
		jours = max(jours, int(groupe.Day))
		fichesParJour = max(fichesParJour, int(groupe.Fiches))
	}
	return ordre, jours, fichesParJour
}

func (s *service) lotRepartitionLue(ctx context.Context, ordre []string, jours int,
	groupes []db.LotGroupesRow, recues map[string]map[int32]bool,
) ([]CampagneRepartition, error) {
	noms, err := s.Q.NomsUtilisateurs(ctx, ordre)
	if err != nil {
		return nil, err
	}
	parID := map[string]string{}
	for _, ligne := range noms {
		parID[ligne.ID] = ligne.FullName
	}
	compte := map[string]int{}
	for _, groupe := range groupes {
		compte[lotValeurTexte(groupe.AssigneeId)+"#"+strconv.Itoa(int(groupe.Day))] = int(groupe.Fiches)
	}
	repartition := make([]CampagneRepartition, 0, len(ordre))
	for _, membre := range ordre {
		lignes := make([]CampagneJour, 0, jours)
		for jour := 1; jour <= jours; jour++ {
			lignes = append(lignes, CampagneJour{Jour: jour, Fiches: compte[membre+"#"+strconv.Itoa(jour)]})
		}
		repartition = append(repartition, CampagneRepartition{
			TeleconseillerID: membre, TeleconseillerName: lotSiVide(parID[membre], "Compte supprimé"),
			Jours: lignes, Recues: len(recues[membre]),
		})
	}
	return repartition, nil
}

// Les traces, et ce qu'il en reste en main : une fiche reçue puis redonnée ne
// compte plus, ni sur sa trace ni dans les « reçues » du téléconseiller.
func (s *service) lotReaffectationsLues(ctx context.Context, id string) ([]CampagneReaffectation, map[string]map[int32]bool, error) {
	rows, err := s.Q.LotReaffectations(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	var positions []int32
	for index := range rows {
		positions = append(positions, rows[index].Positions...)
	}
	tenues := map[int32]string{}
	if len(positions) > 0 {
		items, err := s.Q.LotTenuesAuxPositions(ctx, db.LotTenuesAuxPositionsParams{LotId: id, Column2: positions})
		if err != nil {
			return nil, nil, err
		}
		for _, item := range items {
			tenues[item.Position] = lotValeurTexte(item.AssigneeId)
		}
	}
	recues := map[string]map[int32]bool{}
	traces := make([]CampagneReaffectation, 0, len(rows))
	for index := range rows {
		row := &rows[index]
		traces = append(traces, CampagneReaffectation{
			ID: row.ID, FromName: lotValeurTexte(row.FromName), ToTeleconseillerID: row.ToAssigneeId,
			ToName: row.ToName, Fiches: int(row.Fiches), FichesEnMain: lotFichesEnMain(row, tenues, recues),
			PerformedByName: row.PerformedByName, CreatedAt: lotISO(row.CreatedAt),
		})
	}
	return traces, recues, nil
}

func lotFichesEnMain(row *db.LotReaffectationsRow, tenues map[int32]string, recues map[string]map[int32]bool) int {
	enMain := 0
	for _, position := range row.Positions {
		if tenues[position] != row.ToAssigneeId {
			continue
		}
		enMain++
		if recues[row.ToAssigneeId] == nil {
			recues[row.ToAssigneeId] = map[int32]bool{}
		}
		recues[row.ToAssigneeId][position] = true
	}
	return enMain
}

func (s *service) lotAppelsParAgent(ctx context.Context, row *db.LotParIdRow) (map[string]int, error) {
	appels := map[string]int{}
	if lotSurRepresentants(string(row.Cible)) {
		lignes, err := s.Q.LotAppelsParAgentRepresentants(ctx, db.LotAppelsParAgentRepresentantsParams{
			LotId: row.ID, ClientCreatedAt: row.CreatedAt,
		})
		for _, ligne := range lignes {
			appels[ligne.Name] = int(ligne.Calls)
		}
		return appels, err
	}
	lignes, err := s.Q.LotAppelsParAgentProspects(ctx, db.LotAppelsParAgentProspectsParams{
		LotId: row.ID, ClientCreatedAt: row.CreatedAt,
	})
	for _, ligne := range lignes {
		appels[ligne.Name] = int(ligne.Calls)
	}
	return appels, err
}

func (s *service) lotTentativesRecentes(ctx context.Context, row *db.LotParIdRow) ([]CampagneTentative, error) {
	if lotSurRepresentants(string(row.Cible)) {
		lignes, err := s.Q.LotAttemptsRepresentants(ctx, db.LotAttemptsRepresentantsParams{
			LotId: row.ID, ClientCreatedAt: row.CreatedAt,
		})
		if err != nil {
			return nil, err
		}
		tentatives := make([]CampagneTentative, 0, len(lignes))
		for _, ligne := range lignes {
			tentatives = append(tentatives, CampagneTentative{
				ID: ligne.ID, PhoneE164: ligne.PhoneE164, Outcome: ligne.Outcome,
				Comment: ligne.Comment, PerformedByName: ligne.PerformedByName,
				CreatedAt: lotISO(ligne.CreatedAt),
			})
		}
		return tentatives, nil
	}
	lignes, err := s.Q.LotAttemptsProspects(ctx, db.LotAttemptsProspectsParams{
		LotId: row.ID, ClientCreatedAt: row.CreatedAt,
	})
	if err != nil {
		return nil, err
	}
	tentatives := make([]CampagneTentative, 0, len(lignes))
	for index := range lignes {
		ligne := &lignes[index]
		tentatives = append(tentatives, CampagneTentative{
			ID: ligne.ID, PhoneE164: ligne.PhoneE164, Outcome: ligne.Outcome,
			Method: lotPointeurTexte(ligne.Method), Comment: ligne.Comment,
			PerformedByName: ligne.PerformedByName, CreatedAt: lotISO(ligne.CreatedAt),
			Email: ligne.Email, Fonctionnaire: ligne.Fonctionnaire,
			EngagementEnCours:      ligne.EngagementEnCours,
			DureeEtablissementMois: lotEntierOuNil(ligne.DureeEtablissementMois),
			RendezVousAt:           lotISOOuNil(ligne.RendezVousAt),
		})
	}
	return tentatives, nil
}

func lotEntierOuNil(valeur *int32) *int {
	if valeur == nil {
		return nil
	}
	n := int(*valeur)
	return &n
}

func lotISOOuNil(t *time.Time) *string {
	if t == nil {
		return nil
	}
	return lotPointeurTexte(lotISO(*t))
}

// À défaut d'objectif saisi, ce que la répartition a RÉELLEMENT appliqué :
// annoncer `fichesParJour` brut contredisait la ligne d'à côté.
func lotObjectifDe(id string, role db.Role, stored lotDistribution) int {
	if explicite, ok := stored.Objectifs[id]; ok {
		return explicite
	}
	if !stored.valide() {
		return 0
	}
	return lotCapaciteParJour(role, stored.FichesParJour)
}

func (s *service) lotPerformance(ctx context.Context, row *db.LotParIdRow, stored lotDistribution) ([]CampagnePerformance, error) {
	lignes, err := s.lotLignesPerformance(ctx, row)
	if err != nil {
		return nil, err
	}
	performance := make([]CampagnePerformance, 0, len(lignes))
	for _, ligne := range lignes {
		id := lotValeurTexte(ligne.ID)
		taux := 0.0
		if ligne.Assigned > 0 {
			taux = math.Round(float64(ligne.Treated)/float64(ligne.Assigned)*1000) / 10
		}
		performance = append(performance, CampagnePerformance{
			TeleconseillerID: id, TeleconseillerName: ligne.Name,
			Objectif: lotObjectifDe(id, ligne.Role, stored), Assigned: int(ligne.Assigned),
			Treated: int(ligne.Treated), CompletionRate: taux,
			AssignedCalls: int(ligne.AssignedCalls), OutsideAssignmentCalls: int(ligne.OutsideAssignmentCalls),
		})
	}
	return performance, nil
}

func (s *service) lotLignesPerformance(ctx context.Context, row *db.LotParIdRow) ([]db.LotPerformanceRepresentantsRow, error) {
	if lotSurRepresentants(string(row.Cible)) {
		return s.Q.LotPerformanceRepresentants(ctx, db.LotPerformanceRepresentantsParams{
			LotId: row.ID, ClientCreatedAt: row.CreatedAt,
		})
	}
	lignes, err := s.Q.LotPerformanceProspects(ctx, db.LotPerformanceProspectsParams{
		LotId: row.ID, ClientCreatedAt: row.CreatedAt,
	})
	return slices.Collect(func(yield func(db.LotPerformanceRepresentantsRow) bool) {
		for _, ligne := range lignes {
			if !yield(db.LotPerformanceRepresentantsRow(ligne)) {
				return
			}
		}
	}), err
}

// Sur la POSITION et non sur la fiche : la même personne peut figurer dans deux
// campagnes, et c'est cette ligne-ci qui est traitée ou non.
func (s *service) lotPositionsTraitees(ctx context.Context, row *db.LotParIdRow) (map[int32]bool, error) {
	var positions []int32
	var err error
	if lotSurRepresentants(string(row.Cible)) {
		positions, err = s.Q.LotPositionsAppeleesRepresentants(ctx, db.LotPositionsAppeleesRepresentantsParams{
			LotId: row.ID, ClientCreatedAt: row.CreatedAt,
		})
	} else {
		positions, err = s.Q.LotPositionsAppeleesProspects(ctx, db.LotPositionsAppeleesProspectsParams{
			LotId: row.ID, ClientCreatedAt: row.CreatedAt,
		})
	}
	traitees := make(map[int32]bool, len(positions))
	for _, position := range positions {
		traitees[position] = true
	}
	return traitees, err
}

type CampagneMajInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Name      *string            `json:"name,omitempty" minLength:"3" maxLength:"120"`
		Objectifs []CampagneObjectif `json:"objectifs,omitempty"`
	}
}

// Ni le nom ni les objectifs ne redistribuent : les fiches sont déjà dans les
// mains, et un objectif est le dénominateur du taux de contact.
func (s *service) campagneMaj(ctx context.Context, in *CampagneMajInput) (*CampagneOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if in.Body.Name != nil {
		if err := s.Q.RenommerLot(ctx, db.RenommerLotParams{ID: in.ID, Name: strings.TrimSpace(*in.Body.Name)}); err != nil {
			return nil, err
		}
	}
	if in.Body.Objectifs != nil {
		filtres := lotLireFiltres(row.Filters)
		filtres.Distribution.Objectifs = lotObjectifsDe(in.Body.Objectifs)
		if err := s.lotEcrireFiltres(ctx, s.Q, in.ID, filtres); err != nil {
			return nil, err
		}
	}
	row, err = s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	resume, err := s.lotResume(ctx, row)
	if err != nil {
		return nil, err
	}
	return &CampagneOutput{Body: resume}, nil
}

func (*service) lotEcrireFiltres(ctx context.Context, q *db.Queries, id string, filtres *lotFiltres) error {
	brut, err := json.Marshal(filtres)
	if err != nil {
		return err
	}
	return q.EcrireFiltresLot(ctx, db.EcrireFiltresLotParams{ID: id, Filters: brut})
}

type CampagneReaffecterInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Positions            []int  `json:"positions" minItems:"1" maxItems:"1000"`
		VersTeleconseillerID string `json:"versTeleconseillerId" maxLength:"64"`
	}
}

// Une fiche déjà appelée reste où elle est : la déplacer ferait porter le
// travail d'un téléconseiller au compteur d'un autre.
func (s *service) campagneReaffecter(ctx context.Context, in *CampagneReaffecterInput) (*CampagneDetailOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if _, err := s.lotEquipe(ctx, []string{in.Body.VersTeleconseillerID}); err != nil {
		return nil, err
	}
	traitees, err := s.lotPositionsTraitees(ctx, row)
	if err != nil {
		return nil, err
	}
	var candidates []int32
	for _, position := range in.Body.Positions {
		if !traitees[lotInt32(position)] {
			candidates = append(candidates, lotInt32(position))
		}
	}
	deplacables, err := s.Q.LotPositionsDeplacables(ctx, db.LotPositionsDeplacablesParams{
		LotId: in.ID, Column2: candidates, AssigneeId: lotPointeurTexte(in.Body.VersTeleconseillerID),
	})
	if err != nil {
		return nil, err
	}
	if len(deplacables) == 0 {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_REAFFECTATION_VIDE",
			"Aucune de ces fiches n’est déplaçable : elles sont traitées, ou déjà à ce compte.")
	}
	parCedant := map[string][]int32{}
	for _, item := range deplacables {
		cedant := lotValeurTexte(item.AssigneeId)
		parCedant[cedant] = append(parCedant[cedant], item.Position)
	}
	vers := in.Body.VersTeleconseillerID
	equipe := lotLireFiltres(row.Filters).Distribution.TeleconseillerIds
	if !slices.Contains(equipe, vers) {
		equipe = append(equipe, vers)
	}
	lotMouvements := make([]lotMouvement, 0, len(parCedant))
	for _, cedant := range slices.Sorted(maps.Keys(parCedant)) {
		lotMouvements = append(lotMouvements, lotMouvement{de: cedant, vers: vers, positions: parCedant[cedant]})
	}
	if err := s.lotAppliquerMouvements(ctx, row, lotMouvements, equipe, "lot_export.reaffectation",
		map[string]any{"vers": vers}); err != nil {
		return nil, err
	}
	return s.campagneDetail(ctx, &CampagneIDInput{ID: in.ID})
}

type CampagneRetraitInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		TeleconseillerID string `json:"teleconseillerId" maxLength:"64"`
	}
}

// Le retiré rend ses fiches non traitées, redistribuées au reste de l'équipe
// selon les objectifs en vigueur.
func (s *service) campagneRetrait(ctx context.Context, in *CampagneRetraitInput) (*CampagneDetailOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	filtres := lotLireFiltres(row.Filters)
	restants := slices.DeleteFunc(slices.Clone(filtres.Distribution.TeleconseillerIds),
		func(membre string) bool { return membre == in.Body.TeleconseillerID })
	if len(restants) == 0 {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_EQUIPE_VIDE",
			"Une campagne garde au moins un téléconseiller.")
	}
	traitees, err := s.lotPositionsTraitees(ctx, row)
	if err != nil {
		return nil, err
	}
	detenues, err := s.Q.LotPositionsDunAgent(ctx, db.LotPositionsDunAgentParams{
		LotId: in.ID, AssigneeId: lotPointeurTexte(in.Body.TeleconseillerID),
	})
	if err != nil {
		return nil, err
	}
	var arendre []int32
	for _, position := range detenues {
		if !traitees[position] {
			arendre = append(arendre, position)
		}
	}
	equipe, err := s.lotEquipe(ctx, restants)
	if err != nil {
		return nil, err
	}
	membres := lotCapacites(equipe, max(1, filtres.Distribution.FichesParJour), filtres.Distribution.Objectifs)
	reprises := lotRepartir(len(arendre), membres, max(1, filtres.Distribution.Jours))
	parRepreneur := map[string][]int32{}
	for index, position := range arendre {
		if index >= len(reprises) {
			break
		}
		parRepreneur[reprises[index].assigneeID] = append(parRepreneur[reprises[index].assigneeID], position)
	}
	retire := in.Body.TeleconseillerID
	lotMouvements := make([]lotMouvement, 0, len(parRepreneur))
	for _, vers := range slices.Sorted(maps.Keys(parRepreneur)) {
		lotMouvements = append(lotMouvements, lotMouvement{de: retire, vers: vers, positions: parRepreneur[vers]})
	}
	if err := s.lotAppliquerMouvements(ctx, row, lotMouvements, restants, "lot_export.retrait",
		map[string]any{"teleconseillerId": retire}); err != nil {
		return nil, err
	}
	return s.campagneDetail(ctx, &CampagneIDInput{ID: in.ID})
}

type lotMouvement struct {
	de        string
	vers      string
	positions []int32
}

// Le déplacement des positions, sa trace et la nouvelle équipe dans une seule
// transaction : une trace écrite hors du geste survivrait à un geste annulé.
func (s *service) lotAppliquerMouvements(ctx context.Context, row *db.LotParIdRow, lotMouvements []lotMouvement,
	equipe []string, action string, details map[string]any,
) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	auteur := socle.UtilisateurCourant(ctx).ID
	fiches := 0
	for _, m := range lotMouvements {
		if err := q.DeplacerPositions(ctx, db.DeplacerPositionsParams{
			LotId: row.ID, Column2: m.positions, AssigneeId: lotPointeurTexte(m.vers),
		}); err != nil {
			return err
		}
		id, err := uuid.NewV7()
		if err != nil {
			return err
		}
		if err := q.InsertReaffectation(ctx, db.InsertReaffectationParams{
			ID: id.String(), LotId: row.ID, FromAssigneeId: lotPointeurTexte(m.de), ToAssigneeId: m.vers,
			Fiches: lotInt32(len(m.positions)), Positions: m.positions, PerformedById: auteur,
		}); err != nil {
			return err
		}
		fiches += len(m.positions)
	}
	filtres := lotLireFiltres(row.Filters)
	filtres.Distribution.TeleconseillerIds = equipe
	if err := s.lotEcrireFiltres(ctx, q, row.ID, filtres); err != nil {
		return err
	}
	details["fiches"] = fiches
	if err := database.Auditer(ctx, q, auteur, action, "lot_export", row.ID, nil, details); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *service) campagneSupprimer(ctx context.Context, in *CampagneIDInput) (*struct{}, error) {
	lignes, err := s.Q.SupprimerLot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if lignes == 0 {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_NOT_FOUND", campagneIntrouvable)
	}
	return &struct{}{}, nil
}

type CampagneFichesInput struct {
	ID               string `path:"id" format:"uuid"`
	TeleconseillerID string `query:"teleconseillerId" format:"uuid"`
	Etat             string `query:"etat" enum:"NON_TRAITEE,TRAITEE,A_RAPPELER"`
	Page             int    `query:"page" minimum:"1" default:"1"`
	PageSize         int    `query:"pageSize" minimum:"1" maximum:"200" default:"50"`
}

type CampagneFichesOutput struct {
	Body struct {
		Items []CampagneFiche  `json:"items"`
		Meta  CampagnePageMeta `json:"meta"`
	}
}

func (s *service) campagneFiches(ctx context.Context, in *CampagneFichesInput) (*CampagneFichesOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	traitees, err := s.lotPositionsTraitees(ctx, row)
	if err != nil {
		return nil, err
	}
	items, err := s.lotLireFiches(ctx, row, lotPointeurTexte(in.TeleconseillerID), traitees)
	if err != nil {
		return nil, err
	}
	if in.Etat != "" {
		items = slices.DeleteFunc(items, func(fiche CampagneFiche) bool { return fiche.Etat != in.Etat })
	}
	debut := min((in.Page-1)*in.PageSize, len(items))
	fin := min(debut+in.PageSize, len(items))
	out := &CampagneFichesOutput{}
	out.Body.Items = items[debut:fin]
	out.Body.Meta = lotMetaPage(len(items), in.Page, in.PageSize)
	return out, nil
}

func (s *service) lotLireFiches(ctx context.Context, row *db.LotParIdRow, agent *string,
	traitees map[int32]bool,
) ([]CampagneFiche, error) {
	if lotSurRepresentants(string(row.Cible)) {
		lignes, err := s.Q.LotFichesRepresentants(ctx, db.LotFichesRepresentantsParams{LotId: row.ID, AssigneeID: agent})
		if err != nil {
			return nil, err
		}
		fiches := make([]CampagneFiche, 0, len(lignes))
		for _, ligne := range lignes {
			fiches = append(fiches, CampagneFiche{
				Position: int(ligne.Position), Jour: int(ligne.Day), FicheID: ligne.FicheId,
				FullName: lotValeurTexte(ligne.FullName), PhoneE164: lotValeurTexte(ligne.PhoneE164),
				TeleconseillerID:   ligne.AssigneeId,
				TeleconseillerName: lotSiVide(lotValeurTexte(ligne.AssigneeName), "Non attribuée"),
				Etat:               lotEtatDe(traitees[ligne.Position], ligne.NextCallbackAt != nil),
				StatutLabel:        ligne.StatutLabel,
			})
		}
		return fiches, nil
	}
	lignes, err := s.Q.LotFichesProspects(ctx, db.LotFichesProspectsParams{LotId: row.ID, AssigneeID: agent})
	if err != nil {
		return nil, err
	}
	fiches := make([]CampagneFiche, 0, len(lignes))
	for _, ligne := range lignes {
		fiches = append(fiches, CampagneFiche{
			Position: int(ligne.Position), Jour: int(ligne.Day), FicheID: ligne.FicheId,
			FullName: lotNomEtPrenom(ligne.Nom, ligne.Prenom), PhoneE164: lotValeurTexte(ligne.PhoneE164),
			TeleconseillerID:   ligne.AssigneeId,
			TeleconseillerName: lotSiVide(lotValeurTexte(ligne.AssigneeName), "Non attribuée"),
			Etat:               lotEtatDe(traitees[ligne.Position], false),
			StatutLabel:        lotPointeurTexte(lotLibellesIssueAppel[ligne.LastCallOutcome]),
		})
	}
	return fiches, nil
}

// `A_RAPPELER` prime sur `TRAITEE` : une fiche appelée qui attend un rappel
// n'est pas finie.
func lotEtatDe(traitee, attendUnRappel bool) string {
	if attendUnRappel {
		return exports.LotEtatARappeler
	}
	if traitee {
		return lotEtatTraitee
	}
	return lotEtatNonTraitee
}

func lotNomEtPrenom(nom, prenom *string) string {
	parties := make([]string, 0, 2)
	for _, part := range []string{lotValeurTexte(nom), lotValeurTexte(prenom)} {
		if part != "" {
			parties = append(parties, part)
		}
	}
	return strings.Join(parties, " ")
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "createLotExport", Method: http.MethodPost,
		Path: "/api/v1/lots-export", DefaultStatus: http.StatusCreated,
	}, s.campagneCreer)
	huma.Register(api, huma.Operation{
		OperationID: "previewLotExport", Method: http.MethodPost,
		Path: "/api/v1/lots-export/apercu",
	}, s.campagneApercu)
	huma.Register(api, huma.Operation{
		OperationID: "listLotsExport", Method: http.MethodGet, Path: "/api/v1/lots-export",
	}, s.campagnesLister)
	huma.Register(api, huma.Operation{
		OperationID: "mesAttributions", Method: http.MethodGet,
		Path: "/api/v1/lots-export/mes-attributions",
	}, s.mesAttributions)
	huma.Register(api, huma.Operation{
		OperationID: "getLotExport", Method: http.MethodGet, Path: lotCheminID,
	}, s.campagneDetail)
	huma.Register(api, huma.Operation{
		OperationID: "updateLotExport", Method: http.MethodPatch, Path: lotCheminID,
	}, s.campagneMaj)
	huma.Register(api, huma.Operation{
		OperationID: "deleteLotExport", Method: http.MethodDelete,
		Path: lotCheminID, DefaultStatus: http.StatusNoContent,
	}, s.campagneSupprimer)
	huma.Register(api, huma.Operation{
		OperationID: "listLotExportFiches", Method: http.MethodGet,
		Path: "/api/v1/lots-export/{id}/fiches",
	}, s.campagneFiches)
	huma.Register(api, huma.Operation{
		OperationID: "reaffecterLotExport", Method: http.MethodPost,
		Path: "/api/v1/lots-export/{id}/reaffectation",
	}, s.campagneReaffecter)
	huma.Register(api, huma.Operation{
		OperationID: "retirerTeleconseillerLotExport", Method: http.MethodPost,
		Path: "/api/v1/lots-export/{id}/retrait",
	}, s.campagneRetrait)
	monterCampagnesExport(api, s)
}
