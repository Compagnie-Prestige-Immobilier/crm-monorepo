package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

const prospectChampStatut = "statut"

type ProspectIDInput struct {
	ID string `path:"id" format:"uuid"`
}

type ProspectRequalifierInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Projet string `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
		Statut string `json:"statut" enum:"NOUVEAU"`
	}
}

// NOUVEAU remet la fiche à traiter ; les appels déjà passés restent à leur auteur.
func (s *service) prospectRequalifier(ctx context.Context, in *ProspectRequalifierInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	projet := db.Projet(in.Body.Projet)
	avant, err := s.Q.JourneyParProjet(ctx, db.JourneyParProjetParams{ProspectId: in.ID, Projet: projet})
	if err != nil {
		return nil, socle.Problem(http.StatusNotFound, "PROSPECT_PARCOURS_ABSENT", "Cette fiche n’a pas de parcours sur ce projet.")
	}
	if avant.Statut == db.ProspectStatutCONVERTI || avant.Statut == db.ProspectStatutVENDU {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_CONVERTI", "Une fiche convertie ou vendue ne se requalifie pas.")
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if _, err := q.RequalifierJourney(ctx, db.RequalifierJourneyParams{Statut: db.ProspectStatut(in.Body.Statut), ProspectID: in.ID, Projet: projet}); err != nil {
			return err
		}
		if err := q.RequalifierProspect(ctx, db.RequalifierProspectParams{Statut: db.ProspectStatut(in.Body.Statut), ProspectID: in.ID, Projet: projet}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.requalification_encadrement", prospectEntite, in.ID,
			map[string]any{"projet": in.Body.Projet, prospectChampStatut: string(avant.Statut), "consent": string(avant.Consent)},
			map[string]any{"projet": in.Body.Projet, prospectChampStatut: in.Body.Statut})
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func prospectMonterRequalifier(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "requalifierProspect", Method: http.MethodPost,
		Path: "/api/v1/prospects/{id}/requalifier",
	}, s.prospectRequalifier)
}
