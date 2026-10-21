package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"
	"slices"

	"github.com/danielgtaylor/huma/v2"
)

const (
	prospectCheminBant = "/api/v1/prospects/{id}/bant"
	bantZoneAutre      = "AUTRE"
)

type ProspectBant struct {
	Projet     *string `json:"projet" required:"false" enum:"TERRAIN,BIEN,CONSTRUIRE,COLLECTIF,CONSEIL,AUTRE"`
	Zone       *string `json:"zone" required:"false" maxLength:"120" doc:"Nom d'un site de vente actif, ou AUTRE."`
	Document   *string `json:"document" required:"false" enum:"TITRE_FONCIER,BAIL,DELIBERATION,CONSEIL,AUTRE"`
	Budget     *string `json:"budget" required:"false" enum:"M1_5,M5_15,M15_30,M30_75,PLUS_75"`
	Suivi      *string `json:"suivi" required:"false" enum:"MOI_MEME,PROCHE_PROCURATION,PROCHE_SANS_PROCURATION,MANDATAIRE,DISTANCE"`
	Calendrier *int16  `json:"calendrier" required:"false" minimum:"1" maximum:"5"`
	Besoin     *int16  `json:"besoin" required:"false" minimum:"1" maximum:"5"`
	Autorite   *int16  `json:"autorite" required:"false" minimum:"1" maximum:"5"`
	Capacite   *int16  `json:"capacite" required:"false" minimum:"1" maximum:"5"`
	Score      *int16  `json:"score" required:"false" readOnly:"true" doc:"Sur 100 : calendrier ×4, besoin ×5, autorité ×5, capacité ×6."`
}

type ProspectBantInput struct {
	ID   string `path:"id" format:"uuid"`
	Body ProspectBant
}

func prospectBantDe(p *db.Prospect) ProspectBant {
	return ProspectBant{
		Projet: p.BantProjet, Zone: p.BantZone, Document: p.BantDocument, Budget: p.BantBudget, Suivi: p.BantSuivi,
		Calendrier: p.BantCalendrier, Besoin: p.BantBesoin, Autorite: p.BantAutorite, Capacite: p.BantCapacite,
		Score: p.BantScore,
	}
}

func (s *service) prospectModifierBant(ctx context.Context, in *ProspectBantInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	avant, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	b := in.Body
	if b.Zone != nil && *b.Zone != bantZoneAutre {
		zones, err := s.Q.ZonesBant(ctx)
		if err != nil {
			return nil, err
		}
		if !slices.Contains(zones, *b.Zone) {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "BANT_ZONE_INCONNUE", "Cette zone n’est pas un site de vente actif.")
		}
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.ModifierBantProspect(ctx, db.ModifierBantProspectParams{
			Projet: b.Projet, Zone: b.Zone, Document: b.Document, Budget: b.Budget, Suivi: b.Suivi,
			Calendrier: b.Calendrier, Besoin: b.Besoin, Autorite: b.Autorite, Capacite: b.Capacite, ProspectID: in.ID,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.bant", prospectEntite, in.ID, avant.Bant, b)
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func prospectMonterBant(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "modifierBantProspect", Method: http.MethodPut, Path: prospectCheminBant,
	}, s.prospectModifierBant)
}
