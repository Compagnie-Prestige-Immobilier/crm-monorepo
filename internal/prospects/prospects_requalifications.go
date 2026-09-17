package prospects

import (
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type ProspectRequalification struct {
	ID            string  `json:"id"`
	De            string  `json:"de"`
	Vers          string  `json:"vers"`
	MethodeAnnule *string `json:"methodeAnnulee,omitempty"`
	ParID         *string `json:"parId,omitempty"`
	ParNom        *string `json:"parNom,omitempty"`
	Le            string  `json:"le"`
}

type ProspectRequalificationsOutput struct {
	Body struct {
		Items []ProspectRequalification `json:"items"`
	}
}

func (s *service) prospectRequalifications(ctx context.Context, in *ProspectIDInput) (*ProspectRequalificationsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.ListerRequalifications(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &ProspectRequalificationsOutput{}
	out.Body.Items = make([]ProspectRequalification, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		avant, apres := prospectTraceStatut(l.Before), prospectTraceStatut(l.After)
		out.Body.Items = append(out.Body.Items, ProspectRequalification{
			ID: l.ID, De: avant.Phase2Status, Vers: apres.Phase2Status,
			MethodeAnnule: avant.EnrollmentMethod, ParNom: l.ChangedByName, Le: prospectISO(l.At),
		})
	}
	return out, nil
}

type prospectTrace struct {
	Phase2Status     string  `json:"phase2Status"`
	EnrollmentMethod *string `json:"enrollmentMethod,omitempty"`
}

func prospectTraceStatut(brut []byte) prospectTrace {
	var trace prospectTrace
	if len(brut) == 0 {
		return trace
	}
	_ = json.Unmarshal(brut, &trace)
	return trace
}

func prospectMonterRequalifications(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "listProspectRequalifications", Method: http.MethodGet,
		Path: "/api/v1/prospects/{id}/requalifications",
	}, s.prospectRequalifications)
	prospectMonterRequalifier(api, s)
}
