package campagnes

import (
	"context"
	"cpi-go/internal/shared/socle"
)

type MesAttributionsOutput struct {
	Body struct {
		RepresentantIds []string `json:"representantIds"`
		ProspectIds     []string `json:"prospectIds"`
		Tout            bool     `json:"tout"`
	}
}

// Seul un téléconseiller travaille sur une part du portefeuille ; l'encadrement
// lit tout, et reçoit `tout` plutôt que la liste de toutes les fiches.
func (s *service) mesAttributions(ctx context.Context, _ *struct{}) (*MesAttributionsOutput, error) {
	out := &MesAttributionsOutput{}
	out.Body.RepresentantIds, out.Body.ProspectIds = []string{}, []string{}
	u := socle.UtilisateurCourant(ctx)
	if u.Role != socle.Commercial && u.Role != socle.ChargeClientele {
		out.Body.Tout = true
		return out, nil
	}
	rows, err := s.Q.LotFichesAttribuees(ctx, &u.ID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		if rows[i].RepresentantId != nil {
			out.Body.RepresentantIds = append(out.Body.RepresentantIds, *rows[i].RepresentantId)
		}
		if rows[i].ProspectId != nil {
			out.Body.ProspectIds = append(out.Body.ProspectIds, *rows[i].ProspectId)
		}
	}
	return out, nil
}
