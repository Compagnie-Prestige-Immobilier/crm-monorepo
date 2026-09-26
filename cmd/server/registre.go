package main

import (
	"cpi-go/internal/shared/socle"
	"net/http"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Une base de démonstration se monte et se démonte pendant que le serveur sert :
// la carte des instances ne peut plus être figée au démarrage.
type registre struct {
	mu       sync.RWMutex
	gardes   map[string]http.Handler
	pools    map[string]*pgxpool.Pool
	flux     map[string]*socle.Live
	annuaire *socle.Annuaire
}

func nouveauRegistre(annuaire *socle.Annuaire) *registre {
	return &registre{
		gardes:   map[string]http.Handler{},
		pools:    map[string]*pgxpool.Pool{},
		flux:     map[string]*socle.Live{},
		annuaire: annuaire,
	}
}

func (r *registre) monter(nom string, i *instance, pool *pgxpool.Pool) {
	r.mu.Lock()
	r.gardes[nom] = socle.GarderAcces(i.mux, i.deps.Q, i.deps.Attributions, nom)
	r.pools[nom] = pool
	r.flux[nom] = i.deps.Live
	r.mu.Unlock()
	r.annuaire.Ajouter(nom)
}

// Retirer d'abord, fermer ensuite : une requête en vol ne doit pas trouver un
// pool déjà clos. `Close` attend le retour des connexions acquises.
func (r *registre) demonter(nom string) *pgxpool.Pool {
	r.mu.Lock()
	delete(r.gardes, nom)
	pool := r.pools[nom]
	delete(r.pools, nom)
	live := r.flux[nom]
	delete(r.flux, nom)
	r.mu.Unlock()
	r.annuaire.Retirer(nom)
	if live != nil {
		live.Fermer()
	}
	return pool
}

// `Shutdown` attend chaque flux ouvert : celui d'une base de démonstration
// aussi, sinon l'arrêt atteint son délai et sort en erreur.
func (r *registre) fermerFlux() {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, live := range r.flux {
		live.Fermer()
	}
}

func (r *registre) garde(nom string) (http.Handler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	g, ok := r.gardes[nom]
	return g, ok
}

func (r *registre) fermerTout() {
	r.mu.Lock()
	pools := make([]*pgxpool.Pool, 0, len(r.pools))
	for _, p := range r.pools {
		pools = append(pools, p)
	}
	r.pools = map[string]*pgxpool.Pool{}
	r.mu.Unlock()
	for _, p := range pools {
		p.Close()
	}
}
