package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

const methodeAucune = "AUCUNE"

type ProspectMethodeInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Methode string `json:"methode" enum:"AUCUNE,APPOINTMENT,PLATFORM,VOICE_OR_ELECTRONIC_MESSAGING,WHATSAPP"`
	}
}

func (s *service) prospectModifierMethode(ctx context.Context, in *ProspectMethodeInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	avant, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	var methode *string
	if in.Body.Methode != methodeAucune {
		methode = &in.Body.Methode
	}
	converti := avant.Statut == string(db.ProspectStatutCONVERTI) || avant.Statut == string(db.ProspectStatutVENDU)
	if methode == nil && converti {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_CONVERTI", "Une fiche convertie ou vendue garde sa méthode d’enrôlement.")
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.ModifierMethodeJourney(ctx, db.ModifierMethodeJourneyParams{
			Methode: methode, Par: u.ID, ProspectID: in.ID, Projet: db.Projet(avant.Projet),
		}); err != nil {
			return err
		}
		if err := q.ModifierMethodeProspect(ctx, db.ModifierMethodeProspectParams{
			Methode: methode, Par: u.ID, ProspectID: in.ID,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.methode_encadrement", prospectEntite, in.ID,
			map[string]any{"enrollmentMethod": avant.EnrollmentMethod, "phase2Status": avant.Phase2Status},
			map[string]any{"enrollmentMethod": methode})
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func prospectMonterMethode(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "modifierMethodeProspect", Method: http.MethodPut,
		Path: "/api/v1/prospects/{id}/methode",
	}, s.prospectModifierMethode)
}
