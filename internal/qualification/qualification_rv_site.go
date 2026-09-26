package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	qualificationCodeRvSite = "RV_SITE"
	cleReglagesRvSite       = "rv_site.reglages"
	cheminCreneauxRvSite    = "/api/v1/phase2/rv-site/creneaux"
	creneauxJoursMax        = 31
)

// Sans réglage enregistré : le mardi et le jeudi, de 9 h à 20 h, deux mois à l'avance, sans limite.
type RvSiteReglages struct {
	Jours        []int `json:"jours" maxItems:"7" doc:"Jours ISO ouverts : 1 lundi, 7 dimanche."`
	HeureDebut   int   `json:"heureDebut" minimum:"0" maximum:"23" doc:"Première heure proposée, heure de Dakar."`
	HeureFin     int   `json:"heureFin" minimum:"0" maximum:"23" doc:"Dernière heure proposée, heure de Dakar."`
	HorizonJours int   `json:"horizonJours" minimum:"1" maximum:"365"`
	MaxVisites   *int  `json:"maxVisites,omitempty" minimum:"1" maximum:"999" doc:"Visites par heure ; absent : sans limite."`
}

func rvSiteReglagesParDefaut() RvSiteReglages {
	return RvSiteReglages{Jours: []int{2, 4}, HeureDebut: 9, HeureFin: 20, HorizonJours: 60}
}

type QualificationRvSiteSite struct {
	ID   string `json:"id"`
	Nom  string `json:"nom"`
	Prix int64  `json:"prix"`
}

type QualificationRvSitePoint struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type QualificationRvSiteReservation struct {
	Quand  time.Time `json:"quand"`
	Nombre int32     `json:"nombre"`
}

type QualificationRvSiteOutput struct {
	Body struct {
		Reglages     RvSiteReglages                   `json:"reglages"`
		Sites        []QualificationRvSiteSite        `json:"sites"`
		Points       []QualificationRvSitePoint       `json:"points"`
		Reservations []QualificationRvSiteReservation `json:"reservations"`
	}
}

type RvSiteReglagesInput struct{ Body RvSiteReglages }

type RvSiteReglagesOutput struct{ Body RvSiteReglages }

func rvSiteMonterRoutes(api huma.API, s *service) {
	huma.Register(api, qualificationRoute("rvSiteChoix", http.MethodGet, "/api/v1/phase2/rv-site"), s.rvSiteChoix)
	huma.Register(api, qualificationRoute("rvSiteCreneaux", http.MethodGet, cheminCreneauxRvSite), s.rvSiteCreneaux)
	huma.Register(api, qualificationRoute("rvSiteReglagesLire", http.MethodGet, "/api/v1/rv-site/reglages"), s.rvSiteReglagesLire)
	huma.Register(api, qualificationRoute("rvSiteReglagesEcrire", http.MethodPut, "/api/v1/rv-site/reglages"), s.rvSiteReglagesEcrire)
}

func rvSiteReglages(ctx context.Context, q *db.Queries) (RvSiteReglages, error) {
	r := rvSiteReglagesParDefaut()
	ligne, err := q.GetSetting(ctx, cleReglagesRvSite)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, nil
	}
	if err != nil {
		return r, err
	}
	err = json.Unmarshal([]byte(ligne.Value), &r)
	return r, err
}

func (s *service) rvSiteReglagesLire(ctx context.Context, _ *struct{}) (*RvSiteReglagesOutput, error) {
	r, err := rvSiteReglages(ctx, s.Q)
	return &RvSiteReglagesOutput{Body: r}, err
}

func rvSiteJoursPropres(brut []int) ([]int, error) {
	jours := make([]int, 0, len(brut))
	for _, jour := range brut {
		if jour < 1 || jour > 7 {
			return nil, rvSiteRefus("RV_SITE_JOURS", "Un jour se note de 1 (lundi) à 7 (dimanche).")
		}
		if !slices.Contains(jours, jour) {
			jours = append(jours, jour)
		}
	}
	slices.Sort(jours)
	return jours, nil
}

func (s *service) rvSiteReglagesEcrire(ctx context.Context, in *RvSiteReglagesInput) (*RvSiteReglagesOutput, error) {
	r := in.Body
	if r.HeureDebut > r.HeureFin {
		return nil, rvSiteRefus("RV_SITE_HEURES", "La première heure doit précéder la dernière.")
	}
	var err error
	if r.Jours, err = rvSiteJoursPropres(r.Jours); err != nil {
		return nil, err
	}
	valeur, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	avant, err := rvSiteReglages(ctx, s.Q)
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if _, err := q.UpsertSetting(ctx, db.UpsertSettingParams{Key: cleReglagesRvSite, Value: string(valeur), UpdatedById: &u.ID}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "rv_site.reglages", "rv_site", cleReglagesRvSite, avant, r)
	})
	return &RvSiteReglagesOutput{Body: r}, err
}

func (s *service) rvSiteChoix(ctx context.Context, _ *struct{}) (*QualificationRvSiteOutput, error) {
	out := &QualificationRvSiteOutput{}
	var err error
	if out.Body.Reglages, err = rvSiteReglages(ctx, s.Q); err != nil {
		return nil, err
	}
	sites, err := s.Q.RvSiteSites(ctx)
	if err != nil {
		return nil, err
	}
	points, err := s.Q.RvSitePoints(ctx)
	if err != nil {
		return nil, err
	}
	maintenant := time.Now().UTC()
	reservations, err := s.Q.RvSiteReservations(ctx, db.RvSiteReservationsParams{
		Du: maintenant, Au: maintenant.AddDate(0, 0, out.Body.Reglages.HorizonJours+1),
	})
	if err != nil {
		return nil, err
	}
	out.Body.Sites = make([]QualificationRvSiteSite, 0, len(sites))
	for _, r := range sites {
		out.Body.Sites = append(out.Body.Sites, QualificationRvSiteSite{ID: r.ID, Nom: r.Nom, Prix: r.PrixUnitaireDefaut})
	}
	out.Body.Points = make([]QualificationRvSitePoint, 0, len(points))
	for _, r := range points {
		out.Body.Points = append(out.Body.Points, QualificationRvSitePoint{ID: r.ID, Label: r.Label})
	}
	out.Body.Reservations = make([]QualificationRvSiteReservation, 0, len(reservations))
	for _, r := range reservations {
		out.Body.Reservations = append(out.Body.Reservations, QualificationRvSiteReservation{Quand: r.Quand.UTC(), Nombre: r.Nombre})
	}
	return out, nil
}

type RvSiteCreneauxInput struct {
	Du string `query:"du" required:"true" format:"date" doc:"Premier jour, AAAA-MM-JJ, heure de Dakar."`
	Au string `query:"au" required:"true" format:"date" doc:"Dernier jour inclus, 31 jours au plus après le premier."`
}

type RvSiteCreneau struct {
	Quand     time.Time `json:"quand"`
	Capacite  *int      `json:"capacite" doc:"Visites par heure ; nul : sans limite."`
	Reserves  int       `json:"reserves"`
	Restantes *int      `json:"restantes" doc:"Nul : sans limite."`
}

type RvSiteCreneauxOutput struct {
	Body struct {
		Creneaux []RvSiteCreneau `json:"creneaux"`
	}
}

// La capacité vaut pour l'heure, tous sites confondus, comme le contrôle de rvSiteChoixDisponible.
func (s *service) rvSiteCreneaux(ctx context.Context, in *RvSiteCreneauxInput) (*RvSiteCreneauxOutput, error) {
	zone := s.Cfg.TimeZone
	premier, errDu := time.ParseInLocation(time.DateOnly, in.Du, zone)
	dernier, errAu := time.ParseInLocation(time.DateOnly, in.Au, zone)
	if errDu != nil || errAu != nil || dernier.Before(premier) || dernier.After(premier.AddDate(0, 0, creneauxJoursMax)) {
		return nil, rvSiteRefus("RV_SITE_PERIODE", "La période va du premier au dernier jour, 31 jours au plus.")
	}
	reglages, err := rvSiteReglages(ctx, s.Q)
	if err != nil {
		return nil, err
	}
	reservations, err := s.Q.RvSiteReservations(ctx, db.RvSiteReservationsParams{Du: premier.UTC(), Au: dernier.AddDate(0, 0, 1).UTC()})
	if err != nil {
		return nil, err
	}
	pris := make(map[time.Time]int, len(reservations))
	for _, r := range reservations {
		pris[r.Quand.UTC()] = int(r.Nombre)
	}
	maintenant := time.Now().In(zone)
	out := &RvSiteCreneauxOutput{}
	out.Body.Creneaux = []RvSiteCreneau{}
	for jour := premier; !jour.After(dernier); jour = jour.AddDate(0, 0, 1) {
		for heure := reglages.HeureDebut; heure <= reglages.HeureFin; heure++ {
			quand := time.Date(jour.Year(), jour.Month(), jour.Day(), heure, 0, 0, 0, zone)
			if quand.Before(maintenant) || !rvSiteHeureOuverte(&reglages, quand, maintenant) {
				continue
			}
			out.Body.Creneaux = append(out.Body.Creneaux, rvSiteCreneau(quand.UTC(), pris[quand.UTC()], reglages.MaxVisites))
		}
	}
	return out, nil
}

func rvSiteCreneau(quand time.Time, reserves int, capacite *int) RvSiteCreneau {
	creneau := RvSiteCreneau{Quand: quand, Capacite: capacite, Reserves: reserves}
	if capacite != nil {
		restantes := max(*capacite-reserves, 0)
		creneau.Restantes = &restantes
	}
	return creneau
}

func rvSiteHorsSujet(b *QualificationCallAttemptBody) error {
	if b.SiteID != nil || b.PointRencontreID != nil || b.PointRencontreCommentaire != nil {
		return rvSiteRefus("PHASE2_RV_SITE_ONLY", "Le site et le point de rencontre ne se saisissent que pour un RV site.")
	}
	return nil
}

func rvSiteRefus(code, message string) error {
	return socle.Problem(http.StatusBadRequest, code, message)
}

// Une heure pleine, un jour ouvert, dans la plage et avant l'horizon, à l'heure locale.
func rvSiteHeureOuverte(r *RvSiteReglages, quand, reference time.Time) bool {
	jour := (int(quand.Weekday())+6)%7 + 1
	heure := quand.Hour()
	debut := time.Date(reference.Year(), reference.Month(), reference.Day(), 0, 0, 0, 0, reference.Location())
	return slices.Contains(r.Jours, jour) && quand.Truncate(time.Hour).Equal(quand) &&
		heure >= r.HeureDebut && heure <= r.HeureFin &&
		quand.Before(debut.AddDate(0, 0, r.HorizonJours+1))
}

// Un RV site se prend à une heure ouverte, vers un site et depuis un point de
// rencontre encore proposés ; ces champs n'ont pas de sens sur un autre statut.
func (s *service) rvSiteVerifier(ctx context.Context, q *db.Queries, b *QualificationCallAttemptBody, code string) error {
	if code != qualificationCodeRvSite {
		return rvSiteHorsSujet(b)
	}
	if b.CallbackAt == nil || b.SiteID == nil || b.PointRencontreID == nil {
		return rvSiteRefus("PHASE2_RV_SITE_INCOMPLETE", "Un RV site exige la date, le site intéressé et le point de rencontre.")
	}
	reglages, err := rvSiteReglages(ctx, q)
	if err != nil {
		return err
	}
	if !rvSiteHeureOuverte(&reglages, b.CallbackAt.In(s.Cfg.TimeZone), b.ClientCreatedAt.In(s.Cfg.TimeZone)) {
		return rvSiteRefus("PHASE2_RV_SITE_CRENEAU", "Cette date n'est pas ouverte aux RV site. Choisissez un jour et une heure proposés.")
	}
	return rvSiteChoixDisponible(ctx, q, b, reglages.MaxVisites)
}

// Le verrou tient jusqu'à la fin de la transaction : deux RV simultanés ne voient pas la même place libre.
func rvSiteChoixDisponible(ctx context.Context, q *db.Queries, b *QualificationCallAttemptBody, maxVisites *int) error {
	if err := q.VerrouCreneauxRvSite(ctx); err != nil {
		return err
	}
	choix, err := q.RvSiteChoixValide(ctx, db.RvSiteChoixValideParams{
		ProspectID: b.ProspectID, Quand: b.CallbackAt.UTC(), SiteID: *b.SiteID, PointRencontreID: *b.PointRencontreID,
	})
	if err != nil {
		return err
	}
	if maxVisites != nil && int(choix.Reserves) >= *maxVisites {
		return socle.Problem(http.StatusConflict, "PHASE2_RV_SITE_COMPLET", "Cette heure n'est plus disponible. Choisissez-en une autre.")
	}
	if !choix.Site || !choix.Point {
		return rvSiteRefus("PHASE2_RV_SITE_RETIRE", "Ce site ou ce point de rencontre n'est plus proposé. Rechargez la fiche.")
	}
	return nil
}
