package analytics

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	clauseJamaisVraie      = "FALSE"
	secondesParJour        = 86400
	seuilTempsMortSecondes = 15 * 60
	formatJourISO          = "YYYY-MM-DD"
	cleMatin               = "morning"
	cleApresMidi           = "afternoon"
	CleSemaine             = "week"
)

// Qui passe des appels et apparaît donc dans l'équipe. L'encadrement décroche
// aussi ; l'ADMIN est un compte d'administration, pas de plateau.
const rolesDuPlateau = `u."role" IN ('COMMERCIAL'::"Role", 'SUPERVISEUR'::"Role", 'DIRECTION'::"Role") AND u."deletedAt" IS NULL`

// Issues d'appel prospect qui ne comptent pas comme un contact. Un faux numéro
// n'en est plus : la fiche est traitée.
const IssuesNonJointes = `('UNREACHABLE')`

const (
	issuesRepresentantSaisissables = `('REACHED', 'REFUSED', 'CALLBACK', 'UNREACHABLE', 'WRONG_NUMBER')`
	IssuesRepresentantJointes      = `('REACHED', 'REFUSED', 'CALLBACK', 'WRONG_NUMBER')`
	effetsRepresentantJoints       = `('REACHED', 'REFUSED', 'SCHEDULE_CALLBACK', 'WRONG_NUMBER')`
)

const JointureStatutQualification = `LEFT JOIN "statuts_qualification" sq ON sq."id" = rca."statutQualificationId"`

// Ce que la tentative tranche de l'adhésion, ou NULL quand elle ne tranche rien.
// Une tentative d'avant le référentiel ne porte aucun statut : son issue reste
// le seul signal, sinon le taux changerait avec l'âge des données.
const ArbitrageDeLAdhesion = `CASE
    WHEN sq."relationStatus" IN ('AMBASSADEUR', 'REFUS') THEN sq."relationStatus"::text
    WHEN rca."statutQualificationId" IS NOT NULL THEN NULL
    WHEN rca."outcome" = 'REACHED' THEN 'AMBASSADEUR'
    WHEN rca."outcome" = 'REFUSED' THEN 'REFUS'
  END`

// EB-33 : une tentative lue comme dernier statut de sa fiche. « Éligible » borne
// le taux d'acceptation, hors faux numéro et hors fermeture sans arbitrage.
const colonnesFicheRepresentant = `
    (CASE WHEN sq."id" IS NOT NULL THEN sq."effect" IN ` + effetsRepresentantJoints + `
          ELSE rca."outcome" IN ` + IssuesRepresentantJointes + ` END)::int AS joint,
    (` + ArbitrageDeLAdhesion + ` = 'AMBASSADEUR')::int                     AS accepte,
    (` + ArbitrageDeLAdhesion + ` = 'REFUS')::int                           AS refuse,
    (CASE WHEN sq."id" IS NOT NULL THEN sq."effect" = 'SCHEDULE_CALLBACK'
          ELSE rca."outcome" = 'CALLBACK' END)::int                         AS rappel,
    (CASE WHEN sq."id" IS NOT NULL
          THEN sq."effect" IN ` + effetsRepresentantJoints + `
               AND sq."effect" <> 'WRONG_NUMBER'
               AND NOT (sq."effect" = 'REFUSED' AND sq."relationStatus" IS NULL)
          ELSE rca."outcome" IN ('REACHED', 'REFUSED', 'CALLBACK') END)::int AS eligible`

type FiltreDeSupervision struct {
	ActFrom      string `query:"actFrom"`
	ActTo        string `query:"actTo"`
	Granularity  string `query:"granularity" enum:"day,week"`
	Projet       string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	CommercialID string `query:"commercialId"`
	TimeFrom     string `query:"timeFrom" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$"`
	TimeTo       string `query:"timeTo" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$"`
}

func (s *service) cleDeCacheSupervision(ctx context.Context, route string, f *FiltreDeSupervision) string {
	return s.Cfg.Base + ":" + route + ":" + porteeDeCache(ctx) + ":" + strings.Join([]string{
		f.ActFrom, f.ActTo, f.Granularity, f.Projet, f.CommercialID, f.TimeFrom, f.TimeTo,
	}, "|")
}

// La fenêtre porte sur la date de l'ACTE, pas sur celle de la fiche : un
// téléconseiller resté hors ligne trois semaines verrait sinon ses appels du
// lundi comptés le jeudi de la synchronisation.
type perimetreSupervision struct {
	filtre *FiltreDeSupervision
	unite  string
	depuis *time.Time
	jusqua *time.Time
}

func nouveauPerimetreSupervision(f *FiltreDeSupervision, tz *time.Location) (perimetreSupervision, error) {
	perimetre := perimetreSupervision{filtre: f, unite: "day"}
	if f.Granularity == CleSemaine {
		perimetre.unite = CleSemaine
	}
	bornes := []struct {
		valeur, champ string
		fin           bool
		cible         **time.Time
	}{
		{f.ActFrom, "actFrom", false, &perimetre.depuis},
		{f.ActTo, "actTo", true, &perimetre.jusqua},
	}
	for _, borne := range bornes {
		if borne.valeur == "" {
			continue
		}
		instant, ok := borneDuJour(borne.valeur, tz, borne.fin)
		if !ok {
			return perimetre, erreurDateInvalide(borne.champ)
		}
		*borne.cible = &instant
	}
	return perimetre, nil
}

func (perimetre perimetreSupervision) fenetre(p *parametresSQL, colonne string) string {
	bornes := []string{}
	if perimetre.depuis != nil {
		bornes = append(bornes, colonne+" >= "+p.marque(*perimetre.depuis))
	}
	if perimetre.jusqua != nil {
		bornes = append(bornes, colonne+" <= "+p.marque(*perimetre.jusqua))
	}
	if perimetre.filtre.TimeFrom != "" {
		bornes = append(bornes, colonne+"::time >= "+p.marque(perimetre.filtre.TimeFrom)+"::time")
	}
	if perimetre.filtre.TimeTo != "" {
		bornes = append(bornes, colonne+"::time < "+p.marque(perimetre.filtre.TimeTo)+"::time")
	}
	if len(bornes) == 0 {
		return clauseToujoursVraie
	}
	return strings.Join(bornes, etSQL)
}

func (perimetre perimetreSupervision) teleconseiller(p *parametresSQL) string {
	if perimetre.filtre.CommercialID == "" {
		return rolesDuPlateau
	}
	return rolesDuPlateau + etSQL + `u."id" = ` + p.marque(perimetre.filtre.CommercialID)
}

// Un représentant est CHUES par construction : filtrer Grand Public le sort.
func (perimetre perimetreSupervision) representantsVisibles() string {
	if perimetre.filtre.Projet == socle.ProjetGrandPublic {
		return clauseJamaisVraie
	}
	return clauseToujoursVraie
}

func (perimetre perimetreSupervision) parcoursDuProjet(p *parametresSQL, colonne string) string {
	if perimetre.filtre.Projet == "" {
		return clauseToujoursVraie
	}
	return `EXISTS (SELECT 1 FROM "prospect_journeys" pj
	  WHERE pj."prospectId" = ` + colonne + ` AND pj."projet" = ` + p.marque(perimetre.filtre.Projet) + `::"Projet")`
}

// La ligne d'équipe se relit sur les mêmes faits que les lignes d'agents, sinon
// les deux dérivent au premier filtre ajouté.
func (perimetre perimetreSupervision) membreDeLEquipe(p *parametresSQL, colonne string) string {
	return colonne + ` IN (SELECT u."id" FROM "users" u WHERE ` + perimetre.teleconseiller(p) + `)`
}

func (perimetre perimetreSupervision) tronque(colonne string) string {
	return `date_trunc('` + perimetre.unite + `', ` + colonne + `)`
}

type CreneauDeTravail struct {
	Key   string `json:"key" enum:"morning,afternoon"`
	Label string `json:"label"`
	Start string `json:"start" example:"09:00"`
	End   string `json:"end" example:"14:00"`
}

var creneauxParDefaut = []CreneauDeTravail{
	{Key: cleMatin, Label: "Matin", Start: "09:00", End: "14:00"},
	{Key: cleApresMidi, Label: "Après-midi", Start: "15:00", End: "18:00"},
}

type CreneauxDeTravail struct {
	Shifts    []CreneauDeTravail `json:"shifts"`
	UpdatedAt *string            `json:"updatedAt"`
}

type CreneauxOutput struct{ Body CreneauxDeTravail }

type MajCreneauxInput struct {
	Body struct {
		MorningStart   string `json:"morningStart" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"09:00"`
		MorningEnd     string `json:"morningEnd" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"14:00"`
		AfternoonStart string `json:"afternoonStart" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"15:00"`
		AfternoonEnd   string `json:"afternoonEnd" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"18:00"`
	}
}

func secondesDepuisMinuit(heure string) int {
	heures, minutes := 0, 0
	parties := strings.SplitN(heure, ":", 2)
	if len(parties) == 2 {
		heures, _ = strconv.Atoi(parties[0])
		minutes, _ = strconv.Atoi(parties[1])
	}
	return heures*3600 + minutes*60
}

func heureEtMinute(secondes int) string {
	return fmt.Sprintf("%02d:%02d", secondes/3600, secondes%3600/60)
}

func creneauxOrdonnes(shifts []CreneauDeTravail) bool {
	if len(shifts) != 2 {
		return false
	}
	matin, apresMidi := shifts[0], shifts[1]
	if secondesDepuisMinuit(matin.Start) >= secondesDepuisMinuit(matin.End) {
		return false
	}
	if secondesDepuisMinuit(apresMidi.Start) >= secondesDepuisMinuit(apresMidi.End) {
		return false
	}
	return secondesDepuisMinuit(matin.End) <= secondesDepuisMinuit(apresMidi.Start)
}

// Un réglage illisible ou incohérent retombe sur les valeurs par défaut : la
// supervision ne peut pas s'arrêter sur un JSON abîmé.
func creneauxDuReglage(valeur string) []CreneauDeTravail {
	var reglage struct {
		Shifts []CreneauDeTravail `json:"shifts"`
	}
	if err := json.Unmarshal([]byte(valeur), &reglage); err != nil {
		return creneauxParDefaut
	}
	if len(reglage.Shifts) != 2 || reglage.Shifts[0].Key != cleMatin || reglage.Shifts[1].Key != cleApresMidi {
		return creneauxParDefaut
	}
	if !creneauxOrdonnes(reglage.Shifts) {
		return creneauxParDefaut
	}
	return reglage.Shifts
}

func (s *service) lireCreneauxDeTravail(ctx context.Context) (CreneauxDeTravail, error) {
	ligne, err := s.Q.CreneauxTravail(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return CreneauxDeTravail{Shifts: creneauxParDefaut}, nil
	}
	if err != nil {
		return CreneauxDeTravail{}, err
	}
	quand := ligne.UpdatedAt.UTC().Format(time.RFC3339Nano)
	return CreneauxDeTravail{Shifts: creneauxDuReglage(ligne.Value), UpdatedAt: &quand}, nil
}

func (s *service) creneauxDeTravail(ctx context.Context, _ *struct{}) (*CreneauxOutput, error) {
	corps, err := s.lireCreneauxDeTravail(ctx)
	if err != nil {
		return nil, err
	}
	return &CreneauxOutput{Body: corps}, nil
}

func (s *service) enregistrerCreneauxDeTravail(ctx context.Context, in *MajCreneauxInput) (*CreneauxOutput, error) {
	shifts := []CreneauDeTravail{
		{Key: cleMatin, Label: "Matin", Start: in.Body.MorningStart, End: in.Body.MorningEnd},
		{Key: cleApresMidi, Label: "Après-midi", Start: in.Body.AfternoonStart, End: in.Body.AfternoonEnd},
	}
	if !creneauxOrdonnes(shifts) {
		return nil, socle.Problem(http.StatusBadRequest, "INVALID_WORK_SHIFTS",
			"Les créneaux doivent être ordonnés, sans chevauchement.")
	}
	valeur, err := json.Marshal(map[string][]CreneauDeTravail{"shifts": shifts})
	if err != nil {
		return nil, err
	}
	auteur := socle.UtilisateurCourant(ctx).ID
	// Les créneaux servent de dénominateur aux notes de rendement : les
	// déplacer change tous les taux affichés, d'où la trace.
	avant := s.creneauxOuValeursParDefaut(ctx)
	var quand time.Time
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		ecrit, err := q.EnregistrerCreneauxTravail(ctx, db.EnregistrerCreneauxTravailParams{
			Value: string(valeur), UpdatedById: &auteur,
		})
		if err != nil {
			return err
		}
		quand = ecrit
		return database.Auditer(ctx, q, auteur, "supervision.creneaux", "supervision", "creneaux", avant, shifts)
	}); err != nil {
		return nil, err
	}
	iso := quand.UTC().Format(time.RFC3339Nano)
	return &CreneauxOutput{Body: CreneauxDeTravail{Shifts: shifts, UpdatedAt: &iso}}, nil
}

type StockParZone struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

type StockDesRepresentants struct {
	Total          int            `json:"total"`
	JamaisAppeles  int            `json:"jamaisAppeles"`
	Injoignables   int            `json:"injoignables"`
	ParDepartement []StockParZone `json:"parDepartement"`
	ParIef         []StockParZone `json:"parIef"`
}

type StockOutput struct{ Body StockDesRepresentants }

// Le stock, sans fenêtre : ce qu'il y a à appeler, pas ce qui a été fait.
// « Injoignable » se lit sur le statut porté par la fiche, hors « Injoignable
// définitif » qui ne repasse jamais (EB-06).
func (s *service) stockDesRepresentants(ctx context.Context, _ *struct{}) (*StockOutput, error) {
	cle := s.Cfg.Base + ":supervision/representants:" + porteeDeCache(ctx)
	corps, err := avecCache(cle, ttlAnalyses, func() (StockDesRepresentants, error) {
		compte, err := s.Q.StockRepresentants(ctx)
		if err != nil {
			return StockDesRepresentants{}, err
		}
		departements, err := s.Q.StockParDepartement(ctx)
		if err != nil {
			return StockDesRepresentants{}, err
		}
		iefs, err := s.Q.StockParIef(ctx)
		if err != nil {
			return StockDesRepresentants{}, err
		}
		stock := StockDesRepresentants{
			Total:          int(compte.Total),
			JamaisAppeles:  int(compte.JamaisAppeles),
			Injoignables:   int(compte.Injoignables),
			ParDepartement: make([]StockParZone, 0, len(departements)),
			ParIef:         make([]StockParZone, 0, len(iefs)),
		}
		for _, ligne := range departements {
			stock.ParDepartement = append(stock.ParDepartement,
				StockParZone{ID: ligne.ID, Label: ligne.Label, Count: int(ligne.Count)})
		}
		for _, ligne := range iefs {
			stock.ParIef = append(stock.ParIef,
				StockParZone{ID: ligne.ID, Label: ligne.Label, Count: int(ligne.Count)})
		}
		return stock, nil
	})
	if err != nil {
		return nil, err
	}
	return &StockOutput{Body: corps}, nil
}

type TotauxDesCampagnes struct {
	Prevues          int      `json:"prevues"`
	Appelees         int      `json:"appelees"`
	Traitees         int      `json:"traitees"`
	ContactRate      *float64 `json:"contactRate"`
	ExploitationRate *float64 `json:"exploitationRate"`
}

type CampagneParTeleconseiller struct {
	TotauxDesCampagnes
	TeleconseillerID   string `json:"teleconseillerId"`
	TeleconseillerName string `json:"teleconseillerName"`
}

type CampagneSupervisee struct {
	TotauxDesCampagnes
	ID                string                      `json:"id"`
	Name              string                      `json:"name"`
	Cible             string                      `json:"cible" enum:"REPRESENTANTS,PROSPECTS,REPRESENTANTS_INJOIGNABLES,CONTACTS_RECOMMANDES"`
	CreatedAt         string                      `json:"createdAt"`
	ParTeleconseiller []CampagneParTeleconseiller `json:"parTeleconseiller"`
}

type RendementDesCampagnes struct {
	Items  []CampagneSupervisee `json:"items"`
	Totals TotauxDesCampagnes   `json:"totals"`
}

type CampagnesOutput struct{ Body RendementDesCampagnes }

type ligneDeCampagne struct {
	LotID              string
	Name               string
	Cible              string
	CreatedAt          time.Time
	TeleconseillerID   string
	TeleconseillerName string
	Prevues            int32
	Appelees           int32
	Traitees           int32
}

// Une campagne est un lot d'export ; le dénominateur est ce qui a été confié pour
// les jours de programme de la fenêtre. Jour 1 du programme = journée de création
// du lot. `granularity`, `timeFrom` et `timeTo` sont ignorés.
func sqlRendementDesCampagnes(perimetre perimetreSupervision, p *parametresSQL) string {
	projet := clauseToujoursVraie
	if perimetre.filtre.Projet != "" {
		projet = `l."projet" = ` + p.marque(perimetre.filtre.Projet) + `::"Projet"`
	}
	assignee := clauseToujoursVraie
	if perimetre.filtre.CommercialID != "" {
		assignee = `i."assigneeId" = ` + p.marque(perimetre.filtre.CommercialID)
	}
	jourProgramme := `(date_trunc('day', l."createdAt") + (i."day" - 1) * interval '1 day')`
	fenetre := []string{}
	if perimetre.depuis != nil {
		fenetre = append(fenetre, jourProgramme+" >= "+p.marque(*perimetre.depuis))
	}
	if perimetre.jusqua != nil {
		fenetre = append(fenetre, jourProgramme+" <= "+p.marque(*perimetre.jusqua))
	}
	if len(fenetre) == 0 {
		fenetre = append(fenetre, clauseToujoursVraie)
	}
	avantLaFin := clauseToujoursVraie
	if perimetre.jusqua != nil {
		avantLaFin = `t."clientCreatedAt" <= ` + p.marque(*perimetre.jusqua)
	}
	viseLaFiche := `t."clientCreatedAt" >= l."createdAt" AND ` + avantLaFin + `
	  AND CASE WHEN i."representantId" IS NOT NULL
	           THEN t."representantId" = i."representantId"
	           ELSE t."prospectId" = i."prospectId" END`
	return `
	WITH tentatives AS (
	  SELECT "representantId", NULL::text AS "prospectId", "clientCreatedAt",
	         ("outcome" IN ` + issuesRepresentantSaisissables + ` OR "statutQualificationId" IS NOT NULL) AS traite
	  FROM "rep_call_attempts"
	  UNION ALL
	  SELECT NULL::text, "prospectId", "clientCreatedAt", TRUE
	  FROM "call_attempts"
	),
	fiches AS (
	  SELECT
	    l."id" AS "lotId", l."name", l."cible", l."createdAt", i."assigneeId",
	    EXISTS (SELECT 1 FROM tentatives t WHERE ` + viseLaFiche + `)              AS appelee,
	    EXISTS (SELECT 1 FROM tentatives t WHERE t.traite AND ` + viseLaFiche + `) AS traitee
	  FROM "lots_export" l
	  INNER JOIN "lot_export_items" i ON i."lotId" = l."id"
	  WHERE i."assigneeId" IS NOT NULL AND ` + projet + etSQL + assignee +
		etSQL + strings.Join(fenetre, etSQL) + `
	)
	SELECT
	  f."lotId", f."name", f."cible"::text AS cible, f."createdAt",
	  f."assigneeId" AS "teleconseillerId",
	  u."fullName"   AS "teleconseillerName",
	  COUNT(*)::int                          AS prevues,
	  COUNT(*) FILTER (WHERE f.appelee)::int AS appelees,
	  COUNT(*) FILTER (WHERE f.traitee)::int AS traitees
	FROM fiches f
	INNER JOIN "users" u ON u."id" = f."assigneeId"
	GROUP BY 1, 2, 3, 4, 5, 6
	ORDER BY f."createdAt" DESC, f."name" ASC, u."fullName" ASC`
}

func (s *service) rendementDesCampagnes(ctx context.Context, f *FiltreDeSupervision) (*CampagnesOutput, error) {
	corps, err := avecCache(s.cleDeCacheSupervision(ctx, "supervision/campagnes", f), ttlSupervision, func() (RendementDesCampagnes, error) {
		perimetre, err := nouveauPerimetreSupervision(f, s.Cfg.TimeZone)
		if err != nil {
			return RendementDesCampagnes{}, err
		}
		p := &parametresSQL{}
		lignes, err := lignesAgregat[ligneDeCampagne](ctx, s, sqlRendementDesCampagnes(perimetre, p), p.args)
		if err != nil {
			return RendementDesCampagnes{}, err
		}
		return assemblerLesCampagnes(lignes), nil
	})
	if err != nil {
		return nil, err
	}
	return &CampagnesOutput{Body: corps}, nil
}

func totauxDuneCampagne(prevues, appelees, traitees int) TotauxDesCampagnes {
	return TotauxDesCampagnes{
		Prevues:          prevues,
		Appelees:         appelees,
		Traitees:         traitees,
		ContactRate:      tauxOuNul(appelees, prevues),
		ExploitationRate: tauxOuNul(traitees, prevues),
	}
}

func assemblerLesCampagnes(lignes []ligneDeCampagne) RendementDesCampagnes {
	ordre := []string{}
	parLot := map[string]*CampagneSupervisee{}
	for _, ligne := range lignes {
		lot, connu := parLot[ligne.LotID]
		if !connu {
			lot = &CampagneSupervisee{
				ID:        ligne.LotID,
				Name:      ligne.Name,
				Cible:     ligne.Cible,
				CreatedAt: ligne.CreatedAt.UTC().Format(time.RFC3339Nano),
			}
			parLot[ligne.LotID] = lot
			ordre = append(ordre, ligne.LotID)
		}
		lot.Prevues += int(ligne.Prevues)
		lot.Appelees += int(ligne.Appelees)
		lot.Traitees += int(ligne.Traitees)
		lot.ParTeleconseiller = append(lot.ParTeleconseiller, CampagneParTeleconseiller{
			TotauxDesCampagnes: totauxDuneCampagne(int(ligne.Prevues), int(ligne.Appelees), int(ligne.Traitees)),
			TeleconseillerID:   ligne.TeleconseillerID,
			TeleconseillerName: ligne.TeleconseillerName,
		})
	}
	items := make([]CampagneSupervisee, 0, len(ordre))
	prevues, appelees, traitees := 0, 0, 0
	for _, id := range ordre {
		lot := parLot[id]
		lot.TotauxDesCampagnes = totauxDuneCampagne(lot.Prevues, lot.Appelees, lot.Traitees)
		prevues += lot.Prevues
		appelees += lot.Appelees
		traitees += lot.Traitees
		items = append(items, *lot)
	}
	return RendementDesCampagnes{Items: items, Totals: totauxDuneCampagne(prevues, appelees, traitees)}
}

func monterSupervision(api huma.API, s *service) {
	routeDeLecture(api, "getSupervisionRepresentants", "/api/v1/supervision/representants", s.stockDesRepresentants)
	monterQualiteDeLaBase(api, s)
	monterQualiteDuMarketing(api, s)
	routeDeLecture(api, "getSupervisionCampagnes", "/api/v1/supervision/campagnes", s.rendementDesCampagnes)
	routeDeLecture(api, "getSupervisionActivite", "/api/v1/supervision/activite", s.activiteDesTeleconseillers)
	routeDeLecture(api, "getSupervisionCreneaux", "/api/v1/supervision/creneaux", s.creneauxDeTravail)
	huma.Register(api, huma.Operation{
		OperationID: "updateSupervisionCreneaux",
		Method:      http.MethodPut,
		Path:        "/api/v1/supervision/creneaux",
	}, s.enregistrerCreneauxDeTravail)
}
