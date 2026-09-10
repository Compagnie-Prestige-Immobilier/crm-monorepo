package banque

import (
	"context"
	"cpi-go/internal/shared/socle"
)

type LectureDemandeBanqueInput struct {
	ID string `path:"id" format:"uuid"`
}

// Hors de son portefeuille, la demande est introuvable : un 403 dirait déjà à
// une banque qu'une concurrente a déposé ce client.
func (s *service) banqueLireDemande(ctx context.Context, in *LectureDemandeBanqueInput) (*DemandeBanqueOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	demande, err := s.banqueDemande(ctx, in.ID, banquePortefeuilleDemandes(&u))
	if err != nil {
		return nil, err
	}
	return &DemandeBanqueOutput{Body: demande}, nil
}
