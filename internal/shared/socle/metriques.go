package socle

import (
	"context"
	"cpi-go/db"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// Le panneau demande qui vous êtes avant la connexion : ce 401 est structurel
// et serait le premier poste du taux d'erreur 4xx, il a sa propre classe.
const (
	classeSessionExpiree = 9
	routeSessionCourante = "GET /api/v1/auth/me"
)

var plafondsSeaux = [5]int64{50, 200, 500, 1000, 3000}

type cleMetrique struct {
	heure  time.Time
	route  string
	classe int16
}

type compteurs struct {
	appels  int32
	msTotal int64
	seaux   [6]int32
}

var (
	verrouMetriques sync.Mutex
	metriques       = map[cleMetrique]*compteurs{}
)

// Des constantes plutôt que `statut / 100` : la colonne porte un `CHECK`, et
// un statut hors des cinq familles connues n'a pas à faire échouer l'écriture.
func classeDuStatut(route string, statut int) int16 {
	switch {
	case statut == http.StatusUnauthorized && route == routeSessionCourante:
		return classeSessionExpiree
	case statut >= 500:
		return 5
	case statut >= 400:
		return 4
	case statut >= 300:
		return 3
	case statut >= 200:
		return 2
	}
	return 1
}

func compterRequete(route string, statut int, ms int64) {
	cle := cleMetrique{heure: time.Now().Truncate(time.Hour), route: route, classe: classeDuStatut(route, statut)}
	verrouMetriques.Lock()
	defer verrouMetriques.Unlock()
	c := metriques[cle]
	if c == nil {
		c = &compteurs{}
		metriques[cle] = c
	}
	c.appels++
	c.msTotal += ms
	c.seaux[seau(ms)]++
}

func seau(ms int64) int {
	for i, plafond := range plafondsSeaux {
		if ms <= plafond {
			return i
		}
	}
	return len(plafondsSeaux)
}

// Les compteurs vivent dans le processus et repartent de zéro à chaque vidage :
// une écriture perdue coûte une minute de mesures, jamais une requête.
func ViderMetriquesChaqueMinute(ctx context.Context, q *db.Queries) {
	tic := time.NewTicker(time.Minute)
	defer tic.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tic.C:
			viderMetriques(ctx, q)
		}
	}
}

func viderMetriques(ctx context.Context, q *db.Queries) {
	verrouMetriques.Lock()
	lot := metriques
	metriques = map[cleMetrique]*compteurs{}
	verrouMetriques.Unlock()
	for cle, c := range lot {
		err := q.MetriquesHttpAjouter(ctx, db.MetriquesHttpAjouterParams{
			Heure:    cle.heure,
			Route:    cle.route,
			Classe:   cle.classe,
			Appels:   c.appels,
			MsTotal:  c.msTotal,
			Seau50:   c.seaux[0],
			Seau200:  c.seaux[1],
			Seau500:  c.seaux[2],
			Seau1000: c.seaux[3],
			Seau3000: c.seaux[4],
			SeauPlus: c.seaux[5],
		})
		if err != nil {
			slog.Warn("métriques HTTP non écrites", "route", cle.route, "err", err)
			return
		}
	}
}
