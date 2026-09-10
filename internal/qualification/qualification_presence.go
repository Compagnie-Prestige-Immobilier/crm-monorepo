package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const presenceBattementMinimum = 10 * time.Second

type presenceCadence struct {
	mu  sync.Mutex
	vus map[string]time.Time
}

var presenceBattements = &presenceCadence{vus: map[string]time.Time{}}

func (c *presenceCadence) tropTot(cle string, maintenant time.Time, minimum time.Duration) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, t := range c.vus {
		if maintenant.Sub(t) > time.Hour {
			delete(c.vus, k)
		}
	}
	if t, vu := c.vus[cle]; vu && maintenant.Sub(t) < minimum {
		return true
	}
	c.vus[cle] = maintenant
	return false
}

func presenceMonterRoutes(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "recordPresenceBeat", Method: http.MethodPost,
		Path: "/api/v1/presence/beat", DefaultStatus: http.StatusNoContent,
	}, s.presenceBattement)
}

func (s *service) presenceBattement(ctx context.Context, _ *struct{}) (*struct{}, error) {
	u := socle.UtilisateurCourant(ctx)
	maintenant := time.Now().UTC()
	recu := &struct{}{}
	if presenceBattements.tropTot(u.ID, maintenant, presenceBattementMinimum) {
		return recu, nil
	}
	if err := s.Q.BattementAgent(ctx, db.BattementAgentParams{UserID: u.ID, At: &maintenant}); err != nil {
		return nil, err
	}
	return recu, s.Q.TrancheDActivite(ctx, db.TrancheDActiviteParams{UserID: u.ID, At: maintenant})
}
