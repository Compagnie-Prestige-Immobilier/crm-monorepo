package campagnes

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"strings"
	"time"
)

type CampagneMajInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Name      *string            `json:"name,omitempty" minLength:"3" maxLength:"120"`
		Objectifs []CampagneObjectif `json:"objectifs,omitempty"`
		EnPause   *bool              `json:"enPause,omitempty"`
	}
}

// En pause, les fiches du lot sortent des consoles de ses téléconseillers ;
// la reprise les y ramène telles quelles.
func (s *service) lotPauser(ctx context.Context, id string, enPause bool) error {
	var at *time.Time
	if enPause {
		maintenant := time.Now().UTC()
		at = &maintenant
	}
	return s.Q.PauserLot(ctx, db.PauserLotParams{ID: id, At: at})
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
	if in.Body.EnPause != nil {
		if err := s.lotPauser(ctx, in.ID, *in.Body.EnPause); err != nil {
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
